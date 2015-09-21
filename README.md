pvc
===
[![Circle CI](https://circleci.com/gh/jagill/node-pvc/tree/master.svg?style=shield)](https://circleci.com/gh/jagill/node-pvc/tree/master)

pvc is a lightweight (no dependencies!) collection of utilities for Node.js
streams in object mode.  It wraps vanilla Readable streams, and also arrays,
allowing you to manipulate them functionally.

TALK ABOUT FUNCTIONAL PARADIGM FOR STREAMS.
TALK ABOUT BACK-PRESSURE.
TALK ABOUT PASSING EXCEPTIONS.

### Basic Example
`pvc` provides several methods for functional transformation of streams.
Install with `npm install pvc`.

```javascript
var pvc = require('pvc');

// You can easily make an array into a stream
var pipeline = pvc.source([1, 2, 3, 4, 5, 6, 7, 8, 9])
  .map( function (n) { return n + 1; } )
  // [2, 3, 4, 5, 6, 7, 8, 9, 10]
  .filter( function (n) { return n % 2 == 0; } )
  // [2, 4, 6, 8, 10]
  .mapAsync( function (n, callback) {
    setTimeout( function () {
      callback(null, n + 10);
    }, 100)
  })
  // [12, 14, 16, 18, 20]
  .filterAsync( function (n, callback) {
    setTimeout( function () {
      callback(null, ( n % 3 == 0 ) );
    }, 100)
  })
  // [12, 18]
  .toArray( function (exceptions, results) {
    console.error('Exceptions:', exceptions);
    // 'Exceptions: null'
    console.log('Results:', results);
    // 'Results: [12, 18]'
  });

```

Sources
-------

### source

Create a pvc Readable stream, from the argument if supplied.

If there is no argument given, create a `PassThrough` source:
```js
s = pvc.source()
s.write(1)
s.write('a')
s.read() // 1
s.read() // 2
s.read() // null
```

If the argument is an array, create a readable stream from the array:
```js
s = pvc.source([1, 'a', '1'])
s.read() // 1
s.read() // 'a'
s.read() // '1'
s.read() // null
```

If the argument is a node Readable stream, augment it with the pvc functional
methods.
```js
// TODO: Example
```

### merge
Merge takes multiple streams, and merges them into a single stream.  All outputs
objects of the input streams will be outputted by the merged stream, but there
is no guarantee of the order.

```js
// TODO: Example
```

### zip
Zip takes a map of streams, zipping them into a stream that outputs objects
containing the values of the stream outputs.

```js
// TODO: Example
```

Sinks
-----
Sinks pull results from the pipe as fast as they can, accumulating them in some
way.  They are all passed a callback which is called when the pipe is finished.

### toArray
Collect the output of the pipe into an array.  `toArray` is called when the
pipe is finished with a callback which receives an `exceptions` array (null if
no exceptions occured) and a `results` array.

```js
pvc.source(1, 2, 3)
  .map(function (x) {
    if (x == 2)
      throw new Error('BAD');
    else
      return x * 2
  })
  .toArray( function (exceptions, results) {
    console.log('Exceptions:', exceptions);
    // 'Exceptions: [ [Error: BAD] ]'
    console.log('Results:', results);
    // 'Results: [2, 4]'
  });
```

### reduce
Reduce the output of the pipe according to the passed reduction function.  An
optional `initialValue` argument is the initial value used for reduction;
if it is not passed (or passed as `null` or `undefined`), the first value in
the pipe is used as the initial value.

```js
pvc.source([1, 2, 3, 4])
  .reduce(function (x, y) {
    if (x == 2)
      throw new Error('BAD');
    else
      return x + y;
  }, function (exceptions, result) {
    console.log('Exceptions:', exceptions);
    // 'Exceptions: [ [Error: BAD] ]'
    console.log('Result:', result);
    // 'Result: 8'
  });

  pvc.source([1, 2, 3, 4])
    .reduce(-4, function (x, y) {
      return x + y;
    }, function (exceptions, result) {
      console.log('Exceptions:', exceptions);
      // 'Exceptions: null'
      console.log('Result:', result);
      // 'Result: 6'
    });
```

### count
Count the number of output objects (not including exceptions).

```js
pvc.source([1, 2, 3, 4])
  .count(function (exceptions, result) {
    console.log('Exceptions:', exceptions);
    // 'Exceptions: null'
    console.log('Result:', result);
    // 'Result: 4'
  });
```

Transforms
----------

### limit
Limits the stream to the first `n` entries.

```js
s = pvc.source( ['a', 'b', 'c', 'd', 'e'] ).limit(2)
s.read() // 'a'
s.read() // 'b'
s.read() // null
```

### skip
Skips the first `n` entries.

```js
s = pvc.source( ['a', 'b', 'c', 'd', 'e'] ).skip(2)
s.read() // 'c'
s.read() // 'd'
s.read() // 'e'
s.read() // null
```

### map
Map the incoming objects, passing the mapped objects.  If the mapping function
throws an error, pass that through.  It will drop `null` or `undefined` output
values.

```js
pvc.source(1, 2, 3)
  .map(function (x) {
    if (x == 2)
      throw new Error('BAD');
    else
      return x * 2
  })
  .toArray( function (exceptions, results) {
    console.log('Exceptions:', exceptions);
    // 'Exceptions: [ [Error: BAD] ]'
    console.log('Results:', results);
    // 'Results: [2, 4]'
  });
```

### mapAsync
Map the incoming objects through an asynchronous function, passing the mapped
objects.  The mapping function takes the incoming object and a node-style
callback.  If the callback is passed a non-null argument in the first position,
it will pass it as an exception.  Arguments in the second position will be
passed as outputs.  It will drop `null` or `undefined` outputs.

```js
pvc.source(1, 2, 3)
  .mapAsync(function (x, callback) {
    process.nextTick( function () {
      if (x == 2)
        callback(new Error('BAD'));
      else
        callback(null, x * 2);
    })
  })
  .toArray( function (exceptions, results) {
    console.log('Exceptions:', exceptions);
    // 'Exceptions: [ [Error: BAD] ]'
    console.log('Results:', results);
    // 'Results: [2, 4]'
  });
```

### filter
Filter the incoming objects, only passing objects that pass the truth test.
If the filter function throws an error, pass it through as an exception.

```js
pvc.source(1, 2, 3)
  .filter(function (x) {
    if (x == 2)
      throw new Error('BAD');
    else
      return x == 3
  })
  .toArray( function (exceptions, results) {
    console.log('Exceptions:', exceptions);
    // 'Exceptions: [ [Error: BAD] ]'
    console.log('Results:', results);
    // 'Results: [3]'
  });
```

### filterAsync
Pass the inputs through an asynchronous filter function.  The filter function
is passed the input object, and a node-style callback.

```js
pvc.source(1, 2, 3)
  .mapAsync(function (x, callback) {
    process.nextTick( function () {
      if (x == 2)
        callback(new Error('BAD'));
      else
        callback(null, x == 3);
    })
  })
  .toArray( function (exceptions, results) {
    console.log('Exceptions:', exceptions);
    // 'Exceptions: [ [Error: BAD] ]'
    console.log('Results:', results);
    // 'Results: [3]'
  });
```

### doto
Operate on the incoming elements and pass them through.  Note that currently
this is performed synchronously; pass through a function wrapped in
`process.nextTick` to make it perform asynchronously.

```js
pvc.source(1, 2, 3)
  .doto(function (x) {
    console.log('Passing through:', x);
    // 'Passing through: 1'
    // 'Passing through: 2'
    // 'Passing through: 3'
  })
  .toArray( function (exceptions, results) {
    console.log('Exceptions:', exceptions);
    // 'Exceptions: null'
    console.log('Results:', results);
    // 'Results: [1, 2, 3]'
  });
```


### separate
Separate incoming arrays, so that they are flattened on the output.
Takes two options, lax and recursive.  If `recursive == false` (default),
it does not flatten array elements of arrays.  If `recursive == true`, it will
recursively flatten array elements of arrays (all the way down).  If
`lax == false` (default), it will emit an error if it receives a non-array
input.  If `lax == true`, it will allow non-array inputs to pass through
unchanged.

```js
s = pvc.source([ [1], [2, 3] ]).pipe(pvc.separate())
s.read() // 1
s.read() // [2, 3]
s.read() // null

s = pvc.separate()
s.write( 1 )
s.on('error', function (e) {
  // Will emit an error because 1 is not an array!
})

s = pvc.separate({ lax: true })
s.write( 1 )
s.read() // 1
```

### split
TODO: Description

### debounce
TODO: Description
