/**
 * Basic Express tests
 **/

'use strict';

let spawn = require('child_process').spawn;
let path  = require('path');

describe('express', function() {

  it('is independant of promise context', function(next) {
    let test = spawn('node', ['index.js', '--test-express'], {
      cwd: path.join(__dirname, '..')
    });
    test.on('exit', code => {
      if(code !== 2) {
        return next(true);
      }

      return next(false);
    });
  });
});
