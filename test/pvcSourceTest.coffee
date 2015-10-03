{assert} = require 'chai'
sinon = require 'sinon'
{PassThrough} = require 'stream'

pvc = require './pvc'

gather = (s, callback) ->
  out = []
  errors = null
  s.on 'exception', (error) ->
    errors ?= []
    errors.push error
  s.on 'data', (data) ->
    out.push data
  s.on 'end', ->
    callback errors, out


describe 'source', ->
  it 'should pass array elements', ->
    s = pvc.source([1, 2])
    assert.equal 1, s.read()
    assert.equal 2, s.read()
    assert.isNull s.read()

  it 'should create a passthrough for no arguments', ->
    s = pvc.source()
    assert.isNull s.read()
    s.write 1
    assert.equal s.read(), 1
    assert.isNull s.read()

  it 'should make a streamSource from a Readable stream', (done) ->
    pass = new PassThrough()
    s = pvc.source pass
    s.split().toArray (err, arr) ->
      assert.isNull err
      assert.equal arr.length, 2
      assert.equal arr[0], 'this is the first line'
      assert.equal arr[1], 'and the second'
      done()

    s.write 'this is the f'
    s.write 'irst line\nan'
    s.write 'd the se'
    s.write 'cond'
    s.end()

  it 'should leave a pvc readable stream unchanged', ->
    s = pvc.source()
    s2 = pvc.source(s)
    assert.strictEqual s, s2

  it 'should leave a pvc transform stream unchanged', ->
    s = pvc.source().map (x) -> x
    s2 = pvc.source(s)
    assert.strictEqual s, s2
