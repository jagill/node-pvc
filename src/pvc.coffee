fs = require 'fs'
_path = require 'path'
{Transform, Duplex, Readable} = require 'stream'
util = require 'util'



class Limit extends Transform
  constructor: (@n) ->
    super objectMode: true

  _transform: (x, encoding, done) ->
    if @n > 0
      @push x
      @n--
    else
      @push null
    done()

exports.limit = (n) -> new Limit(n)

class Skip extends Transform
  constructor: (@n) ->
    super objectMode: true

  _transform: (x, encoding, done) ->
    if @n > 0
      @n--
    else
      @push x
    done()

exports.skip = (n) -> new Skip(n)

###
Convert incoming arrays into their constituent elements.

Additional opt fields:
lax: If true, just push non-Arrays.  Default is to throw an error.
recursive: If true, separate any arrays that were found from the separation
  procedure.  Default is to only separate one level.
###
class Separate extends Transform
  constructor: (opt={}) ->
    super objectMode: true
    @lax = opt.lax
    @recursive = opt.recursive

  _pushArray: (arr) ->
    arr.forEach (x) =>
      if @recursive and util.isArray(x)
        @_pushArray x
      else
        @push x

  _transform: (arr, encoding, done) ->
    if !util.isArray(arr)
      if @lax
        @push arr
      else
        @emit 'exception', "Found non-array value: #{arr}"
    else
      @_pushArray arr
    done()

exports.separate = (opt) -> new Separate(opt)

###
Split an incoming stream on a given regex.
regex: default newlines (/\r?\n/)
###
class Split extends Transform
  constructor: (@regex=/\r?\n/) ->
    super objectMode: true

    {StringDecoder} = require 'string_decoder'
    @_decoder = new StringDecoder('utf8')

    @_buffer = ''

  _transform: (chunk, encoding, done) ->
    @_buffer += @_decoder.write(chunk)
    lines = @_buffer.split(@regex)
    # keep the last partial line buffered
    @_buffer = lines.pop()
    @push line, 'utf8' for line in lines
    done()

  _flush: (done) ->
    # Just handle any leftover
    @push @_buffer, 'utf8' if @_buffer
    done()

exports.split = (regex) -> new Split(regex)

###*
Just do a function to a stream, don't modify anything.
###
exports.doto = (f) -> new Map (x) -> f(x); x

###
Map a given stream (in objectMode) through a provided function f: (in) -> out .
Drops any null or undefined return values from f.
###
class Map extends Transform
  constructor: (@f) ->
    super {objectMode: true}

  _transform: (i, encoding, done) ->
    try
      out = @f i
      @push out if out?
    catch e
      @emit 'exception', e
    finally
      done()

exports.map = (f) -> new Map(f)

###
Map a given stream (in objectMode) through a provided async function
f: (in, callback), where callback: (err, out)
Drops any null or undefined `out` values.

Additional opt values:
concurrency: number of concurrent asynchronous calls allowed.  Default unlimited.
###
class AsyncMap extends Duplex
  constructor: (opt, f) ->
    super allowHalfOpen: true, objectMode: true
    if typeof opt is 'function'
      f = opt
      opt = {}
    @f = f
    @concurrency = opt.concurrency || 1 # Max num calls outstanding
    @count = 0 # How many calls are currently outstanding
    @dones = [] # Pending callbacks
    @results = []
    @readerReady = false # Can we push results?

    @finished = false # Is writer done?
    @on 'finish', =>
      @finished = true

  _pump: ->
    while @results.length
      @readerReady = @push @results.shift()
      return unless @readerReady

  _read: (size) ->
    @readerReady = true
    if @results.length
      @_pump()
    else
      if @finished and @count == 0
        @push null

  _done: ->
    done = @dones.shift()
    done?()

  _write: (x, encoding, done) ->
    @dones.push done
    @count++
    @f x, (err, out) =>
      @count--
      if err
        @emit 'exception', err
      else
        @results.push out if out?
        @_pump() if @readerReady
      # If we have some callbacks queued, call them.
      @_done()
    # If we can do more simultaneously, signal we are ready.
    if @concurrency > @count
      @_done()

exports.mapAsync = (opt, f) -> new AsyncMap(opt, f)

exports.filter = (f) -> new Map (x) -> x if f x

exports.filterAsync = (opt, f) ->
  if typeof opt is 'function'
    f = opt
    opt = {}

  g = (x, callback) ->
    f x, (err, out) ->
      x = if out then x else null
      callback err, x

  return new AsyncMap opt, g

