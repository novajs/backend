/**
 * /assignments route.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0.
 * @license MIT
 **/

'use strict';

module.exports = (Router, dbctl) => {
  const Auth = require('../../lib/auth.js');
  const Assignment = require('../../lib/assignment.js');

  let auth        = new Auth(dbctl);
  let assignments = new Assignment(dbctl);

  Router.get('/', (req, res) => {
    return res.send({
      error: 'invalid_route'
    });
  });

  Router.get('/list', (req, res) => {
    assignments.list()
    .then(results => {
      let cache = [];

      results.body.results.forEach(a => {
        cache.push(a.value);
      });

      cache.sort(function(a,b){
        return new Date(b.date) - new Date(a.date);
      });

      return res.success(cache);
    })
    .catch(() => {
      return res.error('INTERNAL_ASSIGNMENT_DB_SEARCH_FAILED');
    })
  })

  Router.get('/by-id/:id', (req, res) => {
    let ID = req.params.id;

    if(!ID) {
      return res.error(405, 'INVALID_INPUT');
    }

    assignments.getByID(ID)
    .then(a => {
      return res.success(a);
    })
    .catch(err => {
      return res.error(err);
    })
  })

  Router.post('/new', auth.requireAuthentication(), (req, res) => {
    let username = req.user.username;

    const REQ = req.body;

    if(!REQ.info || !REQ.name) {
      return res.error(401, 'INVALID_INPUT');
    }

    if(username !== 'jaredallard') {
      return res.error('ERR_INVALID_AUTH_SCOPE');
    }

    assignments.new(REQ.name, REQ.info)
      .then((data) => {
        return res.success(data);
      })
      .catch(err => {
        return res.error(err);
      })
  })

  Router.post('/finished', auth.requireAuthentication(), (req, res) => {
    let aid = req.body.id;

    if(!aid) return res.error('INVALID_INPUT');

    console.log(req.user)

    assignments.complete(req.user, aid)
      .then(data => {
        return res.success(data);
      })
      .catch(err => {
        return res.error(err);
      })
  })

  Router.post('/update', auth.requireAuthentication(), (req, res) => {
    let username = req.user.username;

    const REQ = req.body;

    if(!REQ.info || !REQ.name ||!REQ.id) {
      return res.error(401, 'INVALID_INPUT');
    }

    if(username !== 'jaredallard') {
      return res.error('ERR_INVALID_AUTH_SCOPE');
    }

    assignments.update(REQ.id, REQ.name, REQ.info)
      .then((data) => {
        return res.success(data);
      })
      .catch(err => {
        return res.error(err);
      })
  })

  return Router;
}
