
/**
 * Test dependencies.
 */

var assert = require('assert');
var many = require('..');

describe('basic', function() {

	it('should call once', function() {
		var fn = many(function(name, data) {
			assert.equal(name, 'olivier');
			assert.equal(data.foo, 'bar');
		});

		fn('olivier', {
			foo: 'bar'
		});
	});

	it('should call once or many times', function() {
		var fn = many(function(name, data) {
			assert.equal(name, 'olivier');
			assert.equal(data.foo, 'bar');
		});

		fn({
			'olivier' : {
				foo: 'bar'
			}
		});
	});

	it('should call many times', function() {
		var keys = [];
		var values = [];
		var fn = many(function(name, data) {
			keys.push(name);
			values.push(data);
		});

		fn({
			'foo' : 'bar',
			'beep' : 'boop'
		});
		assert.deepEqual(keys, ['foo', 'beep']);
		assert.deepEqual(values, ['bar', 'boop']);
	});

});

describe('context', function() {

	it('should keep the context when called once', function(done) {
		var scope = {
			name: 'olivier'
		};
		scope.fn = many(function() {
			if(this.name === 'olivier') done();
		});

		scope.fn('foo');
	});

	it('should keep the context when called multiple times', function(done) {
		var scope = {
			name: 'olivier'
		};
		scope.fn = many(function() {
			if(this.name === 'olivier') done();
		});

		scope.fn({
			'foo' : {}
		});
	});

});