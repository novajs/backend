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

  Router.get('/', auth.requireAuthentication(), (req, res) => {
    let USER = req.user;

    // remove secrets.
    delete USER.api;
    delete USER.password;

    return res.success(USER);
  });

  Router.post('/new', (req, res) => {
    let REQ = req.body;

    if(!REQ.username || !REQ.email || !REQ.password || !REQ.display_name) {
      return res.error(400);
    }

    REQ.username = REQ.username.toLowerCase();

    async.waterfall([
      // Get the SCRYPT hash.
      (next) => {
        auth.generateHash(REQ.password)
        .then(result => {
          debug('auth:hash', 'generated scrypt hash.')
          return next(false, result.toString('hex'));
        }, err => {
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

  Router.post('/delete', (req, res) => {
    let REQ = req.body;

    if(!REQ.username || !REQ.password) {
      return res.error(400)
    }

    async.waterfall([
      // Find the User by Username.
      (next) => {
        auth.getUserObject(REQ.username)
        .then(result => {
          let user = result[0].value;
          user.key = result[0].path.key;

          debug('remove:db', 'fetched secrets');

          return next(false, user)
        })
        .catch(err => {
          console.log(err);
          return next(err);
        });
      },

      // Check if the password is valid.
      (user, next) => {
        auth.isValid(REQ.password, user.password)
        .then(valid => {
          if(!valid) {
            return next('Invalid Auth')
          }

          debug('remove:authcheck', 'is VALID');
          return next(false, user);
        })
        .catch(err => {
          return next(err);
        });
      },

      // delete the user's key.
      (user, next) => {
        dbctl.remove('users', user.key, true)
        .then(() => {
          return next();
        })
        .fail(() => {
          return next('FAILED_TO_REMOVE_USER_OBJ');
        })
      }
    ], err => {
      if(err) {
        if(err === 'MATCHED_NONE') {
          return res.error(400, 'USER_NOT_FOUND');
        }

        return res.error(501, 'FAILED_TO_DELETE_USER');
      }

      return res.success('USER_DELETED');
    })
  });

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
          .catch(err => {
            return next(err);
          });
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

  Router.get('/list', (req, res) => {
    return dbctl.search('users', '*')
    .fail(() => {
      return res.error(501);
    })
    .then(results => {
      console.log('got results');

      let users = [];

      results.body.results.forEach(user => {
        let data = user.value;

        // push a new object to avoid using delete.
        users.push({
          username: data.username,
          email: data.email,
          class: data.class
        });
      });

      return res.success(users);
    });
  });

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
