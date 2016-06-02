/**
 * /assignments route.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0.
 * @license MIT
 **/

'use strict';

module.exports = (Router, dbctl) => {
  const auth = require('../../lib/auth.js');

  Router.get('/', (req, res) => {
    return res.send({
      error: "invalid_route"
    });
  });

  return Router;
}
