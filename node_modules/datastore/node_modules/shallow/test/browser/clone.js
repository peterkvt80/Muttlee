var clone = require('clone');
var assert = require('assert');




describe('clone', function(){
  it('should clone an Array', function(){
    var arr = ['olivier', 'bredele'];
    var copy = clone(arr);
    assert('olivier' === copy[0]);
    assert('bredele' === copy[1]);    
  });

  it('should clone an Object', function(){
    var obj = {
      name : 'olivier',
      github : {
        name : 'olivier'
      }
    };
    var copy = clone(obj);
    assert('olivier' === copy.name);
    assert('olivier' === copy.github.name);    
  });
});
