(function() {
  var PassThrough, assert, gather, pvc, sinon;

  assert = require('chai').assert;

  sinon = require('sinon');

  PassThrough = require('stream').PassThrough;

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

  describe('source', function() {
    it('should pass array elements', function() {
      var s;
      s = pvc.source([1, 2]);
      assert.equal(1, s.read());
      assert.equal(2, s.read());
      return assert.isNull(s.read());
    });
    it('should create a passthrough for no arguments', function() {
      var s;
      s = pvc.source();
      assert.isNull(s.read());
      s.write(1);
      assert.equal(s.read(), 1);
      return assert.isNull(s.read());
    });
    it('should make a streamSource from a Readable stream', function(done) {
      var pass, s;
      pass = new PassThrough();
      s = pvc.source(pass);
      s.split().toArray(function(err, arr) {
        assert.isNull(err);
        assert.equal(arr.length, 2);
        assert.equal(arr[0], 'this is the first line');
        assert.equal(arr[1], 'and the second');
        return done();
      });
      s.write('this is the f');
      s.write('irst line\nan');
      s.write('d the se');
      s.write('cond');
      return s.end();
    });
    it('should leave a pvc readable stream unchanged', function() {
      var s, s2;
      s = pvc.source();
      s2 = pvc.source(s);
      return assert.strictEqual(s, s2);
    });
    return it('should leave a pvc transform stream unchanged', function() {
      var s, s2;
      s = pvc.source().map(function(x) {
        return x;
      });
      s2 = pvc.source(s);
      return assert.strictEqual(s, s2);
    });
  });

}).call(this);
