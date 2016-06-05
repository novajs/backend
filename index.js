/**
 * Backend for Nova's JavaScrip class.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 * @license MIT
 **/

'use strict';

const async   = require('async');

// our modules.
const log     = require('./lib/log.js');
const stage   = require('./lib/stage.js');
const DB      = require('./lib/db.js');

// load our config or die.
let config;
try {
  config  = require('./config/config.json')
} catch(e) {
  console.log('Error:', 'no config found. (./config/config.json)');
  console.log('Stack Trace:', e);
  process.exit(1)
}

// template to test it.
let dbctl = new DB(config);

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

    console.log(err);

    stage.emit('failed', {
      stage: stage.Stage,
      sub: stage.Sub,
      name: stage.Name
    });
  }
}

return init();
