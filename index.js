/**
 * Backend for Nova's JavaScrip class.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 * @license MIT
 **/

'use strict';

// load our config or die.
const config = require('./lib/config.js');

if(config.debug === undefined || config.debug === true) {
  process.env.DEBUG = 'backend:*'
  process.env.TERM = 'xterm'
}

if(config.colors) {
  process.env.DEBUG_COLORS = '1'
}

// our modules.
const stage   = require('./lib/stage.js');
const DB      = require('./lib/db.js');

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
