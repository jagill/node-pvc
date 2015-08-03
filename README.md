pvc
===
[![Circle CI](https://circleci.com/gh/jagill/node-pvc/tree/master.svg?style=shield)](https://circleci.com/gh/jagill/node-pvc/tree/master)

pvc is a lightweight (no dependencies!) collection of utilities for Node.js
streams in object mode.  It provides both utilities for vanilla node streams,
and also implements an extension to Streams that allows a more functional
style.

Install with `npm install pvc`.

### Vanilla Node streams
`pvc` provides several methods for functional transformation of streams.

```javascript
var pvc = require('pvc');

// TODO: Find an easily expressed vanilla node Readable for this
var pipeline = pvc.arraySource([1, 2, 3, 4, 5, 6, 7, 8, 9])
   .pipe(pvc.map( function (n) { return n + 1; }))
   // [2, 3, 4, 5, 6, 7, 8, 9, 10]
   .pipe(pvc.filter( function (n) { return n % 2 == 0; }))
   // [2, 4, 6, 8, 10]
   .pipe(pvc.mapAsync( function (n, callback) {
     setTimeout( function () {
       callback(null, n + 10);
     }, 100)
   }))
   // [12, 14, 16, 18, 20]
   .pipe(pvc.filterAsync( function (n, callback) {
     setTimeout( function () {
       callback(null, ( n % 3 == 0 ) );
     })
   }))
   // [12, 18]

pipeline.read() // 12
pipeline.read() // 18
pipeline.read() // null
```

### PVC Streams
When working with streams, it's convenient to be able to chain the `map`/etc
methods directly onto the streams.  It's also desirable to propagate errors
downstream, so that one error in one component doesn't destroy the whole
stream.

`pvc` gives a method `source` that converts and array or a Readable stream
into a PVC Stream, which allows the following:
```javascript
var pvc = require('pvc');

var pipeline = pvc.source([1, 2, 3, 4, 5, 6, 7, 8, 9])
  .map( function (n) {
    if (n === 4) throw new Error("Don't like 4");
    return n + 1;
  })
  // [2, 3, 4, 6, 7, 8, 9, 10]
  .filter( function (n) { return n % 2 == 0; })
  // [2, 4, 6, 8, 10]
  .mapAsync( function (n, callback) {
    setTimeout( function () {
      if (n === 4)
        callback(new Error("Still don't like 4"));
      else
        callback(null, n + 10);
    }, 100)
  })
  // [12, 16, 18, 20]
  .filterAsync( function (n, callback) {
    setTimeout( function () {
      callback(null, ( n % 3 == 0 ) );
    }, 300)
  })
  // [12, 18]
  .errors( function (error) {
    console.error(error);
  })
  // [Error: Don't like 4]
  // [Error: Still don't like 4]

pipeline.read() // 12
pipeline.read() // 18
pipeline.read() // null
```

The full set of utilities are listed below.

### arraySource

Convert an array into an `objectMode == true` [Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable)
stream, one chunk per entry.

```js
s = pvc.arraySource([1, 'a', '1'])
s.read() // 1
s.read() // 'a'
s.read() // '1'
s.read() // null
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
