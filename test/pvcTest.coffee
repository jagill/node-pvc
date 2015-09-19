{assert} = require 'chai'
sinon = require 'sinon'

pvc = require './pvc'

describe 'separate', ->
  it 'should separate an array', (done) ->
    pvc.source([ [1, 2] ])
      .separate()
      .toArray (exs, arr) ->
        assert.isNull exs
        assert.deepEqual arr, [1, 2]
        done()

  it 'should throw an error for a non array', (done) ->
    pvc.source([1])
      .separate()
      .toArray (exs, arr) ->
        assert.equal exs.length, 1
        assert.equal arr.length, 0
        done()

  it 'should pass a non-array if lax=true', (done) ->
    pvc.source([1])
      .separate( lax: true )
      .toArray (exs, arr) ->
        assert.isNull exs
        assert.deepEqual arr, [1]
        done()

  it 'should pass child arrays unseparated', (done) ->
    pvc.source([ [1, ['a', 'b'], 2] ])
      .separate( lax: true )
      .toArray (exs, arr) ->
        assert.isNull exs
        assert.deepEqual arr, [1, ['a', 'b'], 2]
        done()

  it 'should separate child arrays if recursive=true', (done) ->
    pvc.source([ [1, ['a', 'b'], 2] ])
      .separate( recursive: true )
      .toArray (exs, arr) ->
        assert.isNull exs
        assert.deepEqual arr, [1, 'a', 'b', 2]
        done()

describe 'split', ->
  it 'should split on newlines', ->
    s = pvc.source().split()
    s.write('abc\ndef\n')
    assert.equal 'abc', s.read()
    assert.equal 'def', s.read()
    assert.isNull s.read()

  it 'should flush remainder', ->
    s = pvc.source().split()
    s.write('abc\ndef')
    s.end()
    assert.equal 'abc', s.read()
    assert.equal 'def', s.read()
    assert.isNull s.read()

  it 'should split on DOS newlines', ->
    s = pvc.source().split()
    s.write('abc\r\ndef\r\n')
    assert.equal 'abc', s.read()
    assert.equal 'def', s.read()
    assert.isNull s.read()

  it 'should accept other regexes', ->
    s = pvc.source().split(/\s+/)
    s.write('ab cd\tef  gh\nij')
    s.end()
    assert.equal 'ab', s.read()
    assert.equal 'cd', s.read()
    assert.equal 'ef', s.read()
    assert.equal 'gh', s.read()
    assert.equal 'ij', s.read()
    assert.isNull s.read()

describe 'map', ->
  it 'should map inputs to outputs', (done) ->
    pvc.source([1, 3])
      .map( (x) -> 2*x )
      .toArray (exs, arr) ->
        assert.isNull exs
        assert.deepEqual arr, [2, 6]
        done()

  it 'should drop nulls/undefineds', (done) ->
    pvc.source([1, 2, 3, 4])
      .map (x) ->
        return undefined if x == 2
        return null if x == 3
        return x
      .toArray (exs, arr) ->
        assert.isNull exs
        assert.deepEqual arr, [1, 4]
        done()

  it 'should emit an exception on map errors', (done) ->
    pvc.source([1, 2])
      .map -> throw new Error()
      .toArray (exs, arr) ->
        assert.equal exs.length, 2
        assert.equal arr.length, 0
        done()

describe 'mapAsync', ->
  it 'should map inputs to outputs', (done) ->
    s = pvc.source().mapAsync (x, cb) ->
      process.nextTick ->
        cb null, x*2
    expectedResults = [2, 4, 6, 8]
    results = []
    s.on 'data', (x) ->
      results.push x
    s.on 'finish', ->
      assert.deepEqual results, expectedResults
      done()
    s.write 1
    s.write 2
    s.write 3
    s.write 4
    s.end()

  it 'should feed toArray correctly', (done) ->
    pvc.source([1, 3])
      .mapAsync( (x, cb) ->
        process.nextTick ->
          cb null, 2*x
      ).toArray (exs, arr) ->
        assert.isNull exs
        assert.deepEqual arr, [2, 6]
        done()

  it 'should drop nulls/undefineds', (done) ->
    s = pvc.source().mapAsync (x, cb) ->
      process.nextTick ->
        if x == 2
          cb null, undefined
        else if x == 3
          cb null, null
        else
          cb null, x
    expectedResults = [1, 4]
    results = []
    s.on 'data', (x) ->
      results.push x
    s.on 'finish', ->
      assert.deepEqual results, expectedResults
      done()
    s.write 1
    s.write 2
    s.write 3
    s.write 4
    s.end()

  it 'should emit an exception on map errors', (done) ->
    s = pvc.source().mapAsync( (x, cb) -> cb new Error() )
    s.on 'exception', -> done()
    s.write 1

  it 'should respect concurrency option', (done) ->
    total = 10
    concurrency = 4
    reachedMax = false
    n = 0
    checkN = ->
      # chai has no isNotBelow assert
      if concurrency == n
        reachedMax = true
      else
        assert.isAbove concurrency, n

    s = pvc.source().mapAsync {concurrency}, (x, cb) ->
      n++
      checkN()
      setTimeout ->
        n--
        cb null, x
      , 100

    s.write(i) for i in [0...total]
    s.end()

    results = []
    s.on 'data', (data) ->
      results.push data
    s.on 'end', ->
      assert.isTrue reachedMax
      assert.equal results.length, total
      done()

    # s.on 'data', (data) ->
    #   console.log 'ZZZ', data
    # while x = s.read()
    #   console.log 'ZZZ', x
    #   done() unless x



