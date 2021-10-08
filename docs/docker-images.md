# Building Docker images

ZAViewer Docker images are available for download from [dedicated Docker Hub repository](https://hub.docker.com/r/rikencau/zaviewer).

<br/>

We describe below the procedure to build the images from the sources.

Prerequisite:

* [Docker Engine](https://docs.docker.com/engine/) ^20.10 must be installed and running on your machine.

* Clone this git repo to get the latest sources

    ```sh
    git clone https://github.com/cau-riken/zaviewer.git

    cd zaviewer
    ```


## Light web-server for the User Interface Docker image <a id="build-image-ui"></a>

The provided Docker script will:

* download dependencies and build ZAViewer UI from the source within a temporary image (so you don't have to setup the build environement on your machine)

* create an image containing a light memory footprint web server to serve the generated ZAViewer Web App.


1. Go to working directory containing ZAViewer sources :

    ```sh
    cd zaviewer
    ```

2. Build the image

    ```sh
    docker build --no-cache --network=host \
      -f docker_scripts/Dockerfile.ui \
      -t rikencau/zaviewer:latest-ui .
    ```


## Brain slice images import utility Docker image<a id="build-image-prepimg"></a>


1. Go to working directory containing ZAViewer sources :

    ```sh
    cd zaviewer
    ```

2. Build the image
 
    ```sh
    docker build --no-cache --network=host \
      -f docker_scripts/Dockerfile.prepDZIImages \
      -t rikencau/zaviewer:latest-prepimg scripts/
    ```

## Region delineation editing UI Docker image<a id="build-image-regionedit"></a>

In order to save edited regions as SVG files, a minimal backend component needs to be used, thus it is necessary to create a new Docker image based on the ZAViewer Docker UI image.

1. Go to working directory containing ZAViewer sources :

    ```sh
    cd zaviewer
    ```

2. Build the image

    ```sh
    docker build --no-cache --network=host \
      -f docker_scripts/Dockerfile.ed \
      -t rikencau/zaviewer:latest-ed .
    ```

