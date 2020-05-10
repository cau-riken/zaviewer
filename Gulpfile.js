
var gulp = require("gulp");

var sass = require('gulp-sass');
var browserify = require('browserify');
var babelify = require('babelify');

var concat = require("gulp-concat");
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');


gulp.task('sass', function () {
    return gulp.src('src/js/components/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(concat("ZAViewer.css"))
        .pipe(gulp.dest('dist/css'));
});

gulp.task('build', function () {
    return browserify({ entries: './src/js/main.js', debug: true })
        .transform("babelify", {
            presets: ['@babel/preset-env', "@babel/preset-react"]
        })
        .bundle()
        .pipe(source('main.js'))
        .pipe(buffer())
        .pipe(gulp.dest('./dist'));
});

gulp.task('buildall', gulp.parallel('sass', 'build'), (done) => {
    done();
});

gulp.task('watch', function () {
    gulp.watch('./src/js/**/*.js', gulp.series('buildall'));
});
