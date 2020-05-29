
const gulp = require("gulp");

const sass = require('gulp-sass');
const browserify = require('browserify');
const babelify = require('babelify');
const uglify = require('gulp-uglify');
const stripCssComments = require('gulp-strip-css-comments');


const concat = require("gulp-concat");
const source = require('vinyl-source-stream');
const    buffer = require('vinyl-buffer');


gulp.task('sass', function () {
    return gulp.src('src/js/components/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(concat("ZAViewer.css"))
        .pipe(gulp.dest('./assets/css'));
});

gulp.task('build', function () {
    return browserify({ entries: './src/js/main.js', debug: true })
        .transform("babelify", {
            presets: ['@babel/preset-env', "@babel/preset-react"]
        })
        .bundle()
        .pipe(source('main.js'))
        .pipe(buffer())
        .pipe(gulp.dest('./assets/js'));
});

gulp.task('buildall', gulp.parallel('sass', 'build'), (done) => {
    done();
});

gulp.task('watch', function () {
    gulp.watch('./src/js/**/*.js', gulp.series('buildall'));
});


gulp.task('apply-prod-environment', (done) => {
    process.env.NODE_ENV = 'production';
    done();
});

gulp.task('sassprod', function () {
    return gulp.src('src/js/components/*.scss')
        .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
        .pipe(stripCssComments())
        .pipe(concat("ZAViewer.css"))
        .pipe(gulp.dest('./assets/css'));
});

gulp.task('buildprod', function () {
    return browserify({ entries: './src/js/main.js', debug: true })
        .transform("babelify", {
            presets: ['@babel/preset-env', "@babel/preset-react"]
        })
        .bundle()
        .pipe(source('main.js'))
        .pipe(buffer())
        .pipe(uglify({
            mangle: false,
            output: {
                beautify: false,
                comments: false
            }
        }))
        .pipe(gulp.dest('./assets/js'));
});

gulp.task('buildprodall', gulp.series('apply-prod-environment', 'sassprod', 'buildprod'), (done) => {
    done();
});