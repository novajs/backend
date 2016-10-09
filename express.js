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
const async     = require('async');
const path      = require('path');

// Express
const cp        = require('cookie-parser');
const raven     = require('raven');
const BP        = require('body-parser');
const cors      = require('cors');

// Service Modules
const CONFIG    = require('./lib/config.js');
const responses = require('./lib/response.js');


let client = new raven.Client(CONFIG.sentry.DSN);
client.patchGlobal();

let corsOptions = {
  origin: function(origin, callback){
    callback(null, origin);
  },
  credentials: true
};

// Express Master
module.exports = (dbctl, log, stage) => {
  if(process.argv[2] === '--test-express') {
    throw 'ERROR'
  }

  const API_VERSION = CONFIG.server.api_version;

  let app = express();


  if(CONFIG.sentry.enabled) {
    log('Sentry Enabled')
    app.use(raven.middleware.express.requestHandler(CONFIG.sentry.DSN, CONFIG.sentry.opts))
  }

  app.use(cp());
  app.use(BP.json());
  app.use(BP.urlencoded({ extended: true }));
  app.use(cors(corsOptions));
  app.use(responses());

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

        app.all('/', (req, res) => {
          return res.send({
            success: true,
            data: {
              versions: [ 'v1' ]
            }
          })
        })

        // for each route, mount on point.
        async.each(list, (route, next) => {
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

      if(CONFIG.sentry.enabled) {
        app.use(raven.middleware.express.errorHandler(CONFIG.sentry.DSN, CONFIG.sentry.opts))
      }

      app.get('/', (req, res) => {
        return res.send({
          success: true,
          data: {
            versions: [ 'v1' ]
          }
        })
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

    app.listen(CONFIG.server.port, () => {
      log('express listening on', CONFIG.server.port);
      stage.emit('finished', {
        stage: 2,
        name: 'express::start',
        sub: 'INIT'
      })
    });
  });
}
