/**
 * Authentication Middleware.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1.0.0
 **/

const debug = require('debug')('backend:auth');

module.exports = class Auth {
  constructor() {
    this.db = require('./db.js');
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


    }
  }

  /**
   * Check if an APIKEY is valid.
   *
   * @returns {Boolean} is valid.
   **/
  isValid() {

  }

  /**
   * Get a user object from APIKEY from the database.
   *
   * @returns {Object} User Object.
   **/
  getUserObject() {

  }
}
