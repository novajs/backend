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
        if(err) throw err;

        container.start(err => {
          if(err) throw err;

          container.inspect((err, data) => {
            const IP   = data.NetworkSettings.Networks.bridge.IPAddress;
            const ID   = data.Id;
            const HOST = 'workspace-'+username+'.wrk'

            if(!IP) {
              container.stop(err => {
                return res.error(500, 'INTERNAL_CONTAINER_CONFIG_ERROR');
              });
            }
            debug('Container#IP', IP);

            debug('Container#/etc/hosts', HOST);
            hostile.set(IP, HOST, err => {
              if(err) {
                debug('Container#/etc/host', 'failed config', err);

                container.stop(err => {});

                return res.error(500, 'INTERNAL_CONTAINER_HOSTMAP_ERROR');
              }

              return res.success({
                status: 'UP',
                id: ID,
                name: 'workspace-'+username,
                network: {
                  ip: IP,
                  host: HOST
                }
              });
            })
          });
        });
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
