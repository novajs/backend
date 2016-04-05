/**
 * /auth route.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0.
 * @license MIT
 **/

'use strict';

const oauthorize = require('oauthorize');
const passport   = require('passport');

module.exports = (Router, dbctl) => {
  let server = oauthorize.createServer();

  Router.get('/dialog/authorize', (req, res) => {

  });
  Router.post('/dialog/authorize/decision', (req, res) => {

  });

  Router.post('/oauth/request_token', (req, res) => {
    passport.authenticate('consumer', { session: false }),
    server.requestToken(function(client, callbackURL, done) {
      var token = utils.uid(8)
        , secret = utils.uid(32)

      db.requestTokens.save(token, secret, client.id, callbackURL, function(err) {
        if (err) { return done(err); }
        return done(null, token, secret);
      });
    }),
    server.errorHandler()
  });
  
  Router.post('/oauth/access_token', (req, res) => {
    passport.authenticate('consumer', { session: false }),
    server.accessToken(
      function(requestToken, verifier, info, done) {
        if (verifier != info.verifier) { return done(null, false); }
        return done(null, true);
      },
      function(client, requestToken, info, done) {
        if (!info.approved) { return done(null, false); }
        if (client.id !== info.clientID) { return done(null, false); }

        var token = utils.uid(16)
          , secret = utils.uid(64)

        db.accessTokens.save(token, secret, info.userID, info.clientID, function(err) {
          if (err) { return done(err); }
          return done(null, token, secret);
        });
      }
    ),
    server.errorHandler()
  });

  return Router;
}
