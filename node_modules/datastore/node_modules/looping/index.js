
/**
 * Expose 'loop'
 */

module.exports = loop;

function loop(obj, fn, scope) {
  scope = scope || this;
  if(obj instanceof Array) loop.array(obj, fn, scope);
  else loop.object(obj, fn, scope);
};


/**
 * Object iteration.
 * 
 * @param  {Object}   obj   
 * @param  {Function} fn    
 * @param  {Object?}   scope 
 * @api private
 */

loop.object = function(obj, fn, scope) {
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      fn.call(scope, i, obj[i]);
    }
  }
}


/**
 * Array iteration.
 * 
 * @param  {Array}   obj   
 * @param  {Function} fn    
 * @param  {Object?}   scope 
 * @api private
 */

loop.array = function(obj, fn, scope) {
  for(var i = 0, l = obj.length; i < l; i++) {
    fn.call(scope, i, obj[i]);
  }
}