describe 'filter', ->
  it 'should filter values', (done) ->
    pvc.source( [1, 2, 3] )
      .filter (x) -> x % 2
      .toArray (exs, arr) ->
        assert.isNull exs
        assert.deepEqual arr, [1, 3]
        done()

  it 'should emit an exception on filter errors', (done) ->
    pvc.source( [1, 2, 3] )
      .filter( -> throw new Error() )
      .toArray (exs, arr) ->
        assert.equal exs.length, 3
        assert.equal arr.length, 0
        done()

describe 'filterAsync', ->
  it 'should filter values', (done) ->
    s = pvc.source().filterAsync (x, cb) ->
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


  it 'should emit an exception on filter errors', (done) ->
    s = pvc.source().filterAsync (x, cb) ->
      process.nextTick ->
        cb new Error()
    s.on 'exception', -> done()
    s.write 1

describe 'debounce', ->
  clock = null
  before ->
    clock = sinon.useFakeTimers()

  after ->
    clock.restore()

  it 'should not flush before timeout', ->
    s = pvc.source()
      .debounce delay: 200
    s.write 1
    s.write 2
    assert.isNull s.read()
    clock.tick 1
    assert.isNull s.read()

  it 'should flush after timeout', ->
    s = pvc.source()
      .debounce delay: 200
    s.write 1
    s.write 2
    clock.tick 300
    assert.deepEqual s.read(), [1, 2]

  it 'should flush on end', ->
    s = pvc.source().debounce delay: 200
    s.write 1
    s.end()
    assert.deepEqual s.read(), [1]

describe 'merge', ->
  it 'should emit a single stream unchanged', ->
    in1 = pvc.source [1, 2]
    s = pvc.merge [in1]
    assert.equal s.read(), 1
    assert.equal s.read(), 2
    assert.isNull s.read()

  it 'should combine two streams', ->
    in1 = pvc.source ['a', 'b']
    in2 = pvc.source ['c', 'd', 'e']
    s = pvc.merge [in1, in2]
    output = {}
    while x = s.read()
      output[x] = true

    for c in ['a', 'b', 'c', 'd', 'e']
      assert.isTrue output[c]

describe 'zip', ->
  it 'should zip a single stream', ->
    in1 = pvc.source([1, 2])
    s = pvc.zip {num: in1}
    assert.deepEqual s.read(), {num: 1}
    assert.deepEqual s.read(), {num: 2}
    assert.isNull s.read()

  it 'should zip two streams', ->
    in1 = pvc.source([1, 2])
    in2 = pvc.source(['a', 'b'])
    s = new pvc.zip {num: in1, alph: in2}
    assert.deepEqual s.read(), {num: 1, alph: 'a'}
    assert.deepEqual s.read(), {num: 2, alph: 'b'}
    assert.isNull s.read()

  it 'should finish after the shortest input finishes', ->
    in1 = pvc.source([1, 2, 3])
    in2 = pvc.source(['a', 'b'])
    s = pvc.zip {num: in1, alph: in2}
    assert.deepEqual s.read(), {num: 1, alph: 'a'}
    assert.deepEqual s.read(), {num: 2, alph: 'b'}
    assert.isNull s.read()

  it 'should finish immediately with an empty array', ->
    in1 = pvc.source([1, 2])
    in2 = pvc.source(['a', 'b'])
    in3 = pvc.source([])
    s = pvc.zip {num: in1, alph: in2, empty: in3}
    assert.isNull s.read()

describe 'doto', ->
  it 'should call the given function on the elements', ->
    total = 0
    s = pvc.source().doto (x) -> total += x
    s.write 1
    s.read()
    assert.equal total, 1
    s.write 3
    s.read()
    assert.equal total, 4

  it 'should pass through the elements unchanged', ->
    a1 = {}
    a2 = {}
    s = pvc.source [a1, a2]
      .doto (x) ->
    s.write a1
    s.write a2
    assert.equal s.read(), a1
    assert.equal s.read(), a2
    assert.isNull s.read()

describe 'limit', ->
  it 'should limit the incoming stream', (done) ->
    pvc.source [1, 2, 3]
      .limit 2
      .toArray (exs, arr) ->
        assert.isNull exs
        assert.deepEqual arr, [1, 2]
        done()

describe 'skip', ->
  it 'should skip the beginning of the incoming stream', (done) ->
    pvc.source [1, 2, 3]
      .skip 2
      .toArray (exs, arr) ->
        assert.isNull exs
        assert.deepEqual arr, [3]
        done()
