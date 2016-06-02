/**
 * Database Layer.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 0.1.0
 **/

const debug = require('debug')('backend:db');

class DB {
  constructor(config) {
    this.config = null;
  }

  setConfig(config) {
    debug('setConfig', 'set');
  }

  search() {

  }

  get() {

  }

  put() {
    
  }
}

module.exports = new DB;
