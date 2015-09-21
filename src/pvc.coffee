{Transform, Duplex, Readable, Writable, PassThrough} = require 'stream'

#######
# Mixin

# We need to also pass exceptions through.
pipe = (last, next) ->
  last.on 'exception', (ex) ->
    next.emit 'exception', ex
  return last.pipe next

# Remember the things we need to add to the mixin, close to their definition.
registers = {}
# Now apply all that we've accumulated.
exports.mixin = mixin = (obj) ->
  for k, v of registers
    obj.prototype[k] = v

###
# Sources

Sources are various ways to start pipes.
###

###
Convert an array into a Readable stream.

source = new ArraySource([1, 2])
source.read() # 1
source.read() # 2
source.read() # null
###
class ArraySource extends Readable
  constructor: (@array) ->
    super objectMode: true
    @index = 0

  _read: ->
    if @index >= @array.length
      @push null
      @array = null
    else
      @push @array[@index]
      @index++

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

# class StreamSource extends PvcReadable
#   constructor: (@source) ->
#     console.log 'Making StreamSource with', @source
#     super
#
#     @source.on 'exception', (ex) =>
#       @emit 'exception', ex
#     # When the source is done, this stream is done
#     @source.on 'end', =>
#       @push null
#
#     # When the source is ready, see if we can start pushing
#     @source.on 'readable', =>
#       @_pump()
#
#   _pump: ->
#     # while there is stuff to read...
#     while chunk = @source.read()
#       # ...push it as long as downstream can handle it
#       break unless @push chunk
#
#   _read: (size) ->
#     @_pump()

# Expose a source function that takes in various things and converts it to the
# right kind of source.
exports.source = (source) ->
  # Take in an optional source
  unless source?
    return new PvcPassThrough()
  if Array.isArray(source)
    return new ArraySource(source)
  # TODO: Don't double mixin things.
  # if source instanceof PvcReadable
  #   return source
  # If it's a readable, just do the mixin
  if source instanceof Readable
    # FIXME: This should modify source, not source.prototype
    mixin source
    return source



###
# Sinks

These are various ways to collect the results of the pipe.
They are constructed with a done function, which is called
on end.  If the sink  has any results to return, the done
function will be called with the collected exceptions as the
first argument, and the collected results as the second.
###

class Sink extends Writable
  constructor: (@done) ->
    super objectMode: true
    @result = null
    @exceptions = []
    @on 'exception', (ex) =>
      @exceptions.push ex
    @on 'finish', =>
      exs = if @exceptions.length == 0 then null else @exceptions
      @done exs, @result

class Reduce extends Sink
  constructor: (initial, f, done) ->
    unless done?
      done = f
      f = initial
      initial = null

    super(done)
    @result = initial
    @f = f

  _write: (x, encoding, done) ->
    unless @result?
      @result = x
    else
      @result = @f(@result, x)
    done()

registers.reduce = (initial, f, done) ->
  return pipe this, new Reduce(initial, f, done)

registers.count = (done) ->
  return pipe this, new Reduce( 0,
    (x, y) -> x + 1,
    done
  )


class ToArray extends Sink
  constructor: (done) ->
    super(done)
    @result = []

  _write: (x, encoding, done) ->
    @result.push x
    done()

registers.toArray = (done) ->
  return pipe this, new ToArray(done)


###
# Transforms

Transforms are the workhorses, taking input
from a previous stream and giving transformed
data to the next stream.
###

# Set a base class to only have to apply the mixin once.
class PvcTransform extends Transform
  constructor: ->
    super objectMode: true

# We consider this a source that must be manually written to.
# Very useful for testing!
class PvcPassThrough extends PvcTransform
  _transform: (x, encoding, done) ->
    @push x
    done()

class Limit extends PvcTransform
  constructor: (@n) ->
    super()

  _transform: (x, encoding, done) ->
    if @n > 0
      @push x
      @n--
    else
      @push null
    done()

registers.limit = (n) ->
  return pipe this, new Limit(n)

class Skip extends PvcTransform
  constructor: (@n) ->
    super()

  _transform: (x, encoding, done) ->
    if @n > 0
      @n--
    else
      @push x
    done()

registers.skip = (n) ->
  return pipe this, new Skip(n)

###
Convert incoming arrays into their constituent elements.

@param options (optional) A dictionary of parameters, including:
  lax: If true, just push non-Arrays.  Default is to throw an error.
  recursive: If true, separate any arrays that were found from the separation
    procedure.  Default is to only separate one level.
###
class Separate extends PvcTransform
  constructor: (options={}) ->
    @lax = options.lax
    @recursive = options.recursive
    super()

  _pushArray: (arr) ->
    arr.forEach (x) =>
      if @recursive and Array.isArray(x)
        @_pushArray x
      else
        @push x

  _transform: (arr, encoding, done) ->
    if !Array.isArray(arr)
      if @lax
        @push arr
      else
        @emit 'exception', "Found non-array value: #{arr}"
    else
      @_pushArray arr
    done()

registers.separate = (options) ->
  return pipe this, new Separate(options)

###
Split an incoming stream on a given regex.
regex: default newlines (/\r?\n/)
###
class Split extends PvcTransform
  constructor: (@regex=/\r?\n/) ->
    {StringDecoder} = require 'string_decoder'
    @_decoder = new StringDecoder('utf8')

    @_buffer = ''
    super()

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

registers.split = (regex) ->
  return pipe this, new Split(regex)

###
Map a given stream (in objectMode) through a provided function f: (in) -> out .
Drops any null or undefined return values from f.
###
class Map extends PvcTransform
  constructor: (@f) ->
    super()

  _transform: (i, encoding, done) ->
    try
      out = @f i
      @push out if out?
    catch e
      @emit 'exception', e
    finally
      done()

registers.map = (f) ->
  return pipe this, new Map(f)

registers.filter = (f) ->
  return pipe this, new Map (x) -> x if f x

# Just do a function to a stream, don't modify anything.
registers.doto = (f) ->
  return pipe this, new Map (x) -> f(x); x

###
Map a given stream (in objectMode) through a provided async function
f: (in, callback), where callback: (err, out) ->
Drops any null or undefined `out` values.

Additional opt values:
concurrency: number of concurrent asynchronous calls allowed.  Default in series.
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
      @_maybeFinish()

  _maybeFinish: ->
      if @finished and @count == 0
        @push null

  _pump: ->
    while @results.length
      x = @results.shift()
      @readerReady = @push x
      # @readerReady = @push @results.shift()
      return unless @readerReady

  _read: (size) ->
    @readerReady = true
    if @results.length
      @_pump()
    else
      @_maybeFinish()

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

registers.mapAsync = (opt, f) ->
    return pipe this, new AsyncMap(opt, f)

registers.filterAsync = (opt, f) ->
    if typeof opt is 'function'
      f = opt
      opt = {}

    g = (x, callback) ->
      f x, (err, out) ->
        x = if out then x else null
        callback err, x

    return pipe this, new AsyncMap opt, g

###*
Collects input, emitting an array of output after opt.delay ms of quiescence.
###
class Debounce extends PvcTransform
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

registers.debounce = (opt) ->
  return pipe this, new Debounce(opt)


###
# Mixins
Now that we've registered everything, mixin the
appropriate pieces.
###

mixin PvcTransform
mixin AsyncMap
mixin ArraySource
mixin Zip
mixin Merge
