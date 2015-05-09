fs = require 'fs'
_path = require 'path'
{Transform, Duplex, Readable} = require 'stream'
util = require 'util'


###
Convert an array into a Readable stream.

source = new ArraySource([1, 2])
source.read() # 1
source.read() # 2
source.read() # null
###
class ArraySource extends Readable
  constructor: (@array, opt={}) ->
    opt.objectMode = true
    super opt
    @index = 0

  _read: ->
    if @index >= @array.length
      @push null
    else
      @push @array[@index]
      @index++

exports.arraySource = (arr) -> new ArraySource arr

###
Convert incoming arrays into their constituent elements.

Additional opt fields:
lax: If true, just push non-Arrays.  Default is to throw an error.
recursive: If true, separate any arrays that were found from the separation
  procedure.  Default is to only separate one level.
###
class Separate extends Transform
  constructor: (opt={}) ->
    opt.objectMode = true
    super opt
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
        @emit 'error', "Found non-array value: #{arr}"
    else
      @_pushArray arr
    done()

exports.separate = (opt) -> new Separate(opt)

###
Split an incoming stream on a given regex.
regex: default newlines (/\r?\n/)
###
class Splitter extends Transform
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

exports.splitter = (regex) -> new Splitter(regex)

###
Map a given stream (in objectMode) through a provided function f: (in) -> out .
Drops any null or undefined return values from f.
###
class Map extends Transform
  constructor: (@f, opt={}) ->
    opt.objectMode = true
    super opt

  _transform: (i, encoding, done) ->
    try
      out = @f i
      @push out if out?
      done()
    catch e
      @emit 'error', e

exports.map = (f) -> new Map(f)

###
Map a given stream (in objectMode) through a provided async function
f: (in, callback), where callback: (err, out)
Drops any null or undefined `out` values.

Additional opt values:
concurrency: number of concurrent asynchronous calls allowed.
###

class AsyncMap extends Transform
  constructor: (opt, f) ->
    if typeof opt is 'function'
      f = opt
      opt = {}
    @f = f
    opt.objectMode = true
    super opt
    @concurrency = opt.concurrency

  _transform: (i, encoding, done) ->
    # TODO: Handle concurrency
    @f i, (err, out) =>
      if err
        @emit 'error', err
      else
        @push out if out?
        done()

exports.mapAsync = (f, opt) -> new AsyncMap(f, opt)

class Filter extends Transform
  constructor: (@f, opt={}) ->
    opt.objectMode = true
    super opt

  _transform: (i, encoding, done) ->
    try
      keep = @f i
      @push i if keep
      done()
    catch e
      @emit 'error', e

exports.filter = (f) -> new Filter(f)

class AsyncFilter extends Transform
  constructor: (@f, opt={}) ->
    opt.objectMode = true
    super opt
    @concurrency = opt.concurrency

  _transform: (i, encoding, done) ->
    # TODO: Handle concurrency
    @f i, (err, keep) =>
      if err
        @emit 'error', err
      else
        @push i if keep
        done()

exports.filterAsync = (f, opt) -> new AsyncFilter(f, opt)

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
Just do a function to a stream, don't modify anything.
XXX: Not yet working, don't use.
###
class Doto extends Transform
  constructor: (options, f) ->
    if typeof options is 'function'
      f = options
      options = {}
    options.objectMode = true
    @options = options
    @f = f
    super options

  _transform: (x, encoding, done) ->
    @f x
    @push x

exports.doto = (opt, f) -> new Doto(opt, f)
