/**
 * Basic Stage Metadata handler.
 *
 * @todo Cleanup repetative code
 **/

'use strict';

const events = require('events');
const log = require('./log.js');

let stage    = new events.EventEmitter();
stage.Stage = 0;
stage.Sub   = 'INIT';
stage.Name  = 'unspec'

stage.on('start', data => {
  stage.Stage = data.stage;
  stage.Sub   = data.sub;
  stage.Name  = data.name;

  log(data.sub, 'stage', data.stage+' ('+data.name+'): Started');
})

stage.on('finished', data => {
  stage.Stage = 0;
  stage.Sub   = data.sub;
  stage.Name  = data.name;

  log('INIT stage', data.stage+' ('+data.name+'): Finished');
});

stage.on('failed', data => {
  stage.Stage = data.stage-1;
  stage.Sub   = data.sub;
  stage.Name  = data.name;

  log('INIT stage', data.stage+' ('+data.name+'): Failed');
  process.exit(1);
});

module.exports = stage;
