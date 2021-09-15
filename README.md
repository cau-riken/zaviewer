# ZAViewer - Zooming Atlas Viewer 


Table of Contents

* [Overview](#overview)
  * [Detailed Architecture](#detailed-architecture)

* [Try it!](#try-it!)
  * [Online demo](#online-demo)
  * [Run it on your computer](#local-container)
  * [Vizualise your own data](#local-data)
  * [**[DEV]** Custom processing](#dev-custproc)
  * [**[DEV]** Playing with the source code](#dev-buildfromsrc)
  * [**[DEV]** Detailed configuration settings](#dev-config)
  * [References](#references)

---

# Overview

ZAViewer is a web 2D image viewer that was primarily designed to explore the [Brain/MINDS Marmoset Reference Atlas](https://doi.org/10.24475/bma.2799).

It can display up to 3 sets of multimodal, regularly interspaced, large image slices along the 3 standard orthogonal axes (Axial, Coronal, Sagittal).
Each slice view may contains several raster images layers, and Atlas regions (represented by aligned vector images, SVG) displayed as an overlay over the raster images.



🟣 ADD [overview video presentation] 🟣

## Detailed Architecture

* ZAViewer User Interface is a javascript web application that can run in any modern Web browser (Firefox, Chrome, Edge) on a desktop or tablet environment since it is focused on displaying large images.
<br/><a id="online-demo"></a>
It is usually served from a remote web server, but can be conveniently executed locally in a container thanks to the provided Docker script.

* ZAViewer can run with a dedicated back-end (Image server & web services providing the configuration), or without (as a simple web app hosted with its image and configuration data stored as static files).

    * When used with a backend, ZAViewer can retrieve Pyramidal Images following [IIIF](https://en.wikipedia.org/wiki/International_Image_Interoperability_Framework) protocol or [IIProtocol](https://en.wikipedia.org/wiki/Internet_Imaging_Protocol).

    * The standalone version of ZAViewer can display image in [DZI (Deep Zoom Image)](http://msdn.microsoft.com/en-us/library/cc645077(v=vs.95).aspx) format.
    <br/>

    **Note**: these images may even be retrieved from a remote domain (if properly configured to serve cross-origin content)


# Try it!

## A) Online demo <a id="online-demo"></a>

Have a look at [ZAViewer_Reference_Brain_v2](https://dataportal.brainminds.jp/ZAViewer_Reference_Brain_v2/)

---

## B) Build and run it on your computer <a id="local-container"></a>

Prerequisite: [Docker](https://docs.docker.com/get-docker/) must be installed and running on your machine.

The provided Docker script will:

* download dependencies and build ZAViewer UI from the source within a temporary image (so you don't have to setup the build environement on your machine)

* create an image containing a light memory footprint web server to serve the generated ZAViewer Web App.

### **Step by step procedure**

1. Clone this git repo to get the latest sources

    ```sh
    git clone https://github.com/cau-riken/zaviewer.git
    ```

2. Build the image

    ```sh
    cd zaviewer

    docker build --no-cache -f docker_scripts/Dockerfile.ui \
    -t zaviewer_ui:2.1.0 .
    ```

3. Run the web-server container:
    ```sh
    docker run -it --rm -p 9090:80 zaviewer_ui:2.1.0
    ```
    **►** This container will display web-server log in the terminal window and keep running until stopped using `[Ctrl-C]`, then the container will be automatically removed (but ZAViewer Docker image will remain in your local repository for later use)
    <br/><br/>



4. <a id="run-localcont-remotedata"></a> Launch ZAViewer by opening the following URL in your web browser :

    [`http://localhost:9090/?datasrc=https://dataportal.brainminds.jp/ZAViewer_Reference_Brain_v2`](http://localhost:9090/?datasrc=https://dataportal.brainminds.jp/ZAViewer_Reference_Brain_v2)

    **►** in this configuration, images are actually retrieved from a remote domain, as specified by the `datasrc` parameter.
    <br/><br/>


**Notes:**


   * If you don't intend to use ZAViewer anymore, you may remove its Docker image with the following command:

   ```sh
        docker image rm zaviewer_ui:2.1.0
   ```

 
---


## C) Vizualise your own data <a id="local-data"></a>

ZAViewer is able to display sets of large slice images, along with several kinds of optional secondary data, such as :

* region delineation images (SVG) sets (one for each slice),
* region informations, and their hierarchical organization,
* subview images (single or sets),

A script is provided to help with the preparation and setup of the data in the right format and location, and generation of appropriate configuration file.

**Note :** It will produce Deep Zoom Images copies derived from your source images, so enough free space must be available on your disk (roughly same amount of space than the original images).

<br/>

### 1. Import and configuration script

#### 1.1 Overview

The script expects a set of slice images (single axis with only 1 layer) as minimal input.

If several layers are defined :

* Within a specific axis, every layers must contains the same number of slice images.
* All slice images of a specific axis/layer must have same size.

Moreover, in case of multiplane configuration:

* All axis must have the same layer/overlay composition.

##### 1.1.2 Parameters

The script will ask you the following parameters:

* output directory, where the generated files will be saved,
* input directory, where the source files are stored as explained below:

    The conventions detailed below must be followed so the script will be able to import your data :

    * axis directories are located in the input directory, at least 1 must be defined (`coronal`, `sagittal`, `axial`)
    * axis directory contains layers (for raster images) and overlays subdirectories (for region delineations) 
    * Layers directory name must contain :
        * the "`layer`" prefix, 
        * an integer to order the layers (from bottom to top) in the UI, 
        * an underscore separator ("`_`"), 
        * the name of the layer displayed in the UI (free string)
    * Image file name must contain :
        * any prefix,
        * an underscore separator ("`_`"), 
        * an integer to order the image slice in the UI, 
        * the image file extension ("`.tif`" as it is currently the only supported format)
    * There is only 1 overlay directory (named `overlay0_Regions`) which contains SVG files defining region delineations for each slice. These SVG files must conform to the following rules described [here](#dev-regionsvg). ZAViever includes a simple region editing feature to interactively create those SVG files and edit their content (see [here](#dev-regionedit)).

    To sum things up, the overall structure of the input directory should look like this:

    ```
    .
    ├── coronal
    │   ├── layer0_Nissl
    │   │   ├── whatever_0.tif
    │   │   ├── ...
    │   │   └── whatever_N.tif
    │   ├── layer1_T2 MRI
    │   │   ├── whatever_0.tif
    │   │   ├── ...
    │   │   └── whatever_N.tif
    │   ├── overlay0_Regions
    │   │   ├── whatever_0.svg
    │   │   ├── ...
    │   │   └── whatever_N.svg
    ├── sagittal
    │   ├── layer0_Nissl
    │   ...
    └── axial
        ├── layer0_Nissl
        ...
    ```

##### 1.1.3 Optional resources

###### 1.1.3.1 Region info

An optional resource containing hierarchical organization of brain regions may be provided to ZAViewer, which will then be able to :

* dynamically show the long name of the hovered region,
* display in a treeview widget the  of all brain regions to allow naviagation and selection.

A default version of the resource (for Marmoset brain) is shipped with the script and is copied in the output folder when the script is executed. Therefore, if you wish to use your own version of the resource, just overwrite the one provided, or alternatively update the configuration file generated in the ouput folder (check configuration details [here](#descriptors-when-not-using-a-backend)).

The structure of the region information resource is detailed [there](#dev-regiondata).


###### 1.1.3.1 image for subview widget

* In case of single axis image set, you may provide a small image from on an orthogonal plane which will be displayed in the subview wigdet (it allows to see the current slice position in the set)


#### 1.2 Install script dependencies


🟠 Possible improvement: change procedure to run script inside a Docker container 🟠


```sh
cd zaviewer/scripts

python3 -m venv env

source env/bin/activate

git clone https://github.com/openzoom/deepzoom.py.git

cd deepzoom.py

python3 setup.py install

pip3 install progress SimpleITK numpy
```

#### 1.3 Run the script

```sh
cd ..

python3 prepareDZImages.py

deactivate
```


### 2. Run ZAViewer to display prepared data

The same ZAViewer Docker image as before is used, but with different parameters to display local data.

1. Run the web-server container:

    ```sh
    docker run -it --rm \
    -v /full/path/to/output/dir:/usr/share/nginx/html/data:ro \
    -p 9090:80 zaviewer_ui:2.1.0
    ```

2. Launch ZAViewer by opening the following URL in your web browser :

    [`http://localhost:9090/`](http://localhost:9090/)

**Notes :** 

* Replace `/full/path/to/output/dir` with the absolute path to the output directory where images and configuration file have been prepared.
* It is of course possible to prepare distinct sets of images into distinct ouput directories, and display one or the other by specifying the right path when running the web-server container (just change the `/full/path/to/output/dir` path).
* Several instances of the web-server container may be launched concurrently, just be careful to use distinct listening ports on each instances (e.g. replace `9090` by `9010` or any unused value on the command line to launch the container and in address bar of your web browser).

**Warning :** 

* For MS-Windows, Docker might not be able to mount the ouput directory if it is located on a removable media.

<br/>

### 3. Implement custom processing on image clip within ZAViewer <a id="dev-custproc"></a>

It is possible to create custom image processing routine that can be run on (part of) the images displayed in ZAViewer.
These routine are Javascript code that can be easily plugged in ZAViewer as explained below.

#### Step-by-step procedure:

* declare your custom processsing code inside the following source file : [`zaviewer/extension/ZAVProcessings.js`](https://github.com/cau-riken/zaviewer/blob/master/extension/ZAVProcessings.js)
* insert the required dependencies in the inside the html fragment file : [`zaviewer/extension/customProcessings.html`](https://github.com/cau-riken/zaviewer/blob/master/extension/customProcessings.html)
<br/>(the content of this file will be included in the main page header)
* load ZAViewer and test your processing!

The same ZAViewer Docker image as before is used, but with different parameters to allow runing custom processing code.

1. Run the web-server container:

    ```sh
    docker run -it --rm \
    -v /full/path/to/output/dir:/usr/share/nginx/html/data:ro \
    -v /full/path/to/zaviewer/extension/nginx_extra.conf:/etc/nginx/conf.d/nginx_extra.conf:ro \
    -v /full/path/to/zaviewer/extension:/usr/share/nginx/html/ext:ro \
    -p 9090:80 zaviewer_ui:2.1.0
    ```

2. Launch ZAViewer by opening the following URL in your web browser :

    [`http://localhost:9090/`](http://localhost:9090/)

**Note**

* ZAViewer needs to be manually reloaded (press `[F5]` key) after changes of the custom processing code.

<br/><br/>


### 4. Editing region delineation within ZAViewer <a id="dev-regionedit"></a>

ZAViewer allows to edit the region delineations displayed on top of the slice images. In order to save edited regions as SVG files, a minimal backend component needs to be used, thus it is necessary to create a new Docker image based on the ZAViewer Docker image used so far.
As before local data will be displayed, but this time the displayed/edited region SVG will be located in a different directory.

1. Create the extended Docker image allowing to save region editing:

    ```sh
    docker build --no-cache -f docker_scripts/Dockerfile.ed -t zaviewer_ed:2.1.0 .
    ```

2. Run the UI+Editor container:

    ```sh
    docker run -it --rm \
    -v /full/path/to/output/dir:/usr/share/nginx/html/data:rw \
    -v /full/path/to/zaviewer/extension/nginx_extra.conf:/etc/nginx/conf.d/nginx_extra.conf:ro \
    -v /full/path/to/editableSVGs/dir:/usr/share/nginx/html/data/SVGEdit:rw \
    -p 9090:80 zaviewer_ed:2.1.0
    ```

    **Notes**

    * When running in editing mode, ZAViewer works on an independant set of SVG files (basically copied and renamed version of the previously used SVG).
    * These files will be retrieved from  `/full/path/to/editableSVGs/dir/` directory, and it must contain an **`ARCHIVE`** subfolder used to backup the previous version of the edited file each time modifications are saved. (**`ARCHIVE`** subfolder must be created before starting editing).
    * The SVG file names should be `AtlasReg_`**`<N>`**`.svg`, where **`<N>`** is the slice number, which is a bit different from the one used for display, but their internal structure follow the same rules (as explained [here](#dev-regionsvg)).
    * All files and directory must be readeable & writeable from the Docker container. (🟠 add more details here).


3. Launch ZAViewer by opening the following URL in your web browser :

    [`http://localhost:9090/#mode=edit&`](http://localhost:9090/#mode=edit&)

---




<br/><br/>

---
<br/><br/>

# Going further, playing with the source code [DEV] <a id="dev-buildfromsrc"></a>

## Setting up building environment to generate client UI bundles from the source code

ZAViewer UI source code is composed of Javascript and CSS files that are bundled to produce the WebApp deliverable.


### requirement and dependencies

* `NodeJs` ^v12.22.0 (and `npm` ^v6.14.11) must be installed on your platform beforehand


* Use terminal windows and go to source folder 

```sh
cd zaviewer
```

* For **first time build only**, modules and devtools dependencies have to be installed :

```sh
npm install
```

* build bundles from sources :

```sh
npm run build
```

`Javascript` and `css` bundles are produced in `assets/` subfolder

<br/><br/>

---

<br/>

## Detailed configuration settings [DEV] <a id="dev-config"></a>

The viewer is flexible thanks to its detailed configuration descriptors which describe the data to display, according to which the UI adapts its behavior.
Since ZAViewer may run with or without a backend, the configuration 

This configuration is loaded  in several steps when ZAViewer runs with a backend, 
This configuration is loaded in a single step when ZAViewer runs with or without a backend, the configuration is merged as a single simplified descriptor.

### Descriptors when using a backend

In this mode, the configuration needs to be loaded in several sequential steps.

### 1. `path.json`

This configuration descriptor is the first one loaded when the UI starts, and it is retrieved from the root URL of the UI.
It contains base URLs used to retrieve data, metadata and extended configuration descriptors.  

|entry|description|
| --- | --- |
| `admin_path` | relative base URL where subsequent configuration descriptors can be retrieved from |
| `iipserver_path` | URL prefix of the image server used to retrieved raster images  |
| `publish_path` | relative base URL where subview images, detailed region's information and SVG region delineations can be retrieved from |  

<br/>

_Example:_

```json
{
	"admin_path":"./admin/",
	"iipserver_path":"/iipsrv/iipsrv.fcgi?IIIF=/data/",
	"publish_path":"../data/"
}
```

### 2. `json.php`

This configuration descriptor is loaded in a 2nd step from the `admin_path` specified in the `path.json` configuration.
It contains information to display slices images for the 3 possible orthogonal axis.

When ZAViewer is used with images along a single axis (aka "single-plane mode") some descriptor field names are slightly simplified compared to multi-plane mode, as indicated respectively by <sup>single</sup> vs <sup>multi</sup> indicators.

|entry|description|
| --- | --- |
| `data_root_path` | _not used_ in backend mode|
| `subview` |
| `subview.foldername` | URL prefix of the subview images location (using `publish_path` base URL) |
| `subview.axial_slide` <sup>multi</sup> |  _optional_ <sup>1</sup> number of slides in the Axial image set |
| `subview.coronal_slide` <sup>multi</sup> | _optional_ <sup>1</sup> as above but for Coronal image set |
| `subview.sagittal_slide` <sup>multi</sup> | _optional_  <sup>1</sup> as above but for Sagittal image set |
| `subview.size` | size of the (square) subview images  |
| `subview.min` <sup>single</sup> | minimum boundary (i.e. left position in pixels) of the space covered by orthogonal slices on the subview image |
| `subview.max` <sup>single</sup> | maximum boundary (i.e. right position in pixels) of the space covered by orthogonal slices on the subview image |
| `subview.x_min` <sup>multi</sup> | minimum boundary (in pixels), on the subview image, of the space covered by orthogonal slices along x axis |
| `subview.x_max` <sup>multi</sup> | maximum boundary (in pixels), on the subview image, of the space covered by orthogonal slices along x axis |
| `subview.y_min` <sup>multi</sup> | same as above, but for y axis |
| `subview.y_max` <sup>multi</sup> | same as above, but for y axis |
| `subview.z_min` <sup>multi</sup> | same as above, but for z axis |
| `subview.z_max` <sup>multi</sup> | same as above, but for z axis |
| `delineations` | URL prefix of the regions delineation SVG location (using `publish_path` base URL) |
| `tree` |  URL prefix of the detailed regions information location (using `publish_path` base URL) |
| `verofdata.all`  |
| `verofdata.all.label` | Text description of the dataset (displayed the UI) |
| `verofdata.all.uri` | URI for the link displayed with the datset description |
| `first_access`  |
| `first_access.plane` <sup>multi</sup> | plane displayed by default after loading (allowed values: `axial`,`coronal` or `sagittal` ) |
| `first_access.slide` | initial slide to display |
| `first_access.delineations` | set whether Atlas region area are displayed by default (allowed values: `show` or `hide` ) |
| `matrix` | Matrix to convert image space coordinates to physical space coordinates : String representation of a single dimensional vector with the entries (values expressed in millimeters) in row major order |
| **[unused]** `gamma` | _not used_ |
| **[unused]** `bright` | _not used_ |
| `image_size` | Size (width) of image in pixel. 🟠 Assumes that images are square  |
| `slide_count` <sup>single</sup> | number of slides in the image set |
| `slice_step` | <sup>single</sup> |
| `axial_slice_step` <sup>multi</sup> |  |
| `coronal_slice_step` <sup>multi</sup> |  |
| `sagittal_slice_step` <sup>multi</sup> |  |
| **[unused]** `group_name` | _not used_ |
| **[unused]** `group_id` | _not used_ |
| `data` |  |
| `data.` _layerId_  `.metadata` | Name of the layer displayed in the UI |
| `data.` _layerId_  `.extension` | extension of the pyramidal image |
| `data.` _layerId_  `.opacity` | initial opacity of the layer |
| `data.` _layerId_  `.protocol` | image retrieval protocol (by default IIIF, or IIP)  |
| `data.` _layerId_  `.contrast` | initial contrast adjustement of the layer (IIP protocol only) |
| `data.` _layerId_  `.gamma` | initial gamma adjustment of the layer (IIP protocol only)  |

 <sup>1</sup> : value must be defined for at least 1 axis!  
 <sup>single</sup> : single-plane mode only  
 <sup>multi</sup> : multi-plane mode only  

<br/>

_Example:_

```json
{
    "data_root_path": "1",
    "subview": {
        "foldername": "RdMm8CWZuKbsP5",
        "coronal_slide": 100,
        "size": "200",
        "min": "1",
        "max": "200"
    },
    "delineations": "uYRo4S2ZITbCvZ",
    "tree": "auE7XHmvCdIcvE",
    "first_access": {
        "slide": "10",
        "delineations": "hide"
    },
    "matrix": "0.001339262803,0,0,0,0,0.050,0,0,0,0,0.001385689385,0,0,0,0,0",
    "gamma": 10,
    "bright": "1",
    "image_size": "18000",
    "slide_count": "64",
    "slice_step": "10",
    "group_name": "agroup",
    "group_id": "1",
    "data": {
        "oomgNImyri70Fd": {
            "metadata": "R01_0028_c2_50mu",
            "extension": "ptif",
            "opacity": "100"
        },
        "IjKa5lmYPlIYza": {
            "metadata": "R01_0028_nn_tracer",
            "extension": "ptif",
            "opacity": "100"
        }
    }
}
```

### Descriptors when not using a backend

In this simple mode, the configuration is loaded in a single step.

### 1. `viewer.json`

This configuration descriptor is retrieved from the root URL of the UI.
Since its contents is almost identical to `json.php` of descriptors described above, one should refers to the explanation above.  

|entry|description|
| --- | --- |
| `data_root_path` | relative base URL from where all data is loaded (raster image, SVG) |
| `subview` |
| `subview.foldername` | _see above_ |
| `subview.axial_slide` |  _optional_ <sup>1</sup> _see above_ |
| `subview.coronal_slide` | _optional_ <sup>1</sup> _see above_ |
| `subview.sagittal_slide` | _optional_  <sup>1</sup> _see above_ |
| `subview.size` | _see above_  |
| `subview.min` <sup>single</sup> | _see above_ |
| `subview.max` <sup>single</sup> | _see above_ |
| `subview.x_min` <sup>multi</sup> | _see above_ |
| `subview.x_max` <sup>multi</sup> | _see above_ |
| `subview.y_min` <sup>multi</sup> | _see above_ |
| `subview.y_max` <sup>multi</sup> | _see above_ |
| `subview.z_min` <sup>multi</sup> | _see above_ |
| `subview.z_max` <sup>multi</sup> | _see above_ |
| `delineations` | _see above_ |
| **ADD** `tree` |  _see above_ |
| `verofdata.all` |  |
| `verofdata.all.label` | _see above_ |
| `verofdata.all.uri` | _see above_ |
| `first_access`  |
| `first_access.plane` <sup>multi</sup> | _see above_ |
| `first_access.slide` | _see above_ |
| `first_access.delineations` | _see above_ |
| `matrix` | _see above_ |
| `image_size` | _see above_ |
| `slide_count` | _see above_ |
| `slice_step` | _see above_ |
| `data` |  |
| `data.` _layerId_  `.metadata` | _see above_  |

 <sup>1</sup> : at least one axis image set must be defined!  
 <sup>single</sup> : single-plane mode only  
 <sup>multi</sup> : multi-plane mode only  

<br/>

_Example:_
```json
{
    "data_root_path": "./data",
    "subview": {
        "foldername": "subview",
        "axial_slide": 235,
        "coronal_slide": 200,
        "sagittal_slide": 271,
        "x_min": 33,
        "x_max": 167,
        "y_min": 1,
        "y_max": 195,
        "z_min": 47,
        "z_max": 153,
        "size": 200
    },
    "delineations": "SVGs",
    "verofdata": {
        "all": {
            "label": "Brain\/MINDS Reference Brain Atlas Ver. 1.0",
            "uri": "https://doi.org/10.24475/bma.2799"
        }
    },
    "data": {
        "MRI": {
            "metadata": "T2 MRI"
        },
        "Nissl": {
            "metadata": "Nissl"
        }
    },
    "first_access": {
        "plane": "coronal",
        "slide": 120,
        "delineations": "show"
    },
    "matrix": "0.05,0,0,-13.54,0,0.05,0,-16.00,0,0,0.05,-3.0,0,0,0,1",
    "axial_slice_step": 1,
    "coronal_slice_step": 2,
    "sagittal_slice_step": 1,
    "image_size": 1000
}
```

## Region specific data [DEV] <a id="dev-regions"></a>

### Region delineations overlay <a id="dev-regionsvg"></a>

Region delineations display on top of images are defined in SVG files that must conform to the following rules :

* SVG viewport (defined by `<svg>`'s `width` and `height` attributes) must be identical to corresponding raster image dimensions in pixels.
* SVG user coordinate system must be identical to the viewport (i.e. it must not be redefined via a `viewBox` attribute, or by any `transform` attribute on container or graphic elements, since those will be lost when the SVG is imported in the UI).
* Therefore, coordinates used for graphic elements directly map to pixels (1 user unit maps to 1 pixel), 
* Region delineations are represented by `<path>` elements, which must have a unique value for their `id` attribute, and a region id in the custom attribute `bma:regionId` (declared namespace `xmlns:bma="https://www.brainminds.riken.jp/Atlas"`). The region hemisphere is indicated by a 2 characters suffix in the region id: an underscore separator `_` and the side letter (`L` or `R`).
* One path defining a closed rectangle the size of the image must be defined with `id="backgound"`.

```svg
<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:bma="https://www.brainminds.riken.jp/Atlas" width="18500" height="18500">
<g>
    <path id="background" style="fill:#00000000;stroke:#00000000;stroke-width:0;" d="M 0 0 L 0 18500 18500 18500 18500 0Z"/>
    <path id="A8aD_L-1" bma:regionId="A8aD_L" style="fill:#a3c2f2;stroke:#a3c2f2;stroke-width:1;" d=" M 6381 3847 ..."/>
    ... 
</g>
</svg>
```

### Region structure and extended information <a id="dev-regiondata"></a>

This optional resource is used by ZAViewer to dynamically show the long name of focused region, or to display hierarchical organisation of all brain regions.

Regions are described in the resource by `json` blocks which follow the `typescript` interface below.
Each region is identifed by a unique region abbreviation, which is specified in `bma:regionId` (or `xml:id`) attribute of overlay SVG paths' in order to make the link between shapes and brain regions.

```typescript
    interface IRegion {
        abb: string,            // region's abbreviation. MUST be unique as it is used as region identifier.
        parent: string | null,  // abbreviation of the parent region, null only for the (unique) root region.
        name: string,           // long name of the region.
        exists: number,         // indicates if the region is identified in at least one slice (then its value is 1, 0 otherwise)
        color: string,          // RGB hex value of the color associated to the region 
        children?: string[],    // [optional] list of abbreviation of sub-regions, if any
    }
```

e.g.

```json
    {
        "parent": "CorA",
        "abb": "VC",
        "name": "Visual cortex",
        "exists": 1,
        "children": [
            "V1", "V2", "V3", "V3A", "A19DI", "A19M", "V4", "V4T", "V5", "MST", "FST", "V6"]
    }
```

<br/><br/>
---

## References <a id="references"></a>

### Creating Deep Zoom Images

A list of software tools to create [Deep Zoom Images](http://msdn.microsoft.com/en-us/library/cc645077(v=vs.95).aspx) can be found [here](http://openseadragon.github.io/examples/creating-zooming-images/)


