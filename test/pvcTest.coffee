{assert} = require 'chai'
sinon = require 'sinon'

pvc = require './pvc'


describe 'arraySource', ->
  it 'should pass array elements', ->
    s = new pvc.arraySource([1, 2])
    assert.equal 1, s.read()
    assert.equal 2, s.read()
    assert.isNull s.read()

describe 'separate', ->
  it 'should separate an array', ->
    s = pvc.separate()
    s.write [1, 2]
    assert.equal 1, s.read()
    assert.equal 2, s.read()
    assert.isNull s.read()

  it 'should throw an error for a non array', (done) ->
    s = pvc.separate()
    s.on 'error', (err) -> done()
    s.write 1
    s.read()

  it 'should pass a non-array if lax=true', ->
    s = pvc.separate( lax: true )
    s.on 'error', (err) -> assert.fail('Should not throw an error')
    s.write 1
    assert.equal 1, s.read()
    assert.isNull s.read()

  it 'should pass child arrays unseparated', ->
    s = pvc.separate()
    s.write [1, ['a', 'b'], 2]
    assert.equal 1, s.read()
    assert.deepEqual ['a', 'b'], s.read()
    assert.equal 2, s.read()
    assert.isNull s.read()

  it 'should separate child arrays if recursive=true', ->
    s = pvc.separate( recursive: true )
    s.write [1, ['a', 'b'], 2]
    assert.equal 1, s.read()
    assert.equal 'a', s.read()
    assert.equal 'b', s.read()
    assert.equal 2, s.read()
    assert.isNull s.read()

describe 'splitter', ->
  it 'should split on newlines', ->
    s = pvc.splitter()
    s.write('abc\ndef\n')
    assert.equal 'abc', s.read()
    assert.equal 'def', s.read()
    assert.isNull s.read()

  it 'should flush remainder', ->
    s = pvc.splitter()
    s.write('abc\ndef')
    s.end()
    assert.equal 'abc', s.read()
    assert.equal 'def', s.read()
    assert.isNull s.read()

  it 'should split on DOS newlines', ->
    s = pvc.splitter()
    s.write('abc\r\ndef\r\n')
    assert.equal 'abc', s.read()
    assert.equal 'def', s.read()
    assert.isNull s.read()

  it 'should accept other regexes', ->
    s = pvc.splitter(/\s+/)
    s.write('ab cd\tef  gh\nij')
    s.end()
    assert.equal 'ab', s.read()
    assert.equal 'cd', s.read()
    assert.equal 'ef', s.read()
    assert.equal 'gh', s.read()
    assert.equal 'ij', s.read()
    assert.isNull s.read()

describe 'map', ->
  it 'should map inputs to outputs', ->
    s = pvc.map( (x) -> 2*x )
    s.write 1
    s.write 3
    assert.equal 2, s.read()
    assert.equal 6, s.read()
    assert.isNull s.read()

  it 'should drop nulls/undefineds', ->
    s = pvc.map (x) ->
      return undefined if x == 2
      return null if x == 3
      return x
    s.write 1
    s.write 2
    s.write 3
    s.write 4
    assert.equal 1, s.read()
    assert.equal 4, s.read()
    assert.isNull s.read()

  it 'should emit an error on map errors', (done) ->
    s = pvc.map( -> throw new Error() )
    s.on 'error', -> done()
    s.write 1

describe 'mapAsync', ->
  it 'should map inputs to outputs', (done) ->
    s = pvc.mapAsync( (x, cb) ->
      process.nextTick ->
        cb null, 2*x
    )
    expectedResults = [2, 6]
    s.on 'readable', ->
      assert.equal expectedResults.shift(), s.read()
    s.on 'finish', ->
      assert.equal 0, expectedResults.length
      done()
    s.write 1
    s.write 3
    s.end()

  it 'should drop nulls/undefineds', (done) ->
    s = pvc.mapAsync (x, cb) ->
      process.nextTick ->
        if x == 2
          cb null, undefined
        else if x == 3
          cb null, null
        else
          cb null, x
    expectedResults = [1, 4]
    s.on 'readable', ->
      assert.equal expectedResults.shift(), s.read()
    s.on 'finish', ->
      assert.equal 0, expectedResults.length
      done()
    s.write 1
    s.write 2
    s.write 3
    s.write 4
    s.end()

  it 'should emit an error on map errors', (done) ->
    s = pvc.mapAsync( (x, cb) -> cb new Error() )
    s.on 'error', -> done()
    s.write 1

describe 'filter', ->
  it 'should filter values', ->
    s = pvc.filter (x) -> x % 2
    s.write 1
    s.write 2
    s.write 3
    assert.equal 1, s.read()
    assert.equal 3, s.read()
    assert.isNull s.read()

  it 'should emit an error on filter errors', (done) ->
    s = pvc.filter( -> throw new Error() )
    s.on 'error', -> done()
    s.write 1

describe 'filterAsync', ->
  it 'should filter values', (done) ->
    s = pvc.filterAsync (x, cb) ->
      process.nextTick ->
        cb null, x % 2
    expectedResults = [1, 3]
    s.on 'readable', ->
      assert.equal expectedResults.shift(), s.read()
    s.on 'finish', ->
      assert.equal 0, expectedResults.length
      done()
    s.write 1
    s.write 2
    s.write 3
    s.end()


  it 'should emit an error on filter errors', (done) ->
    s = pvc.filterAsync (x, cb) ->
      process.nextTick ->
        cb new Error()
    s.on 'error', -> done()
    s.write 1


describe 'debounce', ->
  clock = null
  before ->
    clock = sinon.useFakeTimers()

  after ->
    clock.restore()

  it 'should not flush before timeout', ->
    s = pvc.debounce delay: 200
    s.write 1
    s.write 2
    assert.isNull s.read()
    clock.tick 1
    assert.isNull s.read()

  it 'should flush after timeout', ->
    s = pvc.debounce delay: 200
    s.write 1
    s.write 2
    clock.tick 201
    assert.deepEqual [1, 2], s.read()

  it 'should flush on end', ->
    s = pvc.debounce delay: 200
    s.write 1
    s.end()
    assert.deepEqual [1], s.read()