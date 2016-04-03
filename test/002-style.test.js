/**
 * Check the code style
 **/

const lint = require('mocha-eslint');

// Array of paths to lint
// Note: a seperate Mocha test will be run for each path and each file which
// matches a glob pattern
const paths = [
  'index.js',
  'express.js'
];

// Specify style of output
const options = {};
options.formatter = 'compact';

// Only display warnings if a test is failing
options.alwaysWarn = false; // Defaults to true, always show warnings

// Increase the timeout of the test if linting takes to long
options.timeout = 5000; // Defaults to the global mocha timeout option

// Run the tests
lint(paths, options);
