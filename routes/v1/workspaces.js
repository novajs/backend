/**
 * /workspaces
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1.0.0
 **/

'use strict';

const express = require('express');
const hostile = require('hostile');
const async   = require('async');
const debug   = require('debug')('route:workspaces');
const Docker  = require('dockerode');
const Auth = require('../../lib/auth.js');

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

    debug(req.param.id+'#Start', 'starting container for '+username)


    let container = null;
    let selective = {};
    async.waterfall([
      // check if the container already exists
      (next) => {
        auth.getUserWorkspace(username)
        .then(cont => {
          debug('start:select', 'ID is', cont.id);

          container = docker.getContainer(cont.id)
          selective = cont;

          return next(false, false);
        })
        .catch(err => {
          if(err === 'NOT_INITIALIZED') {
            debug('start:select', 'we don\'t have a workspace yet, let\'s fix that.')
            return next(false, true)
          }
        });
      },

      (init, next) => {
        if(!init) {
          debug('start:init', 'selectively not INITING, container was FOUND.')
          return next(false, false);
        }

        docker.createContainer({
          Image: 'cloud9-docker',
          name: 'workspace-'+username,
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
          Volumes: {
            '/workspace': {}
          },
          Networks: {
            bridge: {
              Gateway: '172.17.0.1',
              IPPrefixLen: 16
            }
          },
          Env: []
        }, (err, cont) => {
          container = cont;
          return next(err);
        });
      },

      // start the container to make sure it has defaults (new IP, etc)
      (db_init, next) => {
        debug('start', 'starting container');
        return container.start(err => {
          if(err !== null && err.reason === 'container already started' && !db_init) {
            debug('start:container', 'already started but we\'re selective.')
            return next(false, db_init);
          }

          return next(err, db_init);
        });
      },

      // Pull information about the docker container and store it in the DB.
      (db_init, next) => {
        debug('start', 'inspecting container and logging information')
        return container.inspect((err, data) => {
          if(err) return next(err);

          const IP   = data.NetworkSettings.Networks.bridge.IPAddress;
          const ID   = data.Id;
          const NAME = 'workspace-'+username;

          if(!IP) {
            return next('INVALID_DOCKER_INSPECT_FORMAT');
          }

          let done = () => {
            return next(false, {
              ID:   ID,
              NAME: NAME,
              IP:   IP
            })
          }

          debug('start:inspect', 'IP is', IP);

          if(!db_init) {
            if(selective.ip === IP) {
              debug('start:db', 'not writing information');
              return done();
            }

            debug('start:db', 'we\'re an already existing container, but our IP changed. Writing.');
          }

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

      return res.success({
        status: 'UP',
        id: info.ID,
        name: info.NAME,
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
