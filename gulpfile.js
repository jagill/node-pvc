/* jshint node:true */

var gulp = require('gulp');
var coffee = require('gulp-coffee');
var mocha = require('gulp-mocha');

var paths = {
  coffee: [
    'src/*.coffee'
  ],

  test: [
    'test/*.coffee'
  ],

  testData: [
    'test/data/**'
  ],

  dist: 'dist',
};

gulp.task('coffee', function () {
  return gulp.src(paths.coffee)
    .pipe(coffee())
    .pipe(gulp.dest(paths.dist));
});

gulp.task('test.build', function () {
  return gulp.src(paths.test)
    .pipe(coffee())
    .pipe(gulp.dest(paths.dist));
});

gulp.task('test.data', function () {
  // return gulp.src(paths.testData, { base: paths.test })
  return gulp.src(paths.testData, { base: 'test/' })
    .pipe(gulp.dest(paths.dist));
});

gulp.task('test', ['build', 'test.build', 'test.data'], function () {
  return gulp.src(paths.dist +'/*Test.js', {read: false})
    .pipe(mocha({reporter: 'spec'}));
});

gulp.task('watch', ['coffee'], function () {
  gulp.watch(paths.coffee, ['coffee']);
  gulp.watch(paths.test, ['test']);
});

gulp.task('build', ['coffee']);

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['build']);
