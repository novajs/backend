/**
 * Get some info about this container!
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1.0.0
 **/
const fs = require('fs');

let raw_id = fs.readFileSync('/proc/self/cgroup', 'utf8');
let id_rgx = /1[\w:\/=]+\/([\w\d]+)/g.exec(raw_id);

let ID = null;
if(id_rgx) {
  ID = id_rgx[1];
}

let CONTAINER_ID       = null,
    CONTAINER_SHORT_ID = null;
    
if(!ID) {
  console.error('Failed to determine the ID of the container');
} else {
  CONTAINER_ID = ID;
  CONTAINER_SHORT_ID = ID.substr(0, 12);
}

module.exports = (fn) => {
  return fn({
    short: CONTAINER_SHORT_ID,
    long: CONTAINER_ID
  })
}
