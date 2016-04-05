/**
 * ArangoDB Abstraction Layer.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 * @license MIT
 **/

'use strict';

const arangojs = require('arangojs');

module.exports = class ArangoDB {
  constructor(opts) {
    console.log('db::arangodb', 'abs loaded');

    this.db = new arangojs(opts);
  }

  get name() {
    return 'arangodb';
  }

  get version() {
    return '1.0.0';
  }

  query(query, vars) {
    return new Promise((success, error) => {
      this.db.query(query, vars)
      .then(cursor => {
        success(cursor.all());
      })
      .catch(err => {
        error(err);
      })
    });
  }

  selectDatabase(name) {
    console.log('db::arangodb', 'abs::selectDatabase =', name);

    return new Promise((success) => {
      this.db.useDatabase(name);
      return success();
    });
  }

  createDatabase() {

  }

  removeDatabase() {

  }
}
