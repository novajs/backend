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

  Router.get('/list', (req, res) => {
    return res.success([])
  });

  Router.post('/delegate', (req, res) => {

  });


  let id = new express.Router();

  id.get('/stop', (req, res) => {

  });

  id.get('/restart', (req, res) => {

  })

  id.get('/start', (req, res) => {
    let username = req.user.username;

    debug(req.param.id+'#Start', 'starting container for '+username)

    try {
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
      }, (err, container) => {
        async.waterfall([
          // catch library errors.
          (next) => {
            debug('start', 'catching errors')
            return next(err);
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
              const NAME = 'workspace-'+username;

              if(!IP) {
                return next('INVALID_DOCKER_INSPECT_FORMAT');
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
                  return next(false, {
                    ID:   ID,
                    NAME: NAME,
                    IP:   IP
                  })
                  .fail(err => {
                    debug('start:db', 'error', err);
                    return next(err);
                  })
                });
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
      });
    } catch(e) {
      debug('container', 'error', e);
      return res.error('INTERNAL_CONTAINER_ERROR')
    }
  })

  id.get('/status', (req, res) => {

  });

  Router.use('/mine', id);

  return Router;
}
