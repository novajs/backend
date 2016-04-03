/**
 * ExpressJS Routes.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0.
 * @license MIT
 **/

const express = require('express');
const fs      = require('fs');
const async   = require('async');
const path    = require('path');
//const arango  = require('arangojs');

module.exports = (dbctl, log, stage) => {
  'use strict';

  if(process.argv[2] === '--test-express') {
    throw 'ERROR'
  }

  // load our config or die.
  let config;
  try {
    config  = require('./config/config.json')
  } catch(e) {
    log('Failed to load config.', e);
    process.exit(1);
  }

  let app       = express();

  // middleware.


  log('middleware loaded')

  async.waterfall([
    /**
     * Load Express Routes
     **/
    function(next) {
      let ROUTES = path.join(__dirname, 'routes', 'v1');
      fs.readdir(ROUTES, (err, list) => {
        if(err) {
          return next(err);
        }

        async.each(list, function(route, next) {
          let Path = path.join(ROUTES, route);
          let name = path.parse(route).name;

          log('load route', name);

          let eroute;
          try {
            eroute = require(Path);
          } catch(e) {
            return next(e);
          }

          app.use(name, eroute);

          return next()
        }, function(err) {
          if(err) {
            return next(err);
          }

          return next();
        });
      })
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
