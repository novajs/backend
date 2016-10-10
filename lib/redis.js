/**
 * Get a redis instance from Docker or host.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 2.0.0
 **/

const url   = require('url');
const debug = require('debug')('backend:redis')
const redis = require('ioredis');


let Redis = (config = {}) => {
  let only_meta = false;

  // Deprecated only_meta support.
  if(typeof config !== 'object' && config) {
    config = {}; // Handle bad input.
    only_meta = true;
    debug('deprecated', 'using only_meta style');
  }

  // Defaults.
  config.parser            = 'hiredis';
  config.dropBufferSupport = true;


  // Try to determine the redis host. Docker || Rancher
  let redis_string = process.env.REDIS_1_PORT || process.env.REDIS_PORT;

  if(redis_string) {
    let redis_url    = url.parse(redis_string);

    debug('init', 'using docker');
    config.host = redis_url.hostname;
    config.port = redis_url.port;
  } else {
    debug('init', 'not on docker, assuming defaults');
    config.host = '127.0.0.1';
    config.port = 6379;
  }


  debug('redis', 'found redis on', config.host+':'+config.port);

  // Deprecated Syntax support.
  if(typeof only_meta === 'boolean' && only_meta) {
    return config;
  }

  return new redis(config)
}

module.exports = Redis;
