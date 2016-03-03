(function() {
  var assert, pvc, sinon;

  assert = require('chai').assert;

  sinon = require('sinon');

  pvc = require('./pvc');

  describe('separate', function() {
    it('should separate an array', function(done) {
      return pvc.source([[1, 2]]).separate().toArray(function(exs, arr) {
        assert.isNull(exs);
        assert.deepEqual(arr, [1, 2]);
        return done();
      });
    });
    it('should throw an error for a non array', function(done) {
      return pvc.source([1]).separate().toArray(function(exs, arr) {
        assert.equal(exs.length, 1);
        assert.equal(arr.length, 0);
        return done();
      });
    });
    it('should pass a non-array if lax=true', function(done) {
      return pvc.source([1]).separate({
        lax: true
      }).toArray(function(exs, arr) {
        assert.isNull(exs);
        assert.deepEqual(arr, [1]);
        return done();
      });
    });
    it('should pass child arrays unseparated', function(done) {
      return pvc.source([[1, ['a', 'b'], 2]]).separate({
        lax: true
      }).toArray(function(exs, arr) {
        assert.isNull(exs);
        assert.deepEqual(arr, [1, ['a', 'b'], 2]);
        return done();
      });
    });
    return it('should separate child arrays if recursive=true', function(done) {
      return pvc.source([[1, ['a', 'b'], 2]]).separate({
        recursive: true
      }).toArray(function(exs, arr) {
        assert.isNull(exs);
        assert.deepEqual(arr, [1, 'a', 'b', 2]);
        return done();
      });
    });
  });

  describe('split', function() {
    it('should split on newlines', function() {
      var s;
      s = pvc.source().split();
      s.write('abc\ndef\n');
      assert.equal('abc', s.read());
      assert.equal('def', s.read());
      return assert.isNull(s.read());
    });
    it('should flush remainder', function() {
      var s;
      s = pvc.source().split();
      s.write('abc\ndef');
      s.end();
      assert.equal('abc', s.read());
      assert.equal('def', s.read());
      return assert.isNull(s.read());
    });
    it('should split on DOS newlines', function() {
      var s;
      s = pvc.source().split();
      s.write('abc\r\ndef\r\n');
      assert.equal('abc', s.read());
      assert.equal('def', s.read());
      return assert.isNull(s.read());
    });
    return it('should accept other regexes', function() {
      var s;
      s = pvc.source().split(/\s+/);
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
    it('should map inputs to outputs', function(done) {
      return pvc.source([1, 3]).map(function(x) {
        return 2 * x;
      }).toArray(function(exs, arr) {
        assert.isNull(exs);
        assert.deepEqual(arr, [2, 6]);
        return done();
      });
    });
    it('should drop nulls/undefineds', function(done) {
      return pvc.source([1, 2, 3, 4]).map(function(x) {
        if (x === 2) {
          return void 0;
        }
        if (x === 3) {
          return null;
        }
        return x;
      }).toArray(function(exs, arr) {
        assert.isNull(exs);
        assert.deepEqual(arr, [1, 4]);
        return done();
      });
    });
    return it('should emit an exception on map errors', function(done) {
      return pvc.source([1, 2]).map(function() {
        throw new Error();
      }).toArray(function(exs, arr) {
        assert.equal(exs.length, 2);
        assert.equal(arr.length, 0);
        return done();
      });
    });
  });

  describe('mapAsync', function() {
    it('should map inputs to outputs', function(done) {
      var expectedResults, results, s;
      s = pvc.source().mapAsync(function(x, cb) {
        return process.nextTick(function() {
          return cb(null, x * 2);
        });
      });
      expectedResults = [2, 4, 6, 8];
      results = [];
      s.on('data', function(x) {
        return results.push(x);
      });
      s.on('finish', function() {
        assert.deepEqual(results, expectedResults);
        return done();
      });
      s.write(1);
      s.write(2);
      s.write(3);
      s.write(4);
      return s.end();
    });
    it('should feed toArray correctly', function(done) {
      return pvc.source([1, 3]).mapAsync(function(x, cb) {
        return process.nextTick(function() {
          return cb(null, 2 * x);
        });
      }).toArray(function(exs, arr) {
        assert.isNull(exs);
        assert.deepEqual(arr, [2, 6]);
        return done();
      });
    });
    it('should drop nulls/undefineds', function(done) {
      var expectedResults, results, s;
      s = pvc.source().mapAsync(function(x, cb) {
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
      results = [];
      s.on('data', function(x) {
        return results.push(x);
      });
      s.on('finish', function() {
        assert.deepEqual(results, expectedResults);
        return done();
      });
      s.write(1);
      s.write(2);
      s.write(3);
      s.write(4);
      return s.end();
    });
    it('should emit an exception on map errors', function(done) {
      var s;
      s = pvc.source().mapAsync(function(x, cb) {
        return cb(new Error());
      });
      s.on('exception', function() {
        return done();
      });
      return s.write(1);
    });
    return it('should respect concurrency option', function(done) {
      var checkN, concurrency, i, j, n, reachedMax, ref, results, s, total;
      total = 10;
      concurrency = 4;
      reachedMax = false;
      n = 0;
      checkN = function() {
        if (concurrency === n) {
          return reachedMax = true;
        } else {
          return assert.isAbove(concurrency, n);
        }
      };
      s = pvc.source().mapAsync({
        concurrency: concurrency
      }, function(x, cb) {
        n++;
        checkN();
        return setTimeout(function() {
          n--;
          return cb(null, x);
        }, 100);
      });
      for (i = j = 0, ref = total; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
        s.write(i);
      }
      s.end();
      results = [];
      s.on('data', function(data) {
        return results.push(data);
      });
      return s.on('end', function() {
        assert.isTrue(reachedMax);
        assert.equal(results.length, total);
        return done();
      });
    });
  });

  describe('filter', function() {
    it('should filter values', function(done) {
      return pvc.source([1, 2, 3]).filter(function(x) {
        return x % 2;
      }).toArray(function(exs, arr) {
        assert.isNull(exs);
        assert.deepEqual(arr, [1, 3]);
        return done();
      });
    });
    return it('should emit an exception on filter errors', function(done) {
      return pvc.source([1, 2, 3]).filter(function() {
        throw new Error();
      }).toArray(function(exs, arr) {
        assert.equal(exs.length, 3);
        assert.equal(arr.length, 0);
        return done();
      });
    });
  });

  describe('filterAsync', function() {
    it('should filter values', function(done) {
      var expectedResults, s;
      s = pvc.source().filterAsync(function(x, cb) {
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
    return it('should emit an exception on filter errors', function(done) {
      var s;
      s = pvc.source().filterAsync(function(x, cb) {
        return process.nextTick(function() {
          return cb(new Error());
        });
      });
      s.on('exception', function() {
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
      s = pvc.source().debounce({
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
      s = pvc.source().debounce({
        delay: 200
      });
      s.write(1);
      s.write(2);
      clock.tick(300);
      return assert.deepEqual(s.read(), [1, 2]);
    });
    return it('should flush on end', function() {
      var s;
      s = pvc.source().debounce({
        delay: 200
      });
      s.write(1);
      s.end();
      return assert.deepEqual(s.read(), [1]);
    });
  });

  describe('merge', function() {
    it('should emit a single stream unchanged', function() {
      var in1, s;
      in1 = pvc.source([1, 2]);
      s = pvc.merge([in1]);
      assert.equal(s.read(), 1);
      assert.equal(s.read(), 2);
      return assert.isNull(s.read());
    });
    return it('should combine two streams', function() {
      var c, in1, in2, j, len, output, ref, results1, s, x;
      in1 = pvc.source(['a', 'b']);
      in2 = pvc.source(['c', 'd', 'e']);
      s = pvc.merge([in1, in2]);
      output = {};
      while (x = s.read()) {
        output[x] = true;
      }
      ref = ['a', 'b', 'c', 'd', 'e'];
      results1 = [];
      for (j = 0, len = ref.length; j < len; j++) {
        c = ref[j];
        results1.push(assert.isTrue(output[c]));
      }
      return results1;
    });
  });

  describe('zip', function() {
    it('should zip a single stream', function() {
      var in1, s;
      in1 = pvc.source([1, 2]);
      s = pvc.zip({
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
      in1 = pvc.source([1, 2]);
      in2 = pvc.source(['a', 'b']);
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
      in1 = pvc.source([1, 2, 3]);
      in2 = pvc.source(['a', 'b']);
      s = pvc.zip({
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
      in1 = pvc.source([1, 2]);
      in2 = pvc.source(['a', 'b']);
      in3 = pvc.source([]);
      s = pvc.zip({
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
      s = pvc.source().doto(function(x) {
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
      a1 = {};
      a2 = {};
      s = pvc.source([a1, a2]).doto(function(x) {});
      s.write(a1);
      s.write(a2);
      assert.equal(s.read(), a1);
      assert.equal(s.read(), a2);
      return assert.isNull(s.read());
    });
  });

  describe('limit', function() {
    return it('should limit the incoming stream', function(done) {
      return pvc.source([1, 2, 3]).limit(2).toArray(function(exs, arr) {
        assert.isNull(exs);
        assert.deepEqual(arr, [1, 2]);
        return done();
      });
    });
  });

  describe('skip', function() {
    return it('should skip the beginning of the incoming stream', function(done) {
      return pvc.source([1, 2, 3]).skip(2).toArray(function(exs, arr) {
        assert.isNull(exs);
        assert.deepEqual(arr, [3]);
        return done();
      });
    });
  });

  describe('combinations', function() {
    return it('should chain write', function() {
      var s;
      s = pvc.source().map(function(x) {
        return x * 2;
      }).map(function(x) {
        return x * 2;
      });
      s.write(1);
      return assert.equal(s.read(), 4);
    });
  });

}).call(this);
