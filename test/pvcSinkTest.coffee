{assert} = require 'chai'
sinon = require 'sinon'

pvc = require './pvc'

describe 'toArray', ->
  it 'should collect objects into an array', (done) ->
    src = [1, 2, 3, 4]
    pvc.source src
      .toArray (exs, arr) ->
        assert.isNull exs
        assert.deepEqual arr, src
        done()

  it 'should pass on exceptions', (done) ->
    src = [1, 2, 3]
    pvc.source src
      .map (x) ->
        if x == 2
          throw new Error('bad')
        else
          x
      .toArray (exs, arr) ->
        assert.isNotNull exs
        assert.equal exs.length, 1
        assert.equal exs[0].message, 'bad'
        assert.deepEqual arr, [1, 3]
        done()

describe 'reduce', ->
  it 'should reduce a list', (done) ->
    pvc.source([1, 3, 4, 2])
      .reduce(
        (x, y) -> x + y,
        (exs, d) ->
          assert.isNull exs
          assert.equal d, 10
          done()
      )
  it 'should take an initial value', (done) ->
    pvc.source([1, 3, 4, 2])
      .reduce 0,
        (x, y) -> x + 1,
        (exs, d) ->
          assert.isNull exs
          assert.equal d, 4
          done()

describe 'count', ->
  it 'count items in a stream', (done) ->
    pvc.source([1, 3, 4, 2])
      .count (exs, d) ->
        assert.isNull exs
        assert.equal d, 4
        done()
