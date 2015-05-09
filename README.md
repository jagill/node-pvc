pvc
===

pvc is a lightweight (no dependencies!) collection of utilities for Node.js
streams in object mode.

```javascript
var pvc = require('pvc');

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
