/**
 * Authentication Middleware.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1.0.0
 **/

const debug  = require('debug')('backend:auth');
const scrypt = require('scrypt');

module.exports = class Auth {
  constructor(db) {
    this.db = db;
    this.SCRYPT_PARAMS = {N: 10, r:8, p:8};
    debug('constructor', 'setup');
  }

  /**
   * Return a ExpressJS middleware for checking authentication.
   *
   * @return {Function} ExpressJS middleware.
   **/
  requireAuthentication() {
    debug('express', 'generated middleware');
    return (req, res, next) => {
      let PROVIDED_AUTH = req.get('Authentication') || req.body.apikey;

      // if is valid, continue down the request chain.
      return next();
    }
  }

  /**
   * Check if an APIKEY is valid.
   *
   * @param {String} password - plain text ascii password.
   * @param {String} hash     - hex representation of scrypt.
   *
   * @returns {Boolean} is valid.
   **/
  isValid(password, hash) {
    //Asynchronous with promise
    return new Promise((fulfill, reject) => {
      console.log(hash, password);
      scrypt.verifyKdf(new Buffer(hash, 'hex'), password)
      .then(valid => {
        debug('isValid', valid);
        return fulfill(valid);
      }, err => {
        return reject(err);
      });
    })
  }

  /**
   * Generate an scrypt hash.
   *
   * @param {String} password - ascii password string.
   *
   * @returns {Promise} with then result of base64 encoded string.
   **/
  generateHash(password) {
    return scrypt.kdf(password, this.SCRYPT_PARAMS)
  }

  /**
   * Get a user object from APIKEY from the database.
   *
   * @returns {Object} User Object.
   **/
  getUserObject(username) {
    return new Promise((fulfill, reject) => {
      this.db.search('users', 'username:'+username)
      .then(results => {
        if(results.body.count === 0) return reject('MATCHED_NONE');
        return fulfill(results.body.results);
      })
      .fail(err => {
        return reject(err);
      });
    });
  }
}
