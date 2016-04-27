var each = require('each');
var assert = require('assert');

function compare(obj1, obj2){
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

describe('Iteration Object', function(){
  it('should iterate through each key/value pair', function(){
    var obj = {
      name : 'olivier',
      github : 'bredele'
    };
    var results = {};
    each(obj, function(key, val){
      results[key] = val;
    });
    assert(compare(obj, results));
  });
});

describe('Iteration Array', function(){
  it('should iterate through each values', function(){
    var obj = ['olivier', 'bredele'];
    var results = [];
    //keys are array index
    each(obj, function(key, val){
      results[key] = val;
    });
    assert(compare(obj, results));
  });
});


describe('Iteration scope', function(){
  it('should apply callback in passed scope', function(){
    var obj = ['olivier', 'wietrich'];

    var scope = {
      names : []
    };

    each(obj, function(key, val){
      this.names.push(val);
    }, scope);

    assert(compare(scope.names, obj));
  });
});

describe('Iteration Array-like', function(){

});