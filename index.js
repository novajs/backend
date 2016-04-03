/**
 * OnionTweet - a Tor Twitter Service.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 0.1.0
 * @license MIT
 **/

'use strict';

// const express = require('express');
// const redis   = require('redis');
const arango  = require('arangojs');
const async   = require('async');

// our modules.
const log     = require('./lib/log.js');
const stage   = require('./lib/stage.js');

// load our config or die.
let config;
try {
  config  = require('./config/config.json')
} catch(e) {
  log('Failed to load config.', e);
  process.exit(1);
}

// STATIC
const DBNAME = config.db.name;
const DBHOST = config.db.host;
const DBUSER = config.db.username;
const DBPASS = config.db.password;
// const PORT   = config.server.port;

let dbctl    = new arango({
  url: DBHOST
});

let init = () => {
  stage.emit('start', {
    stage: 1,
    name: 'express',
    sub: 'INIT'
  })

  try {
    require('./express.js')(dbctl, function() {
      let args = Array.prototype.slice.call(arguments, 0);
      args[0]  = 'main: '+stage.Sub+ ' stage '+ stage.Stage + ': ' + args[0];
      console.log.apply(console, args);
    }, stage);
  } catch(err) {
    if(err === 'ERROR') {
      process.exit(2);
    }

    stage.emit('failed', {
      stage: stage.Stage,
      sub: stage.Sub,
      name: stage.Name
    });
  }
}

// Set the Database
dbctl.useDatabase(DBNAME);
dbctl.get()
.then(() => {
  log('DB is OK.');

  // remove it from promise catching.
  setTimeout(function() {
    stage.emit('init');
  });
}).catch(err => {
  let start = Date.now();

  log('DB needs init.');

  dbctl.useDatabase('_system');
  dbctl.createDatabase(DBNAME, [{
    username: DBUSER,
    passwd: DBPASS
  }]).then(() => {
    log('DB stage 1: db created');

    // change to the DB.
    dbctl.useDatabase(DBNAME);

    // create a table func later
    let collections = [
      'users',
      'status',
      'messages'
    ]

    // Create the collections.
    async.each(collections, (collection, next) => {
      dbctl.collection(collection).create().then(() => {
        log('DB stage 2: collection', collection, 'created');
        return next(false, collection);
      }).catch(err => {
        return next(err, collection);
      });
    }, (err, name) => {
      if(err) {
        console.log(err);
        return log('DB stage 2: collection', name, 'creation failed.')
      }

      log('DB stage 2: finished OK.');

      let end = Date.now();
      let time = end - start;
      log('DB init took', time+'ms');

      if(process.argv[2] === '--db-only') {
        log('DB stage 3: test finished.')
        process.exit();
      }

      stage.emit('init');
    });
  }).catch(err => {
    log('Failed to init.');
    console.log(err.name+':', err.message);
    process.exit(1);
  })
})

// Init Stage.
stage.on('init', () => {
  log('INIT stage started.')
  return init();
})
