(function() {
  var assert, pvc, sinon;

  assert = require('chai').assert;

  sinon = require('sinon');

  pvc = require('./pvc');

  describe('arraySource', function() {
    return it('should pass array elements', function() {
      var s;
      s = new pvc.arraySource([1, 2]);
      assert.equal(1, s.read());
      assert.equal(2, s.read());
      return assert.isNull(s.read());
    });
  });

  describe('separate', function() {
    it('should separate an array', function() {
      var s;
      s = pvc.separate();
      s.write([1, 2]);
      assert.equal(1, s.read());
      assert.equal(2, s.read());
      return assert.isNull(s.read());
    });
    it('should throw an error for a non array', function(done) {
      var s;
      s = pvc.separate();
      s.on('error', function(err) {
        return done();
      });
      s.write(1);
      return s.read();
    });
    it('should pass a non-array if lax=true', function() {
      var s;
      s = pvc.separate({
        lax: true
      });
      s.on('error', function(err) {
        return assert.fail('Should not throw an error');
      });
      s.write(1);
      assert.equal(1, s.read());
      return assert.isNull(s.read());
    });
    it('should pass child arrays unseparated', function() {
      var s;
      s = pvc.separate();
      s.write([1, ['a', 'b'], 2]);
      assert.equal(1, s.read());
      assert.deepEqual(['a', 'b'], s.read());
      assert.equal(2, s.read());
      return assert.isNull(s.read());
    });
    return it('should separate child arrays if recursive=true', function() {
      var s;
      s = pvc.separate({
        recursive: true
      });
      s.write([1, ['a', 'b'], 2]);
      assert.equal(1, s.read());
      assert.equal('a', s.read());
      assert.equal('b', s.read());
      assert.equal(2, s.read());
      return assert.isNull(s.read());
    });
  });

  describe('splitter', function() {
    it('should split on newlines', function() {
      var s;
      s = pvc.splitter();
      s.write('abc\ndef\n');
      assert.equal('abc', s.read());
      assert.equal('def', s.read());
      return assert.isNull(s.read());
    });
    it('should flush remainder', function() {
      var s;
      s = pvc.splitter();
      s.write('abc\ndef');
      s.end();
      assert.equal('abc', s.read());
      assert.equal('def', s.read());
      return assert.isNull(s.read());
    });
    it('should split on DOS newlines', function() {
      var s;
      s = pvc.splitter();
      s.write('abc\r\ndef\r\n');
      assert.equal('abc', s.read());
      assert.equal('def', s.read());
      return assert.isNull(s.read());
    });
    return it('should accept other regexes', function() {
      var s;
      s = pvc.splitter(/\s+/);
      s.write('ab cd\tef  gh\nij');
      s.end();
      assert.equal('ab', s.read());
      assert.equal('cd', s.read());
      assert.equal('ef', s.read());
      assert.equal('gh', s.read());
      assert.equal('ij', s.read());
      return assert.isNull(s.read());
    });
  });

  describe('map', function() {
    it('should map inputs to outputs', function() {
      var s;
      s = pvc.map(function(x) {
        return 2 * x;
      });
      s.write(1);
      s.write(3);
      assert.equal(2, s.read());
      assert.equal(6, s.read());
      return assert.isNull(s.read());
    });
    it('should drop nulls/undefineds', function() {
      var s;
      s = pvc.map(function(x) {
        if (x === 2) {
          return void 0;
        }
        if (x === 3) {
          return null;
        }
        return x;
      });
      s.write(1);
      s.write(2);
      s.write(3);
      s.write(4);
      assert.equal(1, s.read());
      assert.equal(4, s.read());
      return assert.isNull(s.read());
    });
    return it('should emit an error on map errors', function(done) {
      var s;
      s = pvc.map(function() {
        throw new Error();
      });
      s.on('error', function() {
        return done();
      });
      return s.write(1);
    });
  });

  describe('mapAsync', function() {
    it('should map inputs to outputs', function(done) {
      var expectedResults, s;
      s = pvc.mapAsync(function(x, cb) {
        return process.nextTick(function() {
          return cb(null, 2 * x);
        });
      });
      expectedResults = [2, 6];
      s.on('readable', function() {
        return assert.equal(expectedResults.shift(), s.read());
      });
      s.on('finish', function() {
        assert.equal(0, expectedResults.length);
        return done();
      });
      s.write(1);
      s.write(3);
      return s.end();
    });
    it('should drop nulls/undefineds', function(done) {
      var expectedResults, s;
      s = pvc.mapAsync(function(x, cb) {
        return process.nextTick(function() {
          if (x === 2) {
            return cb(null, void 0);
          } else if (x === 3) {
            return cb(null, null);
          } else {
            return cb(null, x);
          }
        });
      });
      expectedResults = [1, 4];
      s.on('readable', function() {
        return assert.equal(expectedResults.shift(), s.read());
      });
      s.on('finish', function() {
        assert.equal(0, expectedResults.length);
        return done();
      });
      s.write(1);
      s.write(2);
      s.write(3);
      s.write(4);
      return s.end();
    });
    return it('should emit an error on map errors', function(done) {
      var s;
      s = pvc.mapAsync(function(x, cb) {
        return cb(new Error());
      });
      s.on('error', function() {
        return done();
      });
      return s.write(1);
    });
  });

  describe('filter', function() {
    it('should filter values', function() {
      var s;
      s = pvc.filter(function(x) {
        return x % 2;
      });
      s.write(1);
      s.write(2);
      s.write(3);
      assert.equal(1, s.read());
      assert.equal(3, s.read());
      return assert.isNull(s.read());
    });
    return it('should emit an error on filter errors', function(done) {
      var s;
      s = pvc.filter(function() {
        throw new Error();
      });
      s.on('error', function() {
        return done();
      });
      return s.write(1);
    });
  });

  describe('filterAsync', function() {
    it('should filter values', function(done) {
      var expectedResults, s;
      s = pvc.filterAsync(function(x, cb) {
        return process.nextTick(function() {
          return cb(null, x % 2);
        });
      });
      expectedResults = [1, 3];
      s.on('readable', function() {
        return assert.equal(expectedResults.shift(), s.read());
      });
      s.on('finish', function() {
        assert.equal(0, expectedResults.length);
        return done();
      });
      s.write(1);
      s.write(2);
      s.write(3);
      return s.end();
    });
    return it('should emit an error on filter errors', function(done) {
      var s;
      s = pvc.filterAsync(function(x, cb) {
        return process.nextTick(function() {
          return cb(new Error());
        });
      });
      s.on('error', function() {
        return done();
      });
      return s.write(1);
    });
  });

  describe('debounce', function() {
    var clock;
    clock = null;
    before(function() {
      return clock = sinon.useFakeTimers();
    });
    after(function() {
      return clock.restore();
    });
    it('should not flush before timeout', function() {
      var s;
      s = pvc.debounce({
        delay: 200
      });
      s.write(1);
      s.write(2);
      assert.isNull(s.read());
      clock.tick(1);
      return assert.isNull(s.read());
    });
    it('should flush after timeout', function() {
      var s;
      s = pvc.debounce({
        delay: 200
      });
      s.write(1);
      s.write(2);
      clock.tick(201);
      return assert.deepEqual([1, 2], s.read());
    });
    return it('should flush on end', function() {
      var s;
      s = pvc.debounce({
        delay: 200
      });
      s.write(1);
      s.end();
      return assert.deepEqual([1], s.read());
    });
  });

  describe('merge', function() {
    it('should emit a single stream unchanged', function() {
      var in1, s;
      in1 = new pvc.arraySource([1, 2]);
      s = new pvc.merge([in1]);
      assert.equal(s.read(), 1);
      assert.equal(s.read(), 2);
      return assert.isNull(s.read());
    });
    return it('should combine two streams', function() {
      var c, i, in1, in2, len, output, ref, results, s, x;
      in1 = new pvc.arraySource(['a', 'b']);
      in2 = new pvc.arraySource(['c', 'd', 'e']);
      s = new pvc.merge([in1, in2]);
      output = {};
      while (x = s.read()) {
        output[x] = true;
      }
      ref = ['a', 'b', 'c', 'd', 'e'];
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        c = ref[i];
        results.push(assert.isTrue(output[c]));
      }
      return results;
    });
  });

  describe('zip', function() {
    it('should zip a single stream', function() {
      var in1, s;
      in1 = new pvc.arraySource([1, 2]);
      s = new pvc.zip({
        num: in1
      });
      assert.deepEqual(s.read(), {
        num: 1
      });
      assert.deepEqual(s.read(), {
        num: 2
      });
      return assert.isNull(s.read());
    });
    it('should zip two streams', function() {
      var in1, in2, s;
      in1 = new pvc.arraySource([1, 2]);
      in2 = new pvc.arraySource(['a', 'b']);
      s = new pvc.zip({
        num: in1,
        alph: in2
      });
      assert.deepEqual(s.read(), {
        num: 1,
        alph: 'a'
      });
      assert.deepEqual(s.read(), {
        num: 2,
        alph: 'b'
      });
      return assert.isNull(s.read());
    });
    it('should finish after the shortest input finishes', function() {
      var in1, in2, s;
      in1 = new pvc.arraySource([1, 2, 3]);
      in2 = new pvc.arraySource(['a', 'b']);
      s = new pvc.zip({
        num: in1,
        alph: in2
      });
      assert.deepEqual(s.read(), {
        num: 1,
        alph: 'a'
      });
      assert.deepEqual(s.read(), {
        num: 2,
        alph: 'b'
      });
      return assert.isNull(s.read());
    });
    return it('should finish immediately with an empty array', function() {
      var in1, in2, in3, s;
      in1 = new pvc.arraySource([1, 2]);
      in2 = new pvc.arraySource(['a', 'b']);
      in3 = new pvc.arraySource([]);
      s = new pvc.zip({
        num: in1,
        alph: in2,
        empty: in3
      });
      return assert.isNull(s.read());
    });
  });

  describe('doto', function() {
    it('should call the given function on the elements', function() {
      var s, total;
      total = 0;
      s = new pvc.doto(function(x) {
        return total += x;
      });
      s.write(1);
      s.read();
      assert.equal(total, 1);
      s.write(3);
      s.read();
      return assert.equal(total, 4);
    });
    return it('should pass through the elements unchanged', function() {
      var a1, a2, s;
      s = new pvc.doto(function() {});
      a1 = {};
      a2 = {};
      s.write(a1);
      s.write(a2);
      assert.equal(s.read(), a1);
      assert.equal(s.read(), a2);
      return assert.isNull(s.read());
    });
  });

}).call(this);
