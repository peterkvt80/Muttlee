
/**
 * Test dependencies.
 */

var each = require('..');
var assert = require('assert');



describe('object', function() {

  it('should iterate through each key/value pair', function() {
    var obj = {
      name : 'olivier',
      github : 'bredele'
    };
    var results = {};
    each(obj, function(key, val){
      results[key] = val;
    });
    assert.deepEqual(obj, results);
  });
});

describe('array', function() {

  it('should iterate through each values', function(){
    var obj = ['olivier', 'bredele'];
    var results = [];
    each(obj, function(key, val){
      results[key] = val;
    });
    assert.deepEqual(obj, results);
  });
});


// note: should we keep the scope?
describe('Iteration scope', function() {

  it('should apply callback in passed scope', function(){
    var obj = ['olivier', 'wietrich'];

    var scope = {
      names : []
    };

    each(obj, function(key, val){
      this.names.push(val);
    }, scope);

    assert.deepEqual(scope.names, obj);
  });
});

