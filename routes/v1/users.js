/**
 * /users
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0.
 * @license MIT
 **/

'use strict';

const async = require('async');
const uuid  = require('node-uuid');
const debug = require('debug')('route:users');

module.exports = (Router, dbctl) => {
  const Auth = require('../../lib/auth.js');
  let auth   = new Auth(dbctl);

  /**
   * GET /users
   *
   * Get authenticated users info.
   **/
  Router.get('/', auth.requireAuthentication(), (req, res) => {
    let USER = req.user;

    // remove secrets.
    delete USER.api;
    delete USER.password;

    return res.success(USER);
  });

  /**
   * POST /users/new
   *
   * Create a new user.
   **/
  Router.post('/new', (req, res) => {
    let REQ = req.body;

    let valid_opts = [
      'username',
      'email',
      'password',
      'display_name'
    ];

    let invalid = false;
    valid_opts.forEach(key => {
      if(!REQ[key]) {
        invalid = true;
      }
    });

    if(invalid) return res.error('ERR_INVALID_INPUT');

    REQ.username = REQ.username.toLowerCase();

    async.waterfall([
      // Get the SCRYPT hash.
      (next) => {
        auth.generateHash(REQ.password)
        .then(result => {
          debug('auth:hash', 'generated scrypt hash.')
          return next(false, result.toString('hex'));
        })
        .catch(err => {
          debug('auth:hash', 'scrypt hash generation failed');
          return next(err);
        });
      },

      // Insert into the DB
      (hash, next) => {
        const SECRET = uuid.v4();
        const PUBLIC = uuid.v4();

        debug('auth:api', 'generated UUIDs');

        dbctl.post('users', {
          username: REQ.username,
          email:    REQ.email,
          password: hash,
          api: {
            public: PUBLIC,
            secret: SECRET
          }
        })
          .then(() => {
            debug('auth:db', 'successfully added to the database');
            return next();
          })
          .fail(err => {
            debug('auth:db', 'error:', err);
            return next(err);
          })
      }
    ], err => {
      if(err) {
        return res.error(501, 'FAILED_TO_CREATE_USER');
      }

      return res.success('USER_CREATED');
    });
  });

  /**
   * POST /users/delete
   *
   * Delete authenticated user.
   **/
  Router.post('/delete', auth.requireAuthentication(), (req, res) => {
    dbctl.remove('users', req.user.id, true)
    .then(() => {
      return res.success('USER_DELETED');
    })
    .fail(() => {
      return res.error('ERR_FAILED_TO_REMOVE_USER');
    });
  });

  /**
   * POST /users/authflow
   *
   * Get API Token Credentials.
   **/
  Router.post('/authflow', (req, res) => {
    let REQ = req.body;

    // no password OR, no username & no email OR, yes username & yes email.
    if(!REQ.password || (!REQ.username && !REQ.email) || (REQ.username && REQ.email)) {
      debug('authflow:prevalid', 'failed');
      debug('authflow:prevalid', REQ);
      return res.error(400)
    }

    // function the keyProvider for SSO
    let keyProvider = (result, done) => {
      let user = result[0].value;

      let keys = {
        p: user.api.public,
        passphrase: user.password,
        s: user.api.secret
      }

      return done(false, keys)
    };

    async.waterfall([
      // Find the User by Username.
      (next) => {
        if(!REQ.username) return next(false, false);

        debug('authflow:retrieveAuth', 'method: username');

        auth.getUserObject(REQ.username)
          .then(result => {
            return keyProvider(result, next);
          })
          .catch(next);
      },

      // check if using email
      (keys, next) => {
        if(!REQ.email) return next(false, keys);

        debug('authflow:retrieveAuth', 'method: email');

        auth.getUserObjectByEmail(REQ.email)
          .then(result => {
            return keyProvider(result, next);
          })
          .catch(err => {
            debug('authflow:retrieveAuth', 'error:', err);
            return next('AUTH_RETRIEVE_FAILED');
          })
      },

      // Check if the password is valid.
      (keys, next) => {
        debug('authflow:authcheck', 'check authentication');

        auth.isValid(REQ.password, keys.passphrase)
        .then(valid => {
          if(!valid) {
            return next('Invalid Auth')
          }

          debug('authflow:authcheck', 'is VALID');

          return next(false, keys);
        })
        .catch(err => {
          return next(err);
        });
      }
    ], (err, key) => {
      if(err) {
        debug('authflow:final', 'INVALID')
        return res.error('AUTHFLOW_INVALID');
      }

      return res.success({
        public: key.p,
        secret: key.s,
        method: REQ.username ? 'username' : 'email'
      })
    });
  })

  /**
   * GET /users/list
   *
   * Get users.
   **/
  Router.get('/list', (req, res) => {
    return dbctl.search('users', '*')
    .fail(() => {
      return res.error(501);
    })
    .then(results => {
      let users = [];

      results.body.results.forEach(user => {
        let data = user.value;

        // push a new object to avoid using delete.
        users.push({
          display_name: data.display_name,
          username: data.username,
          email: data.email
        });
      });

      return res.success(users);
    });
  });

  /**
   * POST /users/update
   *
   * Update user data.
   **/
  Router.post('/update', auth.requireAuthentication(), (req, res) => {
    let REQ = req.body;

    let valid_opts = [
      'display_name',
      'username',
      'email',
      'password'
    ];

    let USER = req.user;

    delete USER.docker;
    delete USER.api;
    delete USER.password;

    // TODO: Validate User Credentials Here.
    delete REQ.password;

    let opts = {};
    Object.keys(REQ).forEach(key => {
      let value = REQ[key];

      if(valid_opts.indexOf(key) === -1) {
        debug('update:processOpts', 'invalid opt given', key);
        return;
      }

      // add to the new object
      opts[key] = value;
    });

    dbctl.update('users', USER.id, opts).then(() => {
      res.success({
        added: opts,
        user: USER
      })
    })
    .fail(err => {
      return res.error(err);
    })
  })

  return Router;
}
