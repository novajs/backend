/**
 * Database Test.
 **/

'use strict';

const Db = require('./lib/db.js');

let db   = new Db();
db.useDatabase('./db.arango.js', {
  host: '127.0.0.1'
})

db.use('ot').then(() => {
  db.query('FOR u IN messages RETURN u')
    .then(res => {
      console.log(res);
    })
    .catch(err => {
      console.error(err);
    })
}).catch((err) => {
  console.error(err);
});
