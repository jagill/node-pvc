(function() {
  var ArraySource, AsyncFilter, AsyncMap, Debounce, Doto, Duplex, Filter, Map, Readable, Separate, Splitter, Transform, _path, fs, ref, util,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  fs = require('fs');

  _path = require('path');

  ref = require('stream'), Transform = ref.Transform, Duplex = ref.Duplex, Readable = ref.Readable;

  util = require('util');


  /*
  Convert an array into a Readable stream.
  
  source = new ArraySource([1, 2])
  source.read() # 1
  source.read() # 2
  source.read() # null
   */

  ArraySource = (function(superClass) {
    extend(ArraySource, superClass);

    function ArraySource(array, opt) {
      this.array = array;
      if (opt == null) {
        opt = {};
      }
      opt.objectMode = true;
      ArraySource.__super__.constructor.call(this, opt);
      this.index = 0;
    }

    ArraySource.prototype._read = function() {
      if (this.index >= this.array.length) {
        return this.push(null);
      } else {
        this.push(this.array[this.index]);
        return this.index++;
      }
    };

    return ArraySource;

  })(Readable);

  exports.arraySource = function(arr) {
    return new ArraySource(arr);
  };


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
      opt.objectMode = true;
      Separate.__super__.constructor.call(this, opt);
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
          this.emit('error', "Found non-array value: " + arr);
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

  Splitter = (function(superClass) {
    extend(Splitter, superClass);

    function Splitter(regex1) {
      var StringDecoder;
      this.regex = regex1 != null ? regex1 : /\r?\n/;
      Splitter.__super__.constructor.call(this, {
        objectMode: true
      });
      StringDecoder = require('string_decoder').StringDecoder;
      this._decoder = new StringDecoder('utf8');
      this._buffer = '';
    }

    Splitter.prototype._transform = function(chunk, encoding, done) {
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

    Splitter.prototype._flush = function(done) {
      if (this._buffer) {
        this.push(this._buffer, 'utf8');
      }
      return done();
    };

    return Splitter;

  })(Transform);

  exports.splitter = function(regex) {
    return new Splitter(regex);
  };


  /*
  Map a given stream (in objectMode) through a provided function f: (in) -> out .
  Drops any null or undefined return values from f.
   */

  Map = (function(superClass) {
    extend(Map, superClass);

    function Map(f1, opt) {
      this.f = f1;
      if (opt == null) {
        opt = {};
      }
      opt.objectMode = true;
      Map.__super__.constructor.call(this, opt);
    }

    Map.prototype._transform = function(i, encoding, done) {
      var e, out;
      try {
        out = this.f(i);
        if (out != null) {
          this.push(out);
        }
        return done();
      } catch (_error) {
        e = _error;
        return this.emit('error', e);
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
  concurrency: number of concurrent asynchronous calls allowed.
   */

  AsyncMap = (function(superClass) {
    extend(AsyncMap, superClass);

    function AsyncMap(opt, f) {
      if (typeof opt === 'function') {
        f = opt;
        opt = {};
      }
      this.f = f;
      opt.objectMode = true;
      AsyncMap.__super__.constructor.call(this, opt);
      this.concurrency = opt.concurrency;
    }

    AsyncMap.prototype._transform = function(i, encoding, done) {
      return this.f(i, (function(_this) {
        return function(err, out) {
          if (err) {
            return _this.emit('error', err);
          } else {
            if (out != null) {
              _this.push(out);
            }
            return done();
          }
        };
      })(this));
    };

    return AsyncMap;

  })(Transform);

  exports.mapAsync = function(f, opt) {
    return new AsyncMap(f, opt);
  };

  Filter = (function(superClass) {
    extend(Filter, superClass);

    function Filter(f1, opt) {
      this.f = f1;
      if (opt == null) {
        opt = {};
      }
      opt.objectMode = true;
      Filter.__super__.constructor.call(this, opt);
    }

    Filter.prototype._transform = function(i, encoding, done) {
      var e, keep;
      try {
        keep = this.f(i);
        if (keep) {
          this.push(i);
        }
        return done();
      } catch (_error) {
        e = _error;
        return this.emit('error', e);
      }
    };

    return Filter;

  })(Transform);

  exports.filter = function(f) {
    return new Filter(f);
  };

  AsyncFilter = (function(superClass) {
    extend(AsyncFilter, superClass);

    function AsyncFilter(f1, opt) {
      this.f = f1;
      if (opt == null) {
        opt = {};
      }
      opt.objectMode = true;
      AsyncFilter.__super__.constructor.call(this, opt);
      this.concurrency = opt.concurrency;
    }

    AsyncFilter.prototype._transform = function(i, encoding, done) {
      return this.f(i, (function(_this) {
        return function(err, keep) {
          if (err) {
            return _this.emit('error', err);
          } else {
            if (keep) {
              _this.push(i);
            }
            return done();
          }
        };
      })(this));
    };

    return AsyncFilter;

  })(Transform);

  exports.filterAsync = function(f, opt) {
    return new AsyncFilter(f, opt);
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
  Just do a function to a stream, don't modify anything.
  XXX: Not yet working, don't use.
   */

  Doto = (function(superClass) {
    extend(Doto, superClass);

    function Doto(options, f) {
      if (typeof options === 'function') {
        f = options;
        options = {};
      }
      options.objectMode = true;
      this.options = options;
      this.f = f;
      Doto.__super__.constructor.call(this, options);
    }

    Doto.prototype._transform = function(x, encoding, done) {
      this.f(x);
      return this.push(x);
    };

    return Doto;

  })(Transform);

  exports.doto = function(opt, f) {
    return new Doto(opt, f);
  };

}).call(this);