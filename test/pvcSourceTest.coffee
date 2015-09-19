{assert} = require 'chai'
sinon = require 'sinon'

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

  xit 'should make a streamSource from a Readable stream'

  xit 'should leave a pvc stream unchanged'
