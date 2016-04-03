/**
 * OnionTweet - a Tor Twitter Service.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 0.1.0
 * @license MIT
 **/

'use strict';

// not using imports because they make slowwww app load times
const express = require('express');
const redis   = require('redis');
const arango  = require('arangojs');
const async   = require('async');

const log = function() {
  let args = Array.prototype.slice.call(arguments, 0);
  args[0]  = 'main: ' + args[0];
  console.log.apply(console, args);
}

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
const PORT   = config.server.port;

let db        = new arango(DBNAME);
