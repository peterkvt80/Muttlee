
/**
 * Module dependencies.
 * @api private
 */

var loop = require('looping');


/**
 * Expose many.
 *
 * Only works when the first argument of a function
 * is a string.
 *
 * Examples:
 *
 *   var fn = many(function(name, data) {
 *     // do something
 *   });
 *   
 *   fn('bar', {});
 *   fn({
 *     'foo' : {},
 *     'beep' : {}
 *   });
 *
 * @param {Function}
 * @return {Function} 
 * @api public
 */

module.exports = function(fn) {
  var many = function(str, obj) {
    if(typeof str === 'object') loop(str, many, this);
    else fn.apply(this, arguments);
    return this;
  };
  return many;
};
