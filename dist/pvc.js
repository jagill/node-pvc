(function() {
  var ArraySource, AsyncMap, Debounce, Duplex, Map, Merge, PvcReadable, Readable, Separate, Split, StreamSource, Transform, Zip, _path, fs, ref, util,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  fs = require('fs');

  _path = require('path');

  ref = require('stream'), Transform = ref.Transform, Duplex = ref.Duplex, Readable = ref.Readable;

  util = require('util');


  /*
  Convert incoming arrays into their constituent elements.
  
  Additional opt fields:
  lax: If true, just push non-Arrays.  Default is to throw an error.
  recursive: If true, separate any arrays that were found from the separation
    procedure.  Default is to only separate one level.
   */

  Separate = (function(superClass) {
    extend(Separate, superClass);

    function Separate(opt) {
      if (opt == null) {
        opt = {};
      }
      Separate.__super__.constructor.call(this, {
        objectMode: true
      });
      this.lax = opt.lax;
      this.recursive = opt.recursive;
    }

    Separate.prototype._pushArray = function(arr) {
      return arr.forEach((function(_this) {
        return function(x) {
          if (_this.recursive && util.isArray(x)) {
            return _this._pushArray(x);
          } else {
            return _this.push(x);
          }
        };
      })(this));
    };

    Separate.prototype._transform = function(arr, encoding, done) {
      if (!util.isArray(arr)) {
        if (this.lax) {
          this.push(arr);
        } else {
          this.emit('exception', "Found non-array value: " + arr);
        }
      } else {
        this._pushArray(arr);
      }
      return done();
    };

    return Separate;

  })(Transform);

  exports.separate = function(opt) {
    return new Separate(opt);
  };


  /*
  Split an incoming stream on a given regex.
  regex: default newlines (/\r?\n/)
   */

  Split = (function(superClass) {
    extend(Split, superClass);

    function Split(regex1) {
      var StringDecoder;
      this.regex = regex1 != null ? regex1 : /\r?\n/;
      Split.__super__.constructor.call(this, {
        objectMode: true
      });
      StringDecoder = require('string_decoder').StringDecoder;
      this._decoder = new StringDecoder('utf8');
      this._buffer = '';
    }

    Split.prototype._transform = function(chunk, encoding, done) {
      var j, len, line, lines;
      this._buffer += this._decoder.write(chunk);
      lines = this._buffer.split(this.regex);
      this._buffer = lines.pop();
      for (j = 0, len = lines.length; j < len; j++) {
        line = lines[j];
        this.push(line, 'utf8');
      }
      return done();
    };

    Split.prototype._flush = function(done) {
      if (this._buffer) {
        this.push(this._buffer, 'utf8');
      }
      return done();
    };

    return Split;

  })(Transform);

  exports.split = function(regex) {
    return new Split(regex);
  };


  /**
  Just do a function to a stream, don't modify anything.
   */

  exports.doto = function(f) {
    return new Map(function(x) {
      f(x);
      return x;
    });
  };


  /*
  Map a given stream (in objectMode) through a provided function f: (in) -> out .
  Drops any null or undefined return values from f.
   */

  Map = (function(superClass) {
    extend(Map, superClass);

    function Map(f1) {
      this.f = f1;
      Map.__super__.constructor.call(this, {
        objectMode: true
      });
    }

    Map.prototype._transform = function(i, encoding, done) {
      var e, out;
      try {
        out = this.f(i);
        if (out != null) {
          return this.push(out);
        }
      } catch (_error) {
        e = _error;
        return this.emit('exception', e);
      } finally {
        done();
      }
    };

    return Map;

  })(Transform);

  exports.map = function(f) {
    return new Map(f);
  };


  /*
  Map a given stream (in objectMode) through a provided async function
  f: (in, callback), where callback: (err, out)
  Drops any null or undefined `out` values.
  
  Additional opt values:
  concurrency: number of concurrent asynchronous calls allowed.  Default unlimited.
   */

  AsyncMap = (function(superClass) {
    extend(AsyncMap, superClass);

    function AsyncMap(opt, f) {
      AsyncMap.__super__.constructor.call(this, {
        allowHalfOpen: true,
        objectMode: true
      });
      if (typeof opt === 'function') {
        f = opt;
        opt = {};
      }
      this.f = f;
      this.concurrency = opt.concurrency || 1;
      this.count = 0;
      this.dones = [];
      this.results = [];
      this.readerReady = false;
      this.finished = false;
      this.on('finish', (function(_this) {
        return function() {
          return _this.finished = true;
        };
      })(this));
    }

    AsyncMap.prototype._pump = function() {
      while (this.results.length) {
        this.readerReady = this.push(this.results.shift());
        if (!this.readerReady) {
          return;
        }
      }
    };

    AsyncMap.prototype._read = function(size) {
      this.readerReady = true;
      if (this.results.length) {
        return this._pump();
      } else {
        if (this.finished && this.count === 0) {
          return this.push(null);
        }
      }
    };

    AsyncMap.prototype._done = function() {
      var done;
      done = this.dones.shift();
      return typeof done === "function" ? done() : void 0;
    };

    AsyncMap.prototype._write = function(x, encoding, done) {
      this.dones.push(done);
      this.count++;
      this.f(x, (function(_this) {
        return function(err, out) {
          _this.count--;
          if (err) {
            _this.emit('exception', err);
          } else {
            if (out != null) {
              _this.results.push(out);
            }
            if (_this.readerReady) {
              _this._pump();
            }
          }
          return _this._done();
        };
      })(this));
      if (this.concurrency > this.count) {
        return this._done();
      }
    };

    return AsyncMap;

  })(Duplex);

  exports.mapAsync = function(opt, f) {
    return new AsyncMap(opt, f);
  };

  exports.filter = function(f) {
    return new Map(function(x) {
      if (f(x)) {
        return x;
      }
    });
  };

  exports.filterAsync = function(opt, f) {
    var g;
    if (typeof opt === 'function') {
      f = opt;
      opt = {};
    }
    g = function(x, callback) {
      return f(x, function(err, out) {
        x = out ? x : null;
        return callback(err, x);
      });
    };
    return new AsyncMap(opt, g);
  };


  /**
  Collects input, emitting an array of output after opt.delay ms of quiescence.
   */

  Debounce = (function(superClass) {
    extend(Debounce, superClass);

    function Debounce(opt) {
      if (opt == null) {
        opt = {};
      }
      if (!opt.delay) {
        throw new Error('Must supply options.delay in milliseconds');
      }
      opt.objectMode = true;
      Debounce.__super__.constructor.call(this, opt);
      this._delay = opt.delay;
      this._buffer = [];
      this._timeout = null;
    }

    Debounce.prototype._setFlushTimeout = function() {
      clearTimeout(this._timeout);
      return this._timeout = setTimeout((function(_this) {
        return function() {
          _this.push(_this._buffer);
          return _this._buffer = [];
        };
      })(this), this._delay);
    };

    Debounce.prototype._transform = function(x, encoding, done) {
      this._buffer.push(x);
      this._setFlushTimeout();
      return done();
    };

    Debounce.prototype._flush = function(done) {
      clearTimeout(this._timeout);
      if (this._buffer.length) {
        this.push(this._buffer);
      }
      return done();
    };

    return Debounce;

  })(Transform);

  exports.debounce = function(opt) {
    return new Debounce(opt);
  };


  /**
  Merge multiple streams into one.  The output stream will emit indescriminately
  from the input streams, with no order guarantees.  The parameter streams is
  an array of streams.
   */

  Merge = (function(superClass) {
    extend(Merge, superClass);

    function Merge(streams) {
      var j, len, s;
      this.streams = streams;
      for (j = 0, len = streams.length; j < len; j++) {
        s = streams[j];
        s.on('end', (function(_this) {
          return function() {
            var idx;
            idx = _this.streams.indexOf(s);
            _this.streams.splice(idx, 1);
            if (_this.streams.length === 0) {
              return _this.push(null);
            }
          };
        })(this));
        s.on('readable', (function(_this) {
          return function() {
            return _this._pump();
          };
        })(this));
      }
      Merge.__super__.constructor.call(this, {
        objectMode: true
      });
    }

    Merge.prototype._pump = function() {
      var chunk, j, len, ref1, s;
      ref1 = this.streams;
      for (j = 0, len = ref1.length; j < len; j++) {
        s = ref1[j];
        while ((chunk = s.read()) != null) {
          if (!this.push(chunk)) {
            return;
          }
        }
      }
    };

    Merge.prototype._read = function(size) {
      return this._pump();
    };

    return Merge;

  })(Readable);

  exports.merge = function(streams) {
    return new Merge(streams);
  };


  /**
  Zip multiple streams into one.  The output will be an object with
  the entries from each of the input streams, with the keys being the those
  given the streamMap.  It won't emit an output until
  it has an entry from each input.  If one of the input streams ends, this stream
  will also end.
  
  For example, if `zip = new Zip({num: numStream, alph: alphStream}), and
  numStream emits 1, 2, 3, ... , while
  alphStream emits 'one', 'two', 'three', ... ,
  then
  zip emits {num: 1, alph: 'one'}, {num: 2, alph: 'two'}, {num: 3, alph: 'three'},
   ...
   */

  Zip = (function(superClass) {
    extend(Zip, superClass);

    function Zip(streamMap1) {
      var name, ref1, s;
      this.streamMap = streamMap1;
      this.current = {};
      this.keys = [];
      ref1 = this.streamMap;
      for (name in ref1) {
        s = ref1[name];
        this.keys.push(name);
        s.on('end', (function(_this) {
          return function() {
            return _this.push(null);
          };
        })(this));
        s.on('readable', (function(_this) {
          return function() {
            return _this._pump();
          };
        })(this));
      }
      Zip.__super__.constructor.call(this, {
        objectMode: true
      });
    }

    Zip.prototype._pump = function() {
      var canPush, chunk, gotAllMissing, gotData, j, key, len, ref1, results;
      canPush = true;
      results = [];
      while (canPush) {
        gotAllMissing = true;
        gotData = false;
        ref1 = this.keys;
        for (j = 0, len = ref1.length; j < len; j++) {
          key = ref1[j];
          if (this.current[key] == null) {
            chunk = this.streamMap[key].read();
            if (chunk != null) {
              gotData = true;
              this.current[key] = chunk;
            } else {
              gotAllMissing = false;
            }
          }
        }
        if (gotData && gotAllMissing) {
          canPush = this.push(this.current);
          results.push(this.current = {});
        } else {
          results.push(canPush = false);
        }
      }
      return results;
    };

    Zip.prototype._read = function(size) {
      return this._pump();
    };

    return Zip;

  })(Readable);

  exports.zip = function(streamMap) {
    return new Zip(streamMap);
  };


  /*
  The above methods work for vanilla Node streams.
  However, we'd like a type of stream (PvcStream) that:
  1. propagates errors downstream, so that we can handle errors at the end.
  2. has the `map`/etc methods built in, for nicer chaining.
  
  Eg, we'd like to be able to do something like this:
  ```
  source.map(f)
    .mapAsync(g)
    .filter(h)
    .errors (error) ->
    .on 'data', (data) ->
  ```
  
  We can do this by changing the `pipe` method to:
  1. listen to errors of the piping stream, and emit them from the piped stream,
  2. converting the piped stream to a PvcStream, if it's a Readable,
  3. and returning the piped stream, to allow chaining.
   */

  PvcReadable = (function(superClass) {
    extend(PvcReadable, superClass);

    function PvcReadable() {
      PvcReadable.__super__.constructor.call(this, {
        objectMode: true
      });
      this.currentOut = this;
    }

    PvcReadable.prototype.pipe = function(writable) {
      var oldOut;
      oldOut = this.currentOut;
      this.currentOut = new StreamSource(writable);
      oldOut.on('exception', (function(_this) {
        return function(error) {
          return _this.currentOut.emit('exception', error);
        };
      })(this));
      PvcReadable.__super__.pipe.call(this, writable);
      return this.currentOut;
    };

    PvcReadable.prototype.exceptions = function(callback) {
      return this.on('exception', callback);
    };

    return PvcReadable;

  })(Readable);

  Object.getOwnPropertyNames(exports).forEach(function(key) {
    return PvcReadable.prototype[key] = function(f) {
      return this.pipe(exports[key](f));
    };
  });


  /*
  Convert an array into a Readable stream.
  
  source = new ArraySource([1, 2])
  source.read() # 1
  source.read() # 2
  source.read() # null
   */

  ArraySource = (function(superClass) {
    extend(ArraySource, superClass);

    function ArraySource(array) {
      this.array = array;
      ArraySource.__super__.constructor.apply(this, arguments);
      this.index = 0;
    }

    ArraySource.prototype._read = function() {
      if (this.index >= this.array.length) {
        this.push(null);
        return this.array = null;
      } else {
        this.push(this.array[this.index]);
        return this.index++;
      }
    };

    return ArraySource;

  })(PvcReadable);

  exports.arraySource = function(arr) {
    return new ArraySource(arr);
  };

  StreamSource = (function(superClass) {
    extend(StreamSource, superClass);

    function StreamSource(source1) {
      this.source = source1;
      StreamSource.__super__.constructor.apply(this, arguments);
      this.source.on('exception', (function(_this) {
        return function(ex) {
          return _this.emit('exception', ex);
        };
      })(this));
      this.source.on('end', (function(_this) {
        return function() {
          return _this.push(null);
        };
      })(this));
      this.source.on('readable', (function(_this) {
        return function() {
          return _this._pump();
        };
      })(this));
    }

    StreamSource.prototype._pump = function() {
      var chunk, results;
      results = [];
      while (chunk = this.source.read()) {
        if (!this.push(chunk)) {
          break;
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    StreamSource.prototype._read = function(size) {
      return this._pump();
    };

    return StreamSource;

  })(PvcReadable);

  exports.streamSource = function(source) {
    return new StreamSource(source);
  };

  exports.source = function(source) {
    if (source == null) {
      return new PassSource;
    }
    if (source instanceof PvcReadable) {
      return source;
    }
    if (source instanceof Readable) {
      return new StreamSource(source);
    }
    if (source instanceof Array) {
      return new ArraySource(source);
    }
  };

}).call(this);
