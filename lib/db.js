/**
 * Database Layer.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 0.1.0
 **/

'use strict';

const arangojs = require('arangojs');
const aqb      = require('aqb');
const debug    = require('debug')('backend:db');

class DB {
  constructor(config) {
    if(typeof config !== 'object') {
      debug('constructor', 'deffered until this#setConfig');
      return null;
    }

    let user = config.db.user;
    let pass = config.db.password;
    let host = config.db.host;
    let port = config.db.port;
    let db   = config.db.name;

    this.db     = arangojs({
      url: `http://${user}:${pass}@${host}:${port}`,
      databaseName: db
    });

    debug('constructor', 'success');
  }

  /**
   * Search, but pull all results and process on the client side.
   *
   * @param {String} collection - to search through.
   * @param {Array} params      - conditions, all eq.
   *
   * @returns {Promise} I PROMISE
   **/
  searchClient(collection, params) {
    // example
    /*
      params = [
        ['mykey', '==', 'value']
      ]
    */
    return new Promise((fulfill, reject) => {
      debug('searchClient', 'query', collection);

      return this.db.query(
        aqb.for('u')
        .in(collection)
        .return('u')
      )
      .then(cursor => {
        debug('searchClient', 'got cursor back')

        // retrieve all the cursor values.
        cursor.all()
        .then(vals => {
          debug('searchClient', 'exhausted cursor.')
          vals.forEach(val => {
            let pint = val.data_wrapper;
            let req  = params.length;
            let met  = 0;

            // process each param.
            params.forEach(con => {
              let key = con[0]; // key to eval against.
              let opr = con[1]; // operator (equals, etc.)
              let val = con[2]; // value it should meet.

              let KEY = pint[key];

              // map dot notation.
              if(key.indexOf('.') !== -1) {
                KEY = key.split('.').reduce((o,i)=>o[i], pint);

                debug('searchClient', key, '->', KEY);
              }

              let res = false;

              // equal operator.
              if(opr == '==' || opr == '===') res = KEY === val;

              // not equal operator.
              if(opr == '!=' || opr == '!==') res = KEY !== val;

              if(!res) {
                debug(KEY, '~?', val);
                return;
              }

              met++;
            })

            // if not all conditions met, then reject.
            if(met !== req) return reject('CONDITIONS_NOT_MET');

            debug('searchClient', 'all conditions met');

            val.data_wrapper.key = val._key;
            return fulfill(val.data_wrapper)
          });
        })
      })
    })
  }

  _transform(data) {
    let trf = data.data_wrapper;
    trf.key = data._key;

    return trf;
  }

  /**
   * Search using the DB filter.
   *
   * @param {String} collection - collection to "use"
   * @param {String} key        - key to match against.
   * @param {Var}    value      - value to match.
   *
   * @returns {Promise} promise object.
   **/
  search(collection, key, value) {
    debug('search', 'collection ->', collection);
    debug('search', key, '->', value)

    let KEY = 'u.data_wrapper.'+key;

    debug('search', 'filter key set:', KEY);
    return new Promise((fulfill, reject) => {
      return this.db.query(
        aqb.for('u')
        .in(collection)
        .filter(aqb.eq(KEY, '@value'))
        .return('u'),
        {
          value: value
        }
      )
      .then(cursor => {
        cursor.next()
        .then(val => {
          if(!val) return reject('CONDITIONS_NOT_MET');
          debug('search', 'cursor:', val)
          return fulfill(this._transform(val));
        })
      })
      .catch(reject);
    });
  }

  /**
   * Return all the results of dataset.
   *
   * @param {String} collection - collection name
   * @returns {Promise} std promise done/catch.
   **/
  all(collection) {
    return new Promise((fulfill, reject) => {
      this.db.query(
        aqb.for('u')
        .in(collection)
        .return('u')
      )
      .then(cursor => {
        cursor.all()
        .then(fulfill);
      })
      .catch(reject);
    });
  }

  /**
   * Get a Key's value.
   *
   * @param {String} collection - collection to search in.
   * @param {String} key - key path.
   *
   * @returns {Promise} w/ data on success.
   **/
  get(collection, key) {
    return arangojs.aql`
      RETURN DOCUMENT(${collection}/${key})
    `;
  }

  /**
   * Post Data into a collection
   *
   * @param {String} collection - to insert into.
   * @param {Variable} data - data to insert.
   *
   * @returns {Promise} API Result.
   **/
  post(collection, data) {
    return this.put(collection, null, data);
  }

  /**
   * Put Data into a collection
   *
   * @param {String} collection - to insert into.
   * @param {String} key - key to insert into.
   * @param {Variable} data - data to insert.
   *
   * @returns {Promise} API Result.
   **/
  put(collection, key, data) {
    let DATA = {
      data_wrapper: data
    };

    if(key) {
      debug('put', 'manually specified key:', key);
      DATA._key = key;
    }

    return this.db.query(aqb.insert(aqb(DATA)).into(collection));
  }

  /**
   * Post Data into a collection
   *
   * @param {String} collection  - to interact with
   * @param {String} key         - key to remove.
   *
   * @returns {Promise} API Result.
   **/
  remove(collection, key) {
    return this.db.query(arangojs.aql`
      REMOVE "${key}" IN ${collection}
    `)
  }

  /**
   * Update the data in a collection
   *
   * @param {String} collection - to insert into.
   * @param {String} key        - key to modify
   * @param {Var} data          - data to update with.
   *
   * @returns {Promise} promise.
   **/
  update(collection, key, data) {
    let DATA = {
      data_wrapper: data
    };

    return this.db.query(aqb
      .for('u')
      .in('users')
      .filter(aqb.eq('u._key', key))
      .update('u')
      .with(aqb(DATA))
      .in(collection)
    )
  }
}

module.exports = DB;