class Reduce extends Transform
  # Call with a reducing function (reduced, next) ->
  # Call with an optional intial value.  If not supplied,
  # use the first value as an initial value.  Supplying
  # initialValue = null or undefined is the same as not
  # supplying it.
  constructor: (initialValue, f) ->
    super {objectMode: true}
    if 'function' == typeof initialValue
      f = initialValue
      initialValue = undefined
    @reduced = initialValue
    @f = f

  _transform: (i, encoding, done) ->
    unless @reduced?
      @reduced = i
      done()
      return

    try
      @reduced = @f(@reduced, i)
    catch e
      @emit 'exception', e
    finally
      done()

  _flush: (done) ->
    @push @reduced
    done()

exports.reduce = (initialValue, f) -> new Reduce(initialValue, f)

exports.count = -> new Reduce( 0, (x, y) -> x + 1 )
###*
Collects input, emitting an array of output after opt.delay ms of quiescence.
###
class Debounce extends Transform
  constructor: (opt={}) ->
    unless opt.delay
      throw new Error 'Must supply options.delay in milliseconds'
    opt.objectMode = true
    super opt
    @_delay = opt.delay
    @_buffer = []
    @_timeout = null

  _setFlushTimeout: () ->
    clearTimeout(@_timeout)
    @_timeout = setTimeout =>
      @push @_buffer
      @_buffer = []
    , @_delay

  _transform: (x, encoding, done) ->
    @_buffer.push x
    @_setFlushTimeout()
    done()

  _flush: (done) ->
    clearTimeout @_timeout
    # Just handle any leftover
    @push @_buffer if @_buffer.length
    done()

exports.debounce = (opt) -> new Debounce(opt)

###*
Merge multiple streams into one.  The output stream will emit indescriminately
from the input streams, with no order guarantees.  The parameter streams is
an array of streams.
###
class Merge extends Readable
  constructor: (streams) ->
    @streams = streams
    for s in streams
      s.on 'end', =>
        # When the stream is done, remove it
        idx = @streams.indexOf s
        @streams.splice idx, 1
        # If there are no more streams, we are done.
        if @streams.length == 0
          @push null
      s.on 'readable', =>
        @_pump()

    super {objectMode:true}

  _pump: ->
    for s in @streams
      # Keep pumping stream s until it's done.
      while (chunk = s.read())?
        # If we can't push anymore, return for now.
        return unless @push chunk

  _read: (size) ->
    @_pump()

exports.merge = (streams) -> new Merge(streams)

###*
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
###
class Zip extends Readable
  constructor: (@streamMap) ->
    @current = {}
    @keys = []
    for name, s of @streamMap
      @keys.push name
      s.on 'end', =>
        # When any stream is done, this stream is done
        @push null
      s.on 'readable', =>
        @_pump()

    super {objectMode:true}

  _pump: ->
    canPush = true
    while canPush
      gotAllMissing = true
      gotData = false
      # Run through all keys, filling any missing bits in current
      for key in @keys
        unless @current[key]?
          chunk = @streamMap[key].read()
          if chunk?
            gotData = true
            @current[key] = chunk
          else
            gotAllMissing = false

      if gotData and gotAllMissing
        canPush = @push @current
        @current = {}
      else
        canPush = false

  _read: (size) ->
    @_pump()

exports.zip = (streamMap) -> new Zip(streamMap)



###
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
###


class PvcReadable extends Readable
  constructor: ->
    super objectMode: true
    @currentOut = this

  pipe: (writable) ->
    oldOut = @currentOut
    @currentOut = new StreamSource(writable)
    oldOut.on 'exception', (error) =>
      @currentOut.emit 'exception', error
    super writable
    return @currentOut

  exceptions: (callback) ->
    @on 'exception', callback

# Now add all the methods from above
Object.getOwnPropertyNames(exports).forEach (key) ->
  PvcReadable.prototype[key] = -> @pipe(exports[key].apply this, arguments)

###
Convert an array into a Readable stream.

source = new ArraySource([1, 2])
source.read() # 1
source.read() # 2
source.read() # null
###
class ArraySource extends PvcReadable
  constructor: (@array) ->
    super
    @index = 0

  _read: ->
    if @index >= @array.length
      @push null
      @array = null
    else
      @push @array[@index]
      @index++

exports.arraySource = (arr) -> new ArraySource arr


class StreamSource extends PvcReadable
  constructor: (@source) ->
    super

    @source.on 'exception', (ex) =>
      @emit 'exception', ex
    # When the source is done, this stream is done
    @source.on 'end', =>
      @push null

    # When the source is ready, see if we can start pushing
    @source.on 'readable', =>
      @_pump()

  _pump: ->
    # while there is stuff to read...
    while chunk = @source.read()
      # ...push it as long as downstream can handle it
      break unless @push chunk

  _read: (size) ->
    @_pump()

exports.streamSource = (source) -> new StreamSource source

exports.source = (source) ->
  # Take in an optional source
  unless source?
    return new PassSource
  if source instanceof PvcReadable
    return source
  if source instanceof Readable
    return new StreamSource(source)
  # FIXME Get a real check for arrays here
  if source instanceof Array
    return new ArraySource(source)
