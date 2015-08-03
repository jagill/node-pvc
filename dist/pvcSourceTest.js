(function() {
  var assert, gather, pvc, sinon;

  assert = require('chai').assert;

  sinon = require('sinon');

  pvc = require('./pvc');

  gather = function(s, callback) {
    var errors, out;
    out = [];
    errors = null;
    s.on('exception', function(error) {
      if (errors == null) {
        errors = [];
      }
      return errors.push(error);
    });
    s.on('data', function(data) {
      return out.push(data);
    });
    return s.on('end', function() {
      return callback(errors, out);
    });
  };

  xdescribe('source', function() {
    it('should make an array source from an array', function() {
      var s;
      s = pvc.source([1, 2]);
      return gather(s, function(err, out) {
        assert.ok(err == null);
        assert.deepEqual(out, [2, 3]);
        return done();
      });
    });
    xit('should make a streamSource from a Readable stream');
    return xit('should leave a pvc stream unchanged');
  });

  xdescribe('chaining', function() {
    describe('map', function() {
      var input;
      input = [1, 2];
      it('should map correctly', function(done) {
        var s;
        s = pvc.source(input).map(function(x) {
          return x + 1;
        });
        return gather(s, function(err, out) {
          assert.ok(err == null);
          assert.deepEqual(out, [2, 3]);
          return done();
        });
      });
      it('should pass errors through', function(done) {
        var s;
        s = pvc.source(input).map(function(x) {
          if (x === 1) {
            throw 'bad';
          }
          return x + 1;
        });
        return gather(s, function(errors, out) {
          assert.deepEqual(errors, ['bad']);
          assert.deepEqual(out, [3]);
          return done();
        });
      });
      it('should pipe two maps correctly', function(done) {
        var s;
        s = pvc.source(input).map(function(x) {
          return x + 1;
        }).map(function(x) {
          return x + 10;
        });
        return gather(s, function(err, out) {
          assert.ok(err == null);
          assert.deepEqual(out, [12, 13]);
          return done();
        });
      });
      return it('should pipe exceptions through', function(done) {
        var s;
        s = pvc.source(input).map(function(x) {
          if (x === 1) {
            throw 'bad';
          }
          return x + 1;
        }).map(function(x) {
          return x + 10;
        });
        return gather(s, function(errors, out) {
          assert.deepEqual(errors, ['bad']);
          assert.deepEqual(out, [13]);
          return done();
        });
      });
    });
    return describe('filter', function() {
      var input;
      input = [1, 2, 4, 5];
      it('should chain correctly', function(done) {
        var s;
        s = pvc.source(input).filter(function(x) {
          return x % 2;
        }).filter(function(x) {
          return x === 5;
        });
        return gather(s, function(errors, out) {
          assert.ok(typeof err === "undefined" || err === null);
          assert.deepEqual(out, [5]);
          return done();
        });
      });
      return it('should chain with map', function(done) {
        var s;
        s = pvc.source(input).map(function(x) {
          return x + 1;
        }).filter(function(x) {
          return x % 2;
        });
        return gather(s, function(errors, out) {
          assert.ok(typeof err === "undefined" || err === null);
          assert.deepEqual(out, [3, 5]);
          return done();
        });
      });
    });
  });

}).call(this);
