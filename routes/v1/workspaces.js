/**
 * /workspaces
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1.0.0
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

console.log('STORAGE: ', global.STORAGE_DIR);

module.exports = (Router, dbctl) => {

  const docker = new Docker();
  const auth   = new Auth(dbctl);

  Router.use(auth.requireAuthentication())

  let id = new express.Router();

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

  id.get('/destroy', (req, res) => {
    let username = req.user.username;

    auth.getUserWorkspace(username)
    .then(cont => {
      debug('start:select', 'ID is', cont.id);

      let container = docker.getContainer(cont.id)
      container.stop(err => {

        container.remove(err => {
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

  id.get('/start', (req, res) => {
    let username = req.user.username;
    let entity   = '111212131313-131313-131313';

    let WORKING_DIR = path.join(global.STORAGE_DIR, username, entity);

    mkdirp.sync(WORKING_DIR);

    debug('start', 'resolved working dir to:', WORKING_DIR);

    if(!entity) {
      return res.error('INVALID_NO_ASSINGMENT');
    }

    let container = null;
    let selective = {};
    async.waterfall([
      // check if the container already exists
      (next) => {
        auth.getUserWorkspace(username)
        .then(cont => {
          debug('start:select', 'ID is', cont.id);

          container = docker.getContainer(cont.id)

          container.stop(err => {
            debug('start', 'stopped running container (if it was running)');

            container.remove(err => {
              debug('start', 'removed old container')
              return next(err);
            })
          })
        })
        .catch(err => {
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

          if(!IP) {
            return next('INVALID_DOCKER_INSPECT_FORMAT');
          }

          let done = () => {
            return next(false, {
              ID:   ID,
              IP:   IP
            })
          }

          debug('start:inspect', 'IP is', IP);
          auth.getUserKeyByUsername(username)
          .then(key => {
            debug('start:db', 'user key is', key);

            dbctl.update('users', key, {
              docker: {
                id: ID,
                ip: IP
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
      }
    ], (err, info) => {
      if(err) {
        container.stop(() => {});
        return res.error(500, err);
      }

      if(!global.DNSCACHE) {
        debug('start', 'WARNING: NO DNSCACHE ON GLOBAL');
      } else if(!global.DNSCACHE[username]) {
        global.DNSCACHE[username] = {
          ip: null,
          success: false
        }
      }

      debug('start', 'updated DNSCACHE');
      global.DNSCACHE[username].ip = 'http://'+info.IP
      global.DNSCACHE[username].success = true;

      let dump = JSON.stringify(global.DNSCACHE);
      fs.writeFileSync(path.join(__dirname, '../..', './cache/dnscache.json'), dump, 'utf8');

      debug('start', 'wrote DNSCACHE to cache dir');

      return res.success({
        status: 'UP',
        id: info.ID,
        network: {
          ip: info.IP
        },
        owner: username
      });
    })
  })

  id.get('/status', (req, res) => {

  });

  Router.use('/mine', id);

  return Router;
}
