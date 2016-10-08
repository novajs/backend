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
const request = require('request');
const url     = require('url');

const Auth       = require('../../lib/auth.js');
const Assignment = require('../../lib/assignment.js');
const Redis      = require('../../lib/redis.js');

const CONFIG = require('../../lib/config.js');


const redis = Redis();
const pub   = Redis();

module.exports = (Router, dbctl) => {

  const docker      = new Docker();
  const auth        = new Auth(dbctl);
  const assignment  = new Assignment(dbctl);

  Router.post('/containerpostboot', (req, res) => {
    // delegate to a workspace container
    let workspace_ip = 'http://'+CONFIG.workspace.ip;
    if(CONFIG.workspace.ip == '<env>') {

      let WORKSPACE = process.env.WORKSPACE_1_PORT || process.env.WORKSPACE_PORT;
      if(WORKSPACE) {
        let Workspace = url.parse(WORKSPACE);

        debug('init', 'using DNS resolving');
        workspace_ip = 'http://'+Workspace.hostname+':'+Workspace.port;
      } else {
        debug('init', 'told to use docker but failed to determine IP');
        return next('INTERNAL_SYS_WORKSPACE_EVAL_ERR');
      }
    }

    debug('workspace', 'POST', workspace_ip)

    request({
      method: 'POST',
      uri: workspace_ip.replace(/\/$/g, '')+'/post',
      body: {
        auth: req.body.auth,
        ip: req.body.ip
      },
      json: true
    }, (err, resp, body) => {
      return res.send(body);
    })
  })

  Router.post('/update', (req, res) => {
    let workspace_ip = 'http://'+CONFIG.workspace.ip;
    if(CONFIG.workspace.ip == '<env>') {

      let WORKSPACE = process.env.WORKSPACE_1_PORT || process.env.WORKSPACE_PORT;
      if(WORKSPACE) {
        let Workspace = url.parse(WORKSPACE);

        debug('init', 'using DNS resolving');
        workspace_ip = 'http://'+Workspace.hostname+':'+Workspace.port;
      } else {
        debug('init', 'told to use docker but failed to determine IP');
        return next('INTERNAL_SYS_WORKSPACE_EVAL_ERR');
      }
    }

    debug('workspace', 'POST', workspace_ip)

    request({
      method: 'POST',
      uri: workspace_ip.replace(/\/$/g, '')+'/updateImage'
    }, (err, resp, body) => {
      return res.send(body);
    })
  })

  Router.post('/heartbeat', auth.requireAuthentication(), (req, res) => {
    // delegate to a workspace container
    let workspace_ip = 'http://'+CONFIG.workspace.ip;
    if(CONFIG.workspace.ip == '<env>') {

      let WORKSPACE = process.env.WORKSPACE_1_PORT || process.env.WORKSPACE_PORT;
      if(WORKSPACE) {
        let Workspace = url.parse(WORKSPACE);

        debug('init', 'using DNS resolving');
        workspace_ip = 'http://'+Workspace.hostname+':'+Workspace.port;
      } else {
        debug('init', 'told to use docker but failed to determine IP');
        return next('INTERNAL_SYS_WORKSPACE_EVAL_ERR');
      }
    }

    debug('workspace', 'POST', workspace_ip)

    request({
      method: 'POST',
      uri: workspace_ip.replace(/\/$/g, '')+'/heartbeat',
      body: {
        username: req.body.username
      },
      json: true
    }, (err, resp, body) => {
      return res.send(body);
    })
  })



  let id = new express.Router();

  id.use(require('../../lib/response.js')())
  id.use(auth.requireAuthentication())

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

    debug('user finished assignments', req.user.assignments);

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

          return next();
        })
        .catch(err => {
          debug('start:assignmentValidCheck', 'error: ', err);
          return next(err);
        })
      },

      (next) => {
        if(!req.user.assignments) {
          return next();
        }

        if(typeof req.user.assignments !== 'object') {
          return next();
        }

        if(req.user.assignments[entity].status === 'finished') {
          return next('ASSIGNMENT_FINISHED');
        }
      },

      (next) => {
        // delegate to a workspace container
        let workspace_ip = 'http://'+CONFIG.workspace.ip;
        if(CONFIG.workspace.ip == '<env>') {

          let WORKSPACE = process.env.WORKSPACE_1_PORT || process.env.WORKSPACE_PORT;
          if(WORKSPACE) {
            let Workspace = url.parse(WORKSPACE);

            debug('init', 'using DNS resolving');
            workspace_ip = 'http://'+Workspace.hostname+':'+Workspace.port;
          } else {
            debug('init', 'told to use docker but failed to determine IP');
            return next('INTERNAL_SYS_WORKSPACE_EVAL_ERR');
          }
        }

        debug('workspace', 'POST', workspace_ip)
        request({
          method: 'POST',
          uri: workspace_ip.replace(/\/$/g, '')+'/start',
          body: {
            username: username,
            assignment: entity
          },
          json: true
        }, (err, res, body) => {
          if(err) return next('FAILED_TO_LAUNCH_WORKSPACE');

          debug('worksapce', 'GOT', body)

          if(body === 'FAIL') {
            return next('INTERNAL_SYS_WORKSPACE_LAUNCH');
          }

          return next(false, {
            username: username,
            assignment: entity
          });
        })
      }
    ], (err, info) => {
      debug('workspaces', 'done')
      if(err) {
        return res.error(500, err);
      }

      return res.success({
        status:     'init',
        username:   info.username,
        assignment: info.assignment
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
