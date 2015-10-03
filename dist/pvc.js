(function() {
  var ArraySource, AsyncMap, Debounce, Duplex, Limit, Map, Merge, PassThrough, PvcPassThrough, PvcReadable, PvcTransform, Readable, Reduce, Separate, Sink, Skip, Split, ToArray, Transform, Writable, Zip, mixin, pipe, ref, registers,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  ref = require('stream'), Transform = ref.Transform, Duplex = ref.Duplex, Readable = ref.Readable, Writable = ref.Writable, PassThrough = ref.PassThrough;

  pipe = function(last, next) {
    last.on('exception', function(ex) {
      return next.emit('exception', ex);
    });
    return last.pipe(next);
  };

  registers = {};

  exports.mixin = mixin = function(obj, useBase) {
    var k, v;
    if (useBase == null) {
      useBase = false;
    }
    for (k in registers) {
      v = registers[k];
      if (useBase) {
        obj[k] = v;
      } else {
        obj.prototype[k] = v;
      }
    }
  };


  /*
   * Sources
  
  Sources are various ways to start pipes.
   */

  PvcReadable = (function(superClass) {
    extend(PvcReadable, superClass);

    function PvcReadable() {
      PvcReadable.__super__.constructor.call(this, {
        objectMode: true
      });
    }

    return PvcReadable;

  })(Readable);


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
      this.index = 0;
      ArraySource.__super__.constructor.call(this);
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
      Merge.__super__.constructor.call(this);
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

  })(PvcReadable);

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
      Zip.__super__.constructor.call(this);
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

  })(PvcReadable);

  exports.zip = function(streamMap) {
    return new Zip(streamMap);
  };

  exports.source = function(source) {
    if (source == null) {
      return new PvcPassThrough();
    }
    if (Array.isArray(source)) {
      return new ArraySource(source);
    }
    if (source instanceof PvcReadable || source instanceof PvcTransform) {
      return source;
    }
    if (source instanceof Readable) {
      mixin(source, true);
      return source;
    }
    throw new Error('Unable to make a source from object', source);
  };


  /*
   * Sinks
  
  These are various ways to collect the results of the pipe.
  They are constructed with a done function, which is called
  on end.  If the sink  has any results to return, the done
  function will be called with the collected exceptions as the
  first argument, and the collected results as the second.
   */

  Sink = (function(superClass) {
    extend(Sink, superClass);

    function Sink(done1) {
      this.done = done1;
      Sink.__super__.constructor.call(this, {
        objectMode: true
      });
      this.result = null;
      this.exceptions = [];
      this.on('exception', (function(_this) {
        return function(ex) {
          return _this.exceptions.push(ex);
        };
      })(this));
      this.on('finish', (function(_this) {
        return function() {
          var exs;
          exs = _this.exceptions.length === 0 ? null : _this.exceptions;
          return _this.done(exs, _this.result);
        };
      })(this));
    }

    return Sink;

  })(Writable);

  Reduce = (function(superClass) {
    extend(Reduce, superClass);

    function Reduce(initial, f, done) {
      if (done == null) {
        done = f;
        f = initial;
        initial = null;
      }
      Reduce.__super__.constructor.call(this, done);
      this.result = initial;
      this.f = f;
    }

    Reduce.prototype._write = function(x, encoding, done) {
      if (this.result == null) {
        this.result = x;
      } else {
        this.result = this.f(this.result, x);
      }
      return done();
    };

    return Reduce;

  })(Sink);

  registers.reduce = function(initial, f, done) {
    return pipe(this, new Reduce(initial, f, done));
  };

  registers.count = function(done) {
    return pipe(this, new Reduce(0, function(x, y) {
      return x + 1;
    }, done));
  };

  ToArray = (function(superClass) {
    extend(ToArray, superClass);

    function ToArray(done) {
      ToArray.__super__.constructor.call(this, done);
      this.result = [];
    }

    ToArray.prototype._write = function(x, encoding, done) {
      this.result.push(x);
      return done();
    };

    return ToArray;

  })(Sink);

  registers.toArray = function(done) {
    return pipe(this, new ToArray(done));
  };


  /*
   * Transforms
  
  Transforms are the workhorses, taking input
  from a previous stream and giving transformed
  data to the next stream.
   */

  PvcTransform = (function(superClass) {
    extend(PvcTransform, superClass);

    function PvcTransform() {
      PvcTransform.__super__.constructor.call(this, {
        objectMode: true
      });
    }

    return PvcTransform;

  })(Transform);

  PvcPassThrough = (function(superClass) {
    extend(PvcPassThrough, superClass);

    function PvcPassThrough() {
      return PvcPassThrough.__super__.constructor.apply(this, arguments);
    }

    PvcPassThrough.prototype._transform = function(x, encoding, done) {
      this.push(x);
      return done();
    };

    return PvcPassThrough;

  })(PvcTransform);

  Limit = (function(superClass) {
    extend(Limit, superClass);

    function Limit(n1) {
      this.n = n1;
      Limit.__super__.constructor.call(this);
    }

    Limit.prototype._transform = function(x, encoding, done) {
      if (this.n > 0) {
        this.push(x);
        this.n--;
      } else {
        this.push(null);
      }
      return done();
    };

    return Limit;

  })(PvcTransform);

  registers.limit = function(n) {
    return pipe(this, new Limit(n));
  };

  Skip = (function(superClass) {
    extend(Skip, superClass);

    function Skip(n1) {
      this.n = n1;
      Skip.__super__.constructor.call(this);
    }

    Skip.prototype._transform = function(x, encoding, done) {
      if (this.n > 0) {
        this.n--;
      } else {
        this.push(x);
      }
      return done();
    };

    return Skip;

  })(PvcTransform);

  registers.skip = function(n) {
    return pipe(this, new Skip(n));
  };


  /*
  Convert incoming arrays into their constituent elements.
  
  @param options (optional) A dictionary of parameters, including:
    lax: If true, just push non-Arrays.  Default is to throw an error.
    recursive: If true, separate any arrays that were found from the separation
      procedure.  Default is to only separate one level.
   */

  Separate = (function(superClass) {
    extend(Separate, superClass);

    function Separate(options) {
      if (options == null) {
        options = {};
      }
      this.lax = options.lax;
      this.recursive = options.recursive;
      Separate.__super__.constructor.call(this);
    }

    Separate.prototype._pushArray = function(arr) {
      return arr.forEach((function(_this) {
        return function(x) {
          if (_this.recursive && Array.isArray(x)) {
            return _this._pushArray(x);
          } else {
            return _this.push(x);
          }
        };
      })(this));
    };

    Separate.prototype._transform = function(arr, encoding, done) {
      if (!Array.isArray(arr)) {
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

  })(PvcTransform);

  registers.separate = function(options) {
    return pipe(this, new Separate(options));
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
      StringDecoder = require('string_decoder').StringDecoder;
      this._decoder = new StringDecoder('utf8');
      this._buffer = '';
      Split.__super__.constructor.call(this);
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

  })(PvcTransform);

  registers.split = function(regex) {
    return pipe(this, new Split(regex));
  };


  /*
  Map a given stream (in objectMode) through a provided function f: (in) -> out .
  Drops any null or undefined return values from f.
   */

  Map = (function(superClass) {
    extend(Map, superClass);

    function Map(f1) {
      this.f = f1;
      Map.__super__.constructor.call(this);
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

  })(PvcTransform);

  registers.map = function(f) {
    return pipe(this, new Map(f));
  };

  registers.filter = function(f) {
    return pipe(this, new Map(function(x) {
      if (f(x)) {
        return x;
      }
    }));
  };

  registers.doto = function(f) {
    return pipe(this, new Map(function(x) {
      f(x);
      return x;
    }));
  };


  /*
  Map a given stream (in objectMode) through a provided async function
  f: (in, callback), where callback: (err, out) ->
  Drops any null or undefined `out` values.
  
  Additional opt values:
  concurrency: number of concurrent asynchronous calls allowed.  Default in series.
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
          _this.finished = true;
          return _this._maybeFinish();
        };
      })(this));
    }

    AsyncMap.prototype._maybeFinish = function() {
      if (this.finished && this.count === 0) {
        return this.push(null);
      }
    };

    AsyncMap.prototype._pump = function() {
      var x;
      while (this.results.length) {
        x = this.results.shift();
        this.readerReady = this.push(x);
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
        return this._maybeFinish();
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

  registers.mapAsync = function(opt, f) {
    return pipe(this, new AsyncMap(opt, f));
  };

  registers.filterAsync = function(opt, f) {
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
    return pipe(this, new AsyncMap(opt, g));
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

  })(PvcTransform);

  registers.debounce = function(opt) {
    return pipe(this, new Debounce(opt));
  };


  /*
   * Mixins
  Now that we've registered everything, mixin the
  appropriate pieces.
   */

  mixin(PvcTransform);

  mixin(AsyncMap);

  mixin(PvcReadable);

}).call(this);
