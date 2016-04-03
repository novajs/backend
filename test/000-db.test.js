/**
 * Check That the Database is created correctly.
 **/

'use strict';

let spawn  = require('child_process').spawn;
let db     = require('arangojs');
let path   = require('path');

let config;
try {
  config  = require('../config/config.json')
} catch(e) {
  console.log('Failed to load config.', e);
  process.exit(1);
}

const DBNAME = config.db.name;
const DBHOST = config.db.host;
const DBUSER = config.db.username;
const DBPASS = config.db.password;

let dbctl = new db({
  host: DBHOST
});

// Make sure it doesn't exist.
dbctl.dropDatabase(DBNAME).catch(err => {
  console.log('ERROR: DB DELETE', err);
})

describe('db', function() {

  it('is initialized OK', function(next) {
    let test = spawn('node', ['index.js', '--db-only'], {
      cwd: path.join(__dirname, '..')
    });
    test.on('exit', code => {
      if(code !== 0) {
        return next(true);
      }

      return next(false);
    });
  });

  it('it exists', function() {
    dbctl.useDatabase(DBNAME);
  });

  it('contains main collections', function(next) {
    dbctl.listCollections()
    .then(collections => {
      if(collections !== undefined) {
        return next();
      }

      return next(true);
    }).catch(err => {
      console.log(err);
      return next(true);
    })
  });

});
