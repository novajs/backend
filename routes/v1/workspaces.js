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
const debug   = require('debug')('route:workspaces');
const Docker  = require('dockerode');
const mkdirp  = require('mkdirp');
const fs      = require('fs');
const path    = require('path');

const Auth    = require('../../lib/auth.js');
const Assignment = require('../../lib/assignment.js');

console.log('STORAGE: ', global.STORAGE_DIR);

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
        .catch(() => {
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
                assignment: entity
              }
            })
            .then(() => {
              return done();
            })
            .fail(err => {
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

      // handle all ip conflicts.
      (info, next) => {
        debug('start:ip_conflict', 'look for', info.ip, 'excluding uid', info.uid)

        dbctl.search('users', 'docker.ip: "'+info.ip+'"')
        .then(results => {
          if(results.body.count === 0) return next('ERR_IP_RESOLVE_CONFLICTS');

          let pointer = results.body.results;

          async.each(pointer, (w, done) => {
            // if not object, invalid response, throw error.
            if(typeof w !== 'object') throw 'ERR_INVALID_DB_RESPONSE'

            // if it's the same id as we just registered, skip
            if(w.path.key === info.uid) return done();

            // match the values or return
            if(w.value.docker.ip !== info.ip) return done();

            debug('start:ip_conflict:db',
             'resolve IP conflict, cID:',
             w.value.docker.id,
             'key:',
             w.path.key
            );

            dbctl.update('users', w.path.key, {
              docker: {
                ip: null
              }
            })
            .then(done).fail(done);
          }, e => {
            if(e) return next(e);

            debug('start:ip_conflict', 'resolved all conflict(s)')

            return next(false, info);
          });

          // itterate ove DNSCACHE and in place update it.
          Object.keys(global.DNSCACHE).forEach(v => {
            let value = global.DNSCACHE[v];
            let key   = v;

            if(value.ip === info.ip) {
              debug('start:ip_conflict:cache',
                'resolve IP conflict for container owned by', key
              )

              value.ip = null
            }
          })
        })
        .fail(err => {
          debug('start:ip_conflict:err', err);
          return next(err);
        })
      }
    ], (err, info) => {
      if(err) {
        if(container) {
          debug('start', 'ERROR stop container and remove');
          container.stop(() => {container.remove(() => {})});
        }
        return res.error(500, err);
      }

      if(!global.DNSCACHE) {
        debug('start', 'WARNING: NO DNSCACHE ON GLOBAL');
      } else if(!global.DNSCACHE[username]) {
        global.DNSCACHE[username] = {
          ip: null,
          assignment: entity,
          success: false
        }
      }

      debug('start', 'updated DNSCACHE');
      global.DNSCACHE[username].ip = 'http://'+info.ip
      global.DNSCACHE[username].success = true;

      let dump     = JSON.stringify(global.DNSCACHE);
      let DNSCACHE = path.join(__dirname, '../..', './cache/dnscache.json')
      fs.writeFile(DNSCACHE, dump, 'utf8', err => {
        if(err) {
          debug('start:cache', 'failed to write cache file...');
        } else {
          debug('start:cache', 'wrote DNSCACHE to cache dir');
        }

        return res.success({
          status: 'UP',
          id: info.id,
          network: {
            ip: info.ip
          },
          owner: username
        });
      });
    })
  })

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
