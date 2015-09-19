(function() {
  var assert, pvc, sinon;

  assert = require('chai').assert;

  sinon = require('sinon');

  pvc = require('./pvc');

  describe('toArray', function() {
    it('should collect objects into an array', function(done) {
      var src;
      src = [1, 2, 3, 4];
      return pvc.source(src).toArray(function(exs, arr) {
        assert.isNull(exs);
        assert.deepEqual(arr, src);
        return done();
      });
    });
    return it('should pass on exceptions', function(done) {
      var src;
      src = [1, 2, 3];
      return pvc.source(src).map(function(x) {
        if (x === 2) {
          throw new Error('bad');
        } else {
          return x;
        }
      }).toArray(function(exs, arr) {
        assert.isNotNull(exs);
        assert.equal(exs.length, 1);
        assert.equal(exs[0].message, 'bad');
        assert.deepEqual(arr, [1, 3]);
        return done();
      });
    });
  });

  describe('reduce', function() {
    it('should reduce a list', function(done) {
      return pvc.source([1, 3, 4, 2]).reduce(function(x, y) {
        return x + y;
      }, function(exs, d) {
        assert.isNull(exs);
        assert.equal(d, 10);
        return done();
      });
    });
    return it('should take an initial value', function(done) {
      return pvc.source([1, 3, 4, 2]).reduce(0, function(x, y) {
        return x + 1;
      }, function(exs, d) {
        assert.isNull(exs);
        assert.equal(d, 4);
        return done();
      });
    });
  });

  describe('count', function() {
    return it('count items in a stream', function(done) {
      return pvc.source([1, 3, 4, 2]).count(function(exs, d) {
        assert.isNull(exs);
        assert.equal(d, 4);
        return done();
      });
    });
  });

}).call(this);
