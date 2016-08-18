/**
 * Manage and determine assignment validity.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 * @license MIT.
 **/

const debug = require('debug')('novajs:assignment');
const uuid  = require('node-uuid');

class Assignment {
  constructor(dbctl) {
    this.db = dbctl;
    this.collection = 'assignments';

    debug('constuctor', 'let it begin.');
  }

  getByID(assignmentID) {
    return this.isValid(assignmentID);
  }

  list() {
    return this.db.search(this.collection, '*')
  }

  search(syntax) {
    return this.db.search(this.collection, syntax);
  }

  isValid(id) {
    return new Promise((fulfill, reject) => {
      this.db.search(this.collection, 'id', id)
        .then(results => {
          return fulfill(results);
        })
        .catch(err => {
          if(err === 'CONDITIONS_NOT_MET') return reject('ASSIGNMENT_INVALID')
          return reject(err);
        })
    })
  }

  update(id, name, info) {
    return new Promise((fulfill, reject) => {
      if(typeof info !== 'object') {
        return reject('param "info" is not and object.');
      }

      if(!info.repo || !info.desc) {
        return reject('param "info" is missing key "repo" or "desc".');
      }

      let OBJ = {
        name: name,
        info: info,
        updated: Date.now()
      };

      this.db.update(this.collection, id, OBJ)
      .then(() => {
        debug('assignments:db', 'successfully added to the database');
        return fulfill(OBJ);
      })
      .catch(err => {
        debug('assignments:db', 'error:', err);
        return reject(err);
      }) //db#put
    })
  }

  new(name, info) {
    return new Promise((fulfill, reject) => {
      let assignment_uuid = uuid.v4();

      if(typeof info !== 'object') {
        return reject('param "info" is not and object.');
      }

      if(!info.repo || !info.desc) {
        return reject('param "info" is missing key "repo" or "desc".');
      }

      debug('new assignment uuid is:', assignment_uuid);

      this.db.search(this.collection, 'name', name)
      .then((results) => {
        return reject('ASSIGNMENT_ALREADY_EXISTS')
      }) // db#search.then
      .catch(err => {
        if(!err === 'CONDITIONS_NOT_MET') {
          return reject('INTERNAL');
        }

        let OBJ = {
          id: assignment_uuid,
          name: name,
          info: info,
          created: Date.now(),
          updated: Date.now()
        };

        this.db.put(this.collection, assignment_uuid, OBJ)
        .then(() => {
          debug('assignments:db', 'successfully added to the database');
          return fulfill(OBJ);
        })
        .catch(err => {
          debug('assignments:db', 'error:', err);
          return reject(err);
        }) //db#put
      }) // db#search
    }) // promise
  }
}


module.exports = Assignment;
