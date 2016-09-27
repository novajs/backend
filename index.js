/**
 * Backend for Nova's JavaScrip class.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 * @license MIT
 **/

'use strict';

// load our config or die.
let config;
try {
  config  = require('./config/config.json')
} catch(e) {
  console.log('Error:', 'no config found. (./config/config.json)');
  console.log('Stack Trace:', e);
  process.exit(1)
}

if(config.debug === undefined || config.debug === true) {
  process.env.DEBUG = 'backend:*'
  process.env.TERM = 'xterm'
}

if(config.colors) {
  process.env.DEBUG_COLORS = '1'
}

const path    = require('path');
const mkdirp  = require('mkdirp');

// our modules.
const stage   = require('./lib/stage.js');
const DB      = require('./lib/db.js');


global.STORAGE_DIR = path.join(__dirname, './workspaces');

mkdirp.sync(global.STORAGE_DIR);

// template to test it.
let dbctl = new DB(config);

let init = () => {
  stage.emit('start', {
    stage: 1,
    name: 'express',
    sub: 'INIT'
  });

  require('./lib/docker.js')(container => {
    global.container = container;
  })

  require('./express.js')(dbctl, (...args) => {
    args.unshift('main: '+stage.Sub+ ' stage '+ stage.Stage + ': ');
    console.log.apply(console, args);
  }, stage);
}

dbctl.init(() => {
  init();
})
