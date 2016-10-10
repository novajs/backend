/**
 * /metadata endpoint.
 *
 * @author Jared Allard <jaredallard@tritonjs.com>
 * @license MIT
 * @version 1.0.0
 **/

'use strict';

const Redis = require('../../lib/redis.js');

let redis = Redis({
  db: 2
});

module.exports = (Router, dbctl) => {
  const Auth = require('../../lib/auth.js');
  const debug      = require('debug')('backend:route:metadata');

  let auth        = new Auth(dbctl);

  Router.use(auth.requireAuthentication());

  /**
   * GET /
   *
   * Get the metadata endpoint version.
   **/
  Router.get('/', (req, res) => {
    return res.success({
      version: 'v1'
    })
  });

  /**
   * GET /users/active
   *
   * Get an array of currently online users.
   **/
  Router.get('/users/active', (req, res) => {
    let pipe   = redis.pipeline();
    let stream = redis.scanStream();
    stream.on('data', (resultKeys) => {
      // `resultKeys` is an array of strings representing key names
      for (let i = 0; i < resultKeys.length; i++) {
        pipe.hgetall(resultKeys[i]);
      }
    });

    // Handle the data.
    let online = [];
    stream.on('end', () => {
      pipe.exec((err, res) => {
        res.forEach(wrkspce => {
          wrkspce = wrkspce[1];
          if(wrkspce.online) {
            online.push(wrkspce.username);
          }
        });
      });
    });

    return res.success(online);
  });

  return Router;
};
