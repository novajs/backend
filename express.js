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

const BP        = require('body-parser');
const cors      = require('cors');
const responses = require('./lib/response.js');
const cp        = require('cookie-parser');

// Express Master
module.exports = (dbctl, log, stage) => {
  if(process.argv[2] === '--test-express') {
    throw 'ERROR'
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

  app.use(cp());
  app.use(BP.json());
  app.use(BP.urlencoded({ extended: true }));

  var whitelist = ['https://ide.tritonjs.com', 'https://tritonjs.com', 'https://game.tritonjs.com'];
  var corsOptions = {
    origin: function(origin, callback){
      var originIsWhitelisted = whitelist.indexOf(origin) !== -1;
      callback(originIsWhitelisted ? null : 'Bad Request', originIsWhitelisted);
    },
    credentials: true
  };
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

      app.get('/', (req, res) => {
        return res.send({
          success: true,
          data: {
            versions: [ 'v1' ]
          }
        })
      });

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
