/**
 * Minor Abastraction layer for Database control.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 * @license MIT
 **/

'use strict';

module.exports = class Db {

    /**
     * @constructor
     **/
    constructor() {
      console.log('db abstraction layer loaded')
    }

    /**
     * Load a database method.
     *
     * @param {String} path - path to abstraction file.
     * @param {Object} opts - object of options to pass to the constructor.
     *
     * @returns {Boolean} success status
     **/
    useDatabase(path, opts) {
      let abs;
      try {
        abs = require(path);
      } catch(err) {
        console.error('Failed to load abstraction subsystem.');
        throw err;
      }

      // instance the layer
      abs = new abs(opts);

      console.log('using db type', abs.name, 'v'+abs.version);
      this.methods = abs;
    }

    /**
     * Check if we have a layer loaded.
     *
     * @returns {success} success or not.
     **/
    isLoaded() {
      if(!this.methods) {
        throw 'Abstraction subsystem not loaded';
      }
    }

    /**
     * Select a Database
     *
     * @param {String} name - database name
     * @returns {Promise} promise object
     **/
    use(name) {
      this.isLoaded();

      return this.methods.selectDatabase(name);
    }

    /**
     * Run a Query.
     *
     * @param {String} query - query to execute
     * @param {Object} vars  - prepard variables to insert.
     *
     * @returns {Promise} promise object
     **/
    query(query, vars) {
      this.isLoaded();

      return this.methods.query(query, vars);
    }
}
