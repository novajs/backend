/**
 * Basic Log Wrapper.
 **/

'use strict';

const log = function() {
  let args = Array.prototype.slice.call(arguments, 0);
  args[0]  = 'main: ' + args[0];
  console.log.apply(console, args);
}

module.exports = log;
