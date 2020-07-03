# zaviewer - Zooming Atlas Viewer 

zaviewer is a web 2D image viewer used to explore the Brain/MINDS Marmoset Reference Atlas.

Project web site [brainminds.riken.jp](https://www.brainminds.riken.jp/)

---

## building bundles from the source code

### requirement and dependencies

* `NodeJs` and `gulp` must be installed on your platform beforehand


* Use terminal windows and go to source folder 

```sh
cd zaviewer
```

* For **first time build only**, modules and devtools dependencies have to be installed :

```sh
node install
```

* build bundles from sources :

```sh
gulp builproddall
```

`Javascript` and `css` bundles are produced in `assets/` subfolder