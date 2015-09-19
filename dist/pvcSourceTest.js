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
    xit('should make a streamSource from a Readable stream');
    return xit('should leave a pvc stream unchanged');
  });

}).call(this);
