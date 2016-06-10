/**
 * ExpressJS Routes.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0.
 * @license MIT
 **/

'use strict';

const express   = require('express');
const fs        = require('fs');
const httpProxy = require('http-proxy');
const async     = require('async');
const path      = require('path');
const mkdirp    = require('mkdirp');

// express stuff.
const morgan  = require('morgan');
const BP      = require('body-parser');
const cors    = require('cors');

const debug   = require('debug')('express:stage');

const Auth    = require('./lib/auth.js');

module.exports = (dbctl, log, stage) => {
  if(process.argv[2] === '--test-express') {
    throw 'ERROR'
  }

  mkdirp.sync('./cache');

  let DNSCACHE = './cache/dnscache.json';
  if(!fs.existsSync(DNSCACHE)) {
    debug('init', 'DNSCACHE created.');
    global.DNSCACHE = {};
  } else {
    debug('init', 'DNSCACHE loaded from ./cache');
    global.DNSCACHE = require(DNSCACHE);
  }

  // load our config or die.
  let config;
  try {
    config  = require('./config/config.json')
  } catch(e) {
    config  = require('./config/config.example.json');
  }

  const API_VERSION = config.server.api_version;

  let app = express();

  // app.use(morgan('dev'));
  app.use(BP.json());
  app.use(cors());

  app.use((req, res, next) => {
    res.error = (status, message) => {
      if(!message) {
        message = status;
        status = 200;
      }

      if(!message) {
        return res.status(status).send();
      }

      return res.status(status).send({
        success: false,
        message: message
      });
    };

    res.success = (data) => {
      return res.send({
        success: true,
        data: data
      })
    };

    return next();
  });

  let proxy;
  let auth = new Auth(dbctl);
  try {
    proxy = httpProxy.createProxyServer({});
  } catch(e) {

  }

  /**
   * Proxy to the workspace.
   *
   **/
  app.use((req, res, next) => {
    let name = req.hostname.split('.')[0];

    if(req.hostname.split('.').length !== 3) {
      return next();
    }

    let done = (CACHED_OBJ) => {
      if(req.url === '/') {
        // TODO: Authentication establish here.
      }

      return proxy.web(req, res, {
        target: CACHED_OBJ.ip
      }, err => {
        return res.status(404).send('Workspace Not Available (Is it running?)')
      });
    }

    if(!global.DNSCACHE[name]) {
      auth.getUserObject(name)
      .then(user => {
        let O = user[0].value;

        if(!O.docker) {
          return res.error('Workspace hasn\'t been created for this user yet.');
        }

        let IP = O.docker.ip;

        // create a new object in the "dns" cache.
        debug('proxy', name, '->', IP);
        global.DNSCACHE[name] = {
          ip: 'http://'+IP,
          success: true
        }

        return done(global.DNSCACHE[name]);
      })
      .catch(err => {
        global.DNSCACHE[name]
        return res.error('Failed to Resolve Workspace');
      })
    } else {
      return done(global.DNSCACHE[name]);
    }
  });

  log('middleware loaded')

  async.waterfall([
    /**
     * Load Express Routes
     **/
    function(next) {
      let ROUTES = path.join(__dirname, 'routes', API_VERSION);
      fs.readdir(ROUTES, (err, list) => {
        if(err) {
          return next(err);
        }

        // for each route, mount on point.
        async.each(list, function(route, next) {
          let Path  = path.join(ROUTES, route);
          let name  = path.parse(route).name;
          let mount = path.join('/', API_VERSION, '/', name)

          log('mount route', name, 'on', mount);

          let eroute;
          try {
            eroute = require(Path);
          } catch(e) {
            return next(e);
          }

          if(typeof eroute !== 'function') {
            log('route', name, 'isn\'t a valid route. (not mounting)');
            return next();
          }

          // execute eroute "constructor"
          let router = eroute(new express.Router(), dbctl);

          if(typeof router !== 'function') {
            log('route', name, 'didn\'t return a Router (not mounting)');
            return next()
          }

          // Hook in the newly created route.
          app.use(mount, router);

          return next()
        }, function(err) {
          if(err) {
            return next(err);
          }

          return next();
        });
      })

      app.use(function(err, req, res, next) {
        console.error(err);
        return next();
      });
    }
  ], err => {
    if(err) {
      throw err;
    }

    stage.emit('finished', {
      stage: 1,
      sub: 'INIT',
      name: 'express::construct'
    });

    stage.emit('start', {
      stage: 2,
      name: 'express::start',
      sub: 'INIT'
    })

    app.listen(config.server.port, function() {
      log('express listening on', config.server.port);
      stage.emit('finished', {
        stage: 2,
        name: 'express::start',
        sub: 'INIT'
      })
    });
  });
}
