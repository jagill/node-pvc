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

xdescribe 'source', ->
  it 'should make an array source from an array', ->
    s = pvc.source([1, 2])
    gather s, (err, out) ->
      assert.ok !err?
      assert.deepEqual out, [2, 3]
      done()

  xit 'should make a streamSource from a Readable stream'

  xit 'should leave a pvc stream unchanged'


xdescribe 'chaining', ->
  describe 'map', ->
    input = [1, 2]

    it 'should map correctly', (done) ->
      s = pvc.source(input).map (x) -> x + 1
      gather s, (err, out) ->
        assert.ok !err?
        assert.deepEqual out, [2, 3]
        done()

    it 'should pass errors through', (done) ->
      s = pvc.source(input).map (x) ->
        if x == 1
          throw 'bad'
        x + 1
      gather s, (errors, out) ->
        assert.deepEqual errors, ['bad']
        assert.deepEqual out, [3]
        done()

    it 'should pipe two maps correctly', (done) ->
      s = pvc.source(input)
        .map (x) -> x + 1
        .map (x) -> x + 10
      gather s, (err, out) ->
        assert.ok !err?
        assert.deepEqual out, [12, 13]
        done()

    it 'should pipe exceptions through', (done) ->
      s = pvc.source(input)
        .map (x) ->
          if x == 1
            throw 'bad'
          x + 1
        .map (x) -> x + 10
      gather s, (errors, out) ->
        assert.deepEqual errors, ['bad']
        assert.deepEqual out, [13]
        done()

  describe 'filter', ->
    input = [1, 2, 4, 5]

    it 'should chain correctly', (done) ->
      s = pvc.source(input)
        .filter (x) -> x % 2
        .filter (x) -> x == 5
      gather s, (errors, out) ->
        assert.ok !err?
        assert.deepEqual out, [5]
        done()

    it 'should chain with map', (done) ->
      s = pvc.source(input)
        .map (x) -> x + 1
        .filter (x) -> x % 2
      gather s, (errors, out) ->
        assert.ok !err?
        assert.deepEqual out, [3, 5]
        done()
