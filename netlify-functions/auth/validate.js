// Compatibility wrapper for older local tooling. The deployed route uses
// ../auth-validate.js so authentication behavior stays in one implementation.
module.exports = require('../auth-validate');
