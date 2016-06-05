/**
 * ExpressJS Routes.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0.
 * @license MIT
 **/

'use strict';

const express = require('express');
const fs      = require('fs');
const async   = require('async');
const path    = require('path');

// express stuff.
const morgan  = require('morgan');
const BP      = require('body-parser');

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

  app.use(morgan('dev'));
  app.use(BP.json());

  app.use((req, res, next) => {
    res.error = (status, message) => {
      if(!status) {
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

  // middleware.


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
