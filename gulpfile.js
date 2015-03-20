/*global -$ */
'use strict';
// generated on 2015-03-05 using generator-gulp-webapp 0.3.0
var plugins = require('gulp-load-plugins')();
var _ = require('underscore');
var argv = require('yargs').argv;
var brfs = require('brfs');
var browserify = require('browserify');
var browserSync = require('browser-sync');
var gulp = require('gulp');
var mochify = require('mochify');
var reload = browserSync.reload;
var source = require('vinyl-source-stream');
var transform = require('vinyl-transform');
var watchify = require('watchify');

//var sourcemaps = require('gulp-sourcemaps');
//var buffer = require('vinyl-buffer');

gulp.task('help', plugins.taskListing);

gulp.task('styles', function () {
  return gulp.src('app/styles/main.scss')
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.sass({
      outputStyle: 'nested', // libsass doesn't support expanded yet
      precision: 10,
      includePaths: ['.'],
      onError: console.error.bind(console, 'Sass error:')
    }))
    .pipe(plugins.postcss([
      require('autoprefixer-core')({browsers: ['last 1 version']})
    ]))
    .pipe(plugins.sourcemaps.write())
    .pipe(gulp.dest('.tmp/styles'))
    .pipe(reload({stream: true}));
});

gulp.task('jshint', function () {
  return gulp.src('app/scripts/**/*.js')
    .pipe(reload({stream: true, once: true}))
    .pipe(plugins.jshint())
    .pipe(plugins.jshint.reporter('jshint-stylish'))
    .pipe(plugins.if(!browserSync.active, plugins.jshint.reporter('fail')));
});

gulp.task('html', ['styles'], function () {
  var assets = plugins.useref.assets({searchPath: ['.tmp', 'app', '.']});

  return gulp.src('app/*.html')
    .pipe(assets)
    .pipe(plugins.if('*.js', plugins.uglify()))
    .pipe(plugins.if('*.css', plugins.csso()))
    .pipe(assets.restore())
    .pipe(plugins.useref())
    .pipe(plugins.if('*.html', plugins.minifyHtml({conditionals: true, loose: true})))
    .pipe(gulp.dest('dist'));
});

gulp.task('images', function () {
  return gulp.src('app/images/**/*')
    .pipe(plugins.cache(plugins.imagemin({
      progressive: true,
      interlaced: true,
      // don't remove IDs from SVGs, they are often used
      // as hooks for embedding and styling
      svgoPlugins: [{cleanupIDs: false}]
    })))
    .pipe(gulp.dest('dist/images'));
});

gulp.task('fonts', function () {
  return gulp.src('app/fonts/**/*')
    .pipe(gulp.dest('.tmp/fonts'))
    .pipe(gulp.dest('dist/fonts'));
});

gulp.task('extras', function () {
  return gulp.src([
    'app/*.*',
    '!app/*.html'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'));
});

gulp.task('clean', require('del').bind(null, ['.tmp', 'dist', 'dist-test']));

gulp.task('serve', ['styles', 'fonts'], function () {

  var bundler = watchify(
    browserify('./app/scripts/main.js', _.extend({ transform: ["brfs"] } , watchify.args))
  );
  bundler.on('update', rebundle);

  function rebundle() {
    return bundler.bundle()
      // log errors if they happen
      .on('error', plugins.util.log.bind(plugins.util, 'Browserify Error'))
      .pipe(source('main.js'))
      .pipe(gulp.dest('./dist'));
  }

  browserSync({
    notify: true,
    server: {
      baseDir: ['.tmp', 'app', 'dist'],
    },
    port: 9000,
    ghostMode: {
      click: false,
      form: false,
      location: false,
      scroll: false
    },
    online: true
  });

  // watch for changes
  gulp.watch([
    'app/*.html',
    'app/images/**/*',
    'app/scripts/*',
    '.tmp/fonts/**/*'
  ]).on('change', reload);

  gulp.watch('app/styles/**/*.scss', ['styles']);
  gulp.watch('app/fonts/**/*', ['fonts']);

  return rebundle();
});

gulp.task('test', [], function () {
  mochify('./test/spec/*.spec.js', _.extend({
    reporter  : 'dot',
    phantomjs : './node_modules/.bin/phantomjs'
  }, argv)).bundle();
});

gulp.task('build', ['jshint', 'test', 'html', 'images', 'fonts', 'extras'], function () {
  return gulp.src('dist/**/*').pipe(plugins.size({title: 'build', gzip: true}));
});

gulp.task('default', ['clean'], function () {
  gulp.start('build');
});
