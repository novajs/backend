/**
 * /workspaces
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1.2.1
 **/

'use strict';

const express = require('express');
const async   = require('async');
const debug   = require('debug')('backend:route:workspaces');
const Docker  = require('dockerode');
const mkdirp  = require('mkdirp');
const path    = require('path');

const Auth       = require('../../lib/auth.js');
const Assignment = require('../../lib/assignment.js');
const Redis      = require('../../lib/redis.js');


const redis = Redis();
const pub   = Redis();

module.exports = (Router, dbctl) => {

  const docker      = new Docker();
  const auth        = new Auth(dbctl);
  const assignment  = new Assignment(dbctl);

  Router.use(auth.requireAuthentication())

  let id = new express.Router();

  /**
   * GET /mine/stop
   *
   * Stop authenticated users container.
   **/
  id.get('/stop', (req, res) => {
    let username = req.user.username;

    auth.getUserWorkspace(username)
    .then(cont => {
      debug('start:select', 'ID is', cont.id);

      let container = docker.getContainer(cont.id)
      container.stop(err => {
        if(err) {
          return res.error('INTERNAL_CONTAINER_FAILED_TO_STOP');
        }

        return res.success('CONTAINER_STOPPED');
      })
    })
    .catch(err => {
      if(err === 'NOT_INITIALIZED') {
        return res.error('INTERNAL_CONTAINER_NOT_INITIALIZED');
      }
    });
  });

  /**
   * GET /mine/destroy
   *
   * Destroy a container.
   **/
  id.get('/destroy', (req, res) => {
    let username = req.user.username;

    auth.getUserWorkspace(username)
    .then(cont => {
      debug('start:select', 'ID is', cont.id);

      let container = docker.getContainer(cont.id)
      container.stop(() => {

        container.remove(() => {
          auth.getUserKeyByUsername(username)
          .then(key => {
            debug('start:db', 'user key is', key);

            dbctl.update('users', key, {
              docker: false
            })
            .then(() => {
              return res.success('CONTAINER_DESTROYED');
            })
            .fail(err => {
              debug('start:db', 'error', err);
              return res.error('INTERNAL_CONTAINER_DB_INVALID')
            })
          })
          .catch(err => {
            debug('start:auth', 'error', err);
            return res.error('INTERNAL_CONTAINER_AUTH_INVALID')
          })
        });
      })
    })
    .catch(err => {
      if(err === 'NOT_INITIALIZED') {
        return res.error('INTERNAL_CONTAINER_NOT_INITIALIZED');
      }
    });
  })

  /**
   * GET /mine/restart
   *
   * Restart authenticated users container.
   **/
  id.get('/restart', (req, res) => {
    let username = req.user.username;

    auth.getUserWorkspace(username)
    .then(cont => {
      debug('start:select', 'ID is', cont.id);

      let container = docker.getContainer(cont.id)
      container.stop(err => {
        if(err) {
          return res.error('INTERNAL_CONTAINER_FAILED_TO_STOP');
        }

        container.start(err => {
          if(err) {
            return res.error('INTERNAL_CONTAINER_FAILED_TO_START');
          }

          return res.success('CONTAINER_RESTARTED');
        })
      })
    })
    .catch(err => {
      if(err === 'NOT_INITIALIZED') {
        return res.error('INTERNAL_CONTAINER_NOT_INITIALIZED');
      }
    });
  })

  /**
   * GET /mine/start
   *
   * Start / Create authenticated users container.
   **/
  id.post('/start', (req, res) => {
    let username = req.user.username;
    let entity   = req.body.id;

    if(!entity) {
      return res.error(405, 'INVALID_INPUT');
    }

    let WORKING_DIR = path.join(global.STORAGE_DIR, username, entity);

    debug('start', 'resolved working dir to:', WORKING_DIR);

    if(!entity) {
      return res.error('INVALID_NO_ASSINGMENT');
    }

    let container = null;
    async.waterfall([
      // verify the assignment is real.
      (next) => {
        assignment.isValid(entity)
        .then(a => {
          debug('start', 'assignment name is:', a.name);

          debug('start', 'mkdir -p', WORKING_DIR);
          mkdirp.sync(WORKING_DIR);

          return next();
        })
        .catch(err => {
          debug('start:assignmentValidCheck', 'error: ', err);
          return next(err);
        })
      },

      // check if the container already exists
      (next) => {
        auth.getUserWorkspace(username)
        .then(cont => {
          debug('start:select', 'ID is', cont.id);

          container = docker.getContainer(cont.id)

          container.stop(() => {
            debug('start', 'stopped running container (if it was running)');

            container.remove(err => {

              if(err) {
                if(err.reason === 'no such container') {
                  debug('start', 'container vanished? docker rm? Moving on.')
                  return next();
                }
              } else {
                debug('start', 'removed old container');
              }

              return next(err);
            })
          })
        })
        .catch(err => {
          if(err !== 'NOT_INITIALIZED') {
            return next(err);
          }

          // not created. OK
          return next();
        });
      },

      (next) => {
        docker.createContainer({
          Image: 'cloud9-docker',
          ExposedPorts: {
            '80/tcp': {
              HostIp: '0.0.0.0',
              HostPort: '80'
            },
            '443/tcp': {
              HostIp: '0.0.0.0',
              HostPort: '443'
            }
          },
          Networks: {
            bridge: {
              Gateway: '172.17.0.1',
              IPPrefixLen: 16
            }
          },
          HostConfig: {
            Binds: [WORKING_DIR+':/workspace']
          },
          Env: [
            'ASSIGNMENTID='+entity,
            'USERNAME='+username
          ]
        }, (err, cont) => {
          debug('start', 'container created.');
          container = cont;
          return next(err);
        });
      },

      // start the container to make sure it has defaults (new IP, etc)
      (next) => {
        debug('start', 'starting container');
        return container.start(err => {
          return next(err);
        });
      },

      // Pull information about the docker container and store it in the DB.
      (next) => {
        debug('start', 'inspecting container and logging information')
        return container.inspect((err, data) => {
          if(err) return next(err);

          const IP   = data.NetworkSettings.Networks.bridge.IPAddress;
          const ID   = data.Id;
          let   UID  = null;

          if(!IP) {
            return next('INVALID_DOCKER_INSPECT_FORMAT');
          }

          let done = () => {
            if(!UID) return next('ERR_INVALID_CALLBACK');

            return next(false, {
              id:   ID,
              ip:   IP,
              username: username,
              uid:  UID
            })
          }

          debug('start:inspect', 'IP is', IP);
          auth.getUserKeyByUsername(username)
          .then(key => {
            debug('start:db', 'user key is', key);

            UID = key;

            dbctl.update('users', key, {
              docker: {
                id: ID,
                ip: IP,
                username: username,
                assignment: entity
              }
            })
            .then(done)
            .catch(err => {
              debug('start:db', 'error', err);
              return next(err);
            })
          })
          .catch(err => {
            debug('start:auth', 'error', err);
            return next(err);
          })
        });
      },

      /**
       * Handle all DB ip conflicts.
       **/
      (info, next) => {
        debug('start:ip_conflict', 'look for', info.ip, 'excluding uid', info.uid)

        dbctl.search('users', 'docker.ip', info.ip)
        .then(pointer => {
          debug('users', 'fetched pointer');

          async.each(pointer, (w, done) => {
            // if it's the same id as we just registered, skip
            if(w.key === info.uid) {
              debug('users', 'key is same as uid');
              return done();
            }
            // match the values or return
            if(w.docker.ip !== info.ip) {
              debug('users', 'fetched ip doesn\'t match ip');
              return done();
            }

            dbctl.update('users', w.key, {
              docker: {
                ip: null
              }
            })
            .then(() => {return done()}).catch(done);
          }, e => {
            if(e) return next(e);

            debug('start:ip_conflict', 'resolved all conflict(s)')

            return next(false, info);
          });
        })
        .catch(err => {
          debug('users', 'err', err);
          if(err === 'CONDITIONS_NOT_MET') return next(false, info);

          debug('start:ip_conflict:err', err);
          return next(err);
        })
      },

      /**
       * Publish and modify redis.
       **/
      (info, next) => {
        debug('redis', 'begin')
        if(!info.username) {
          info.username = username;
        }

        let info_str;
        try {
          info_str = JSON.stringify(info)
        } catch(e) {
          return debug('redis:strigify', 'failed to convert object to JSON');
        }

        // set it and pub the new information.
        redis.set(username, info_str);
        pub.publish('NewWorkspace', info_str)

        // clean up redis mismatche(s)
        let stream = pub.scanStream();
        let getpipe = redis.pipeline();

        // stream add the keys into the pipeline.
        stream.on('data', (resultKeys) => {
          for(let i = 0; i < resultKeys.length; i++) {
            debug('add user to pipe', resultKeys[i]);
            getpipe.get(resultKeys[i]);
          }
        });

        // execute the pipeline after it's finished streaming the keys.
        stream.on('end', () => {
          let setpipe = redis.pipeline()
          getpipe.exec((err, res) => {
            res.forEach((namecontainer) => {
              let container = namecontainer[1];

              try {
                container = JSON.parse(container);
              } catch(e) {
                debug('redis:invalid_res:ip_conflict', 'received invalid JSON response.');
                console.log('resp', container);
                return;
              }

              debug('redis:ip_conflict', 'process', container);
              if(container.ip === info.ip && container.uid !== info.uid) {
                let newContainer = container;

                // invalidate the container.
                newContainer.ip = null;
                newContainer = JSON.stringify(newContainer);

                setpipe.set(container.username, newContainer)
                pub.publish('WorkspaceConflict', newContainer);
              }
            });

            setpipe.exec((err) => {
              return next(err, info);
            })
          });
        })
      }
    ], (err, info) => {
      debug('workspaces', 'done')
      if(err) {
        if(container) {
          debug('start', 'ERROR stop container and remove');
          container.stop(() => {container.remove(() => {})});
        }
        return res.error(500, err);
      }

      return res.success({
        status: 'UP',
        id: info.id,
        network: {
          ip: info.ip
        },
        username: username
      });
    });
  });

  /**
   * GET /mine/status
   *
   * Get status of authenticated users container.
   **/
  id.get('/status', (req, res) => {
    return res.error('NOT_IMPLEMENTED')
  });

  Router.use('/mine', id);

  return Router;
}
