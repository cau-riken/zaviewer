import logging
#logging.basicConfig(format='%(asctime)s : %(message)s')

import sys
import os
import tempfile

from shutil import copyfile
import re
from datetime import datetime
import json
import base64

from progress.spinner import Spinner
from progress.bar import Bar

import SimpleITK as sitk
import numpy as np

import deepzoom
import PIL
# disable image size check, since input image are quite large, but trusted
PIL.Image.MAX_IMAGE_PIXELS = None


def createDeepZoomImage(source, output):
    # set up Deep Zoom Image creation parameters
    creator = deepzoom.ImageCreator(
        tile_size=256,
        tile_overlap=1,
        # jpeg format because png tiles are rendered with black border in OSD (v2.4.2, maybe related to https://github.com/openseadragon/openseadragon/issues/1683 )
        tile_format="jpg",
        image_quality=0.5,
        resize_filter="antialias"
    )
    # Create Deep Zoom image pyramid from source
    creator.create(source, output)


def createDeepZoomImages(input_path, output_path):

    for infile in [f for f in os.scandir(input_path) if f.is_file()]:
        (short_filename, extension) = os.path.splitext(infile)
        if extension == '.tif':
            source = os.path.join(input_path, short_filename + extension)
            output = os.path.join(output_path, short_filename + '.dzi')
            print(f"Creating DZI for {short_filename}{extension} ...")
            createDeepZoomImage(source, output)
            print("\t... done.")

# -----------------------------------------------------------------------------


def changeSize(in_filename, out_filename, scale_factor=0.1, desired_size=None):

    image = sitk.ReadImage(in_filename)
    resample = sitk.ResampleImageFilter()
    resample.SetInterpolator = sitk.sitkLinear
    resample.SetOutputDirection = image.GetDirection()
    resample.SetOutputOrigin = image.GetOrigin()

    orig_size = np.array(image.GetSize(), dtype=np.int)
    orig_spacing = image.GetSpacing()
    # resize by final pixel or via scale factor
    if desired_size:
        new_size = desired_size
        # might not preserve aspect-ratio to respect desired_size
        new_spacing = (orig_spacing[0]*orig_size[0]/desired_size[0],
                       orig_spacing[1]*orig_size[1]/desired_size[1])
    else:
        new_size = orig_size*(scale_factor)
        # Image dimensions are in integers
        new_size = np.ceil(new_size).astype(np.int)
        new_size = [int(s) for s in new_size]
        new_spacing = (orig_spacing[0]/scale_factor,
                       orig_spacing[1]/scale_factor)

    resample.SetSize(new_size)
    logging.info("Original image size: " + str(orig_size))
    logging.info("New image size: " + str(new_size))
    logging.info("Original image spacing: " + str(orig_spacing))
    logging.info("New image spacing: " + str(new_spacing))
    resample.SetOutputSpacing(new_spacing)

    newimage = resample.Execute(image)

    sitk.WriteImage(newimage, out_filename)


# -----------------------------------------------------------------------------
AXIS = ('coronal', 'sagittal', 'axial')
DELINEATION_RELPATH = "SVGs"


def getCleanedAndCheckedPath(input_query, error_message, default_path=None):
    user_value = input(f"{input_query} : ")
    path = user_value or default_path
    # get absolute path
    if not os.path.isabs(path):
        path = os.path.normpath(os.path.realpath(path))

    # check that a correct path has been enterred
    if os.path.isdir(path):
        return path
    else:
        message = f"{error_message} : {user_value}"
        logging.critical(message)
        raise Exception(message)


def getLayersNFiles(input_path, config, phys_unit):

    layersCompo = list()
    overlaysCompo = list()
    axisLayersFiles = {'compolayers': layersCompo,
                       'compooverlays': overlaysCompo, 'axis': {}}

    referenceAxis = None
    referenceLayerName = None
    # input image folder must contain at least one of the following sub-folders: coronal, sagittal and axial, in that order.
    for axis in AXIS:
        axis_path = os.path.join(input_path, axis)
        if os.path.isdir(axis_path):
            print(f"... retrieving data for {axis} axis ...\n")

            if not referenceAxis:
                referenceAxis = axis

                layerDir_re = re.compile('layer(\d+)_(.+)$', re.IGNORECASE)
                # The first found axis composition will serve as a reference: subsequent axis must have same layers and overlays
                for layerEntry in [d for d in os.scandir(axis_path) if d.is_dir()]:
                    layerDir_search = layerDir_re.match(layerEntry.name)
                    if layerDir_search:
                        safename = base64.urlsafe_b64encode(
                            layerEntry.name.encode('UTF-8')).decode('UTF-8')
                        layersCompo.append({
                            'ordnum': layerDir_search.group(1),
                            'name': layerDir_search.group(2),
                            'dirname': layerEntry.name,
                            'safename': safename
                        })

                # TODO check for duplicate layer's name

                # layers are ordered from bottom to top
                layersCompo = sorted(
                    layersCompo, key=lambda layer: layer['ordnum'])
                # reference layer is the bottom one
                referenceLayerName = layersCompo[0]['name']

                # FIXME For now, expecting only 1 overlay set (Regions)
                overlayDir_re = re.compile('overlay(\d+)_(.+)$', re.IGNORECASE)
                for overlayEntry in [d for d in os.scandir(axis_path) if d.is_dir()]:
                    overlayDir_search = overlayDir_re.match(overlayEntry.name)
                    if overlayDir_search:
                        #safename = base64.urlsafe_b64encode(layerEntry.name.encode('UTF-8')).decode('UTF-8')
                        safename = DELINEATION_RELPATH
                        overlaysCompo.append({
                            'ordnum': overlayDir_search.group(1),
                            'name': overlayDir_search.group(2),
                            'dirname': overlayEntry.name,
                            'safename': safename
                        })

                print(
                    f"\t{len(layersCompo)} layer(s) and {len(overlaysCompo)} overlay(s) found")

            # Note: keys' insertion order is preserved in dictionary (Python >=3.6)
            axisLayersFiles['axis'][axis] = {'layers': {}}

            for layer in layersCompo:
                axis_layerpath = os.path.join(axis_path, layer['dirname'])
                layerName = layer['name']

                # layers from reference axis must be defined
                if axis != referenceAxis:
                    if not os.path.isdir(axis_layerpath):
                        message = f"Missing layer '{layerName}' for {axis} axis"
                        logging.critical(message)
                        raise Exception(message)

                images = []

                # retrieve image file in input folder : image name must contain a number as suffix (before extension)
                imageFile_re = re.compile(
                    '((?:.+_)?(\d+))(\.(?:tif))$', re.IGNORECASE)
                imageEntries = [f for f in os.scandir(
                    axis_layerpath) if f.is_file()]
                bar = Bar(f"Reading images in layer {layer['name']} ", suffix='%(percent)d%%', max=len(
                    imageEntries)+1, check_tty=False)
                bar.next()

                for imageEntry in imageEntries:

                    imageFile_search = imageFile_re.match(imageEntry.name)
                    if imageFile_search:

                        reader = sitk.ImageFileReader()

                        reader.SetFileName(imageEntry.path)
                        reader.LoadPrivateTagsOn()

                        reader.ReadImageInformation()

                        # for k in reader.GetMetaDataKeys():
                        #    v = reader.GetMetaData(k)
                        #    print("({0}) = = \"{1}\"".format(k, v))

                        # currently only expect 2D images
                        # FIXME check it is actual 2D image
                        # if reader.GetDepth()==0:
                        # if reader.GetDimension()==2

                        #
                        # distance between pixels along each of the dimensions, in consistent, but not specified, units (nm, mm, m ?)
                        spacing = reader.GetSpacing()
                        # size in pixels along each of the dimensions
                        size = reader.GetSize()

                        # images should be aligned on their respective origin
                        origin = reader.GetOrigin()
                        # reader.GetDirection(): Direction cosine matrix (axis directions in physical space).

                        images.append({
                            'ordnum': imageFile_search.group(2),
                            'shortname': imageFile_search.group(1),
                            'ext': imageFile_search.group(3),
                            'width': size[0],
                            'height': size[1],
                            'spacing': spacing,
                            'origin': origin
                        })
                        image2D = None

                    bar.next()

                bar.finish()

                # every layers must have same number of slice images (within a specific axis)
                if layerName != referenceLayerName:
                    if len(images) != len(axisLayersFiles['axis'][axis]['layers'][referenceLayerName]['images']):
                        raise Exception(
                            f"Image number in '{layerName}' for {axis} axis is different from layer '{referenceLayerName}'")

                # TODO check that same ordnums are used in every layers

                # images are ordered by their ordinal number
                images = sorted(images, key=lambda image: int(image['ordnum']))
                axisLayersFiles['axis'][axis]['layers'][layerName] = {
                    'name': layerName,
                    'path': axis_layerpath,
                    'safename': layer['safename'],
                    'images': images
                }

                print(
                    f"\t{len(images)} images(s) found in layer '{layer['name']}'\n")

            #
            axisLayersFiles['axis'][axis]['overlays'] = {}

            for overlay in overlaysCompo:
                # TODO handle multipler overlays

                axis_overlaypath = os.path.join(axis_path, overlay['dirname'])
                overlayName = overlay['name']

                #
                if not os.path.isdir(axis_overlaypath):
                    message = f"Missing overlay '{overlayName}' for {axis} axis"
                    logging.critical(message)
                    raise Exception(message)

                images = []

                svgFile_re = re.compile(
                    '((?:.+_)?(\d+))(\.svg)$', re.IGNORECASE)
                for svgEntry in [f for f in os.scandir(axis_overlaypath) if f.is_file()]:
                    svgFile_search = svgFile_re.match(svgEntry.name)
                    if svgFile_search:
                        images.append({
                            'ordnum': svgFile_search.group(2),
                            'shortname': svgFile_search.group(1),
                            'ext': svgFile_search.group(3),
                        })

                # images are ordered by their ordinal number
                images = sorted(images, key=lambda image: int(image['ordnum']))
                axisLayersFiles['axis'][axis]['overlays'][overlayName] = {
                    'name': overlayName,
                    'path': axis_overlaypath,
                    'safename': overlay['safename'],
                    'images': images
                }

                # TODO check that same ordnums are used as in layers
                # TODO check that same same number of overlay file as number of slice

    # update config with layer composition
    config['data'] = {}
    for layer in layersCompo:
        config['data'][layer['safename']] = {
            "metadata": layer['name']
        }

    config_subview = {
        "foldername": "subview",
        "size": 200
    }

    isMultiPlane = len(axisLayersFiles['axis'].keys()) > 1
    if isMultiPlane:
        config_subview.update({
            "x_min": 1,
            "x_max": 200,
            "y_min": 1,
            "y_max": 200,
            "z_min": 1,
            "z_max": 200,
        })
    else:
        config_subview.update({
            "min": 1,
            "max": 200
        })

    config['subview'] = config_subview

    # update config with axis slices count
    for axis in axisLayersFiles['axis'].keys():
        nbSlices = len(axisLayersFiles['axis'][axis]
                       ['layers'][referenceLayerName]['images'])

        config['subview'][f"{axis}_slide"] = nbSlices

        if isMultiPlane:
            # TODO get users input for actual slice step
            config[f"{axis}_slice_step"] = 1
        else:
            config['slide_count'] = nbSlices
            # TODO get users input for actual slice step
            config['slice_step'] = 1

    #

    return axisLayersFiles


def prepareImages(axisLayersFiles, config, ouput_path, phys_unit):

    # TODO for single plane mode, enabled users to select preferred subview insteqd of predefined value
    PLANE_PREFSUBVIEW = {"axial": "coronal",
                         "coronal": "sagittal",
                         "sagittal": "axial"}

    print('Preparing images...')

    referenceAxis = next(iter(axisLayersFiles['axis']))
    referenceLayerName = next(
        iter(axisLayersFiles['axis'][referenceAxis]['layers']))

    # FIXME for now only 1 single overlay set, which corresponds to delineations
    hasDelineations = len(
        axisLayersFiles['axis'][referenceAxis]['overlays'].keys())

    isMultiPlane = len(axisLayersFiles['axis'].keys()) > 1

    # all othogonal planes to existing slice axis, i.e. planes for which subview has to be prepared
    requiredOrthogPlanes = axisLayersFiles['axis'].keys() if isMultiPlane else [
        PLANE_PREFSUBVIEW[axis] for axis in axisLayersFiles['axis'].keys()]
    # when there is not slice provided to populate a subview, use default image
    subviewToDefault = [
        plane for plane in requiredOrthogPlanes if plane not in axisLayersFiles['axis']]

    for axis in axisLayersFiles['axis'].keys():

        print(f"\t{axis}")
        subviewBasePath = os.path.join(
            ouput_path, config['subview']['foldername'])
        os.makedirs(subviewBasePath, exist_ok=True)

        for layerName, layer in axisLayersFiles['axis'][axis]['layers'].items():
            print(f"\t\t{layerName}")

            # create output folder for layer images
            layer_ouputpath = os.path.join(ouput_path, layer['safename'])
            if isMultiPlane:
                layer_ouputpath = os.path.join(layer_ouputpath, axis)

            os.makedirs(layer_ouputpath, exist_ok=True)

            nbImages = len(layer['images'])
            centerImageIndex = nbImages // 2

            bar = Bar('Processing slices images... ', suffix='%(percent)d%%', max=nbImages *
                      (2 if layerName == referenceLayerName else 1) + 1, check_tty=False)
            bar.next()

            # image are assumed to:
            #  * have same spacing values,
            #  * be aligned on their registered origin,
            # => therefore they will be cropped on the largest common area from the origin
            cropWidth = cropHeigth = sys.maxsize
            for image in layer['images']:
                cropWidth = int(min(image['width'] - image['origin'][0], cropWidth))
                cropHeigth = int(min(image['height'] - image['origin'][1], cropHeigth))

            for index, image in enumerate(layer['images']):

                # create DeepZoom image for the slice
                source = os.path.join(
                    layer['path'], image['shortname'] + image['ext'])
                output = os.path.join(layer_ouputpath, str(index) + '.dzi')

                #
                with tempfile.TemporaryDirectory() as tmpDir:
                    needsCropping = (image['width'] - image['origin'][0] > cropWidth) or (image['height'] - image['origin'][1] > cropHeigth)
                    if needsCropping:
                        #create temporary cropped image
                        tempImgPath = os.path.join(tmpDir, 'croppedImg' + image['ext'])
                        image2D = sitk.ReadImage(source)

                        #extract subregion using ExtractImageFilter
                        extract = sitk.ExtractImageFilter()
                        extract.SetSize([cropWidth, cropHeigth])
                        extract.SetIndex([int(image['origin'][0]), int(image['origin'][1])])
                        croppedImg = extract.Execute(image2D)
                        sitk.WriteImage(croppedImg, tempImgPath)
                        source = tempImgPath

                        image['final_width'] = cropWidth
                        image['final_height'] = cropHeigth
                    else:
                        image['final_width'] = image['width']
                        image['final_height'] = image['height']

                    #create actual DeepZoom image for the slice
                    createDeepZoomImage(source, output)

                bar.next()

                # subview images are create from reference layer
                if layerName == referenceLayerName:

                    # create subview image(s) because current axis is used as subview for another axis
                    # FIXME works only if current axis and its orthogonal plane have same number of slices!
                    if axis in requiredOrthogPlanes:

                        if isMultiPlane or index == centerImageIndex:

                            # in single plane mode, only 1 image for the subview, but one for each slice in multiplane
                            subviewPath = os.path.join(
                                subviewBasePath, axis) if isMultiPlane else subviewBasePath
                            os.makedirs(subviewPath, exist_ok=True)

                            subviewImageFile = os.path.join(
                                subviewPath, (str(index) if isMultiPlane else 'subview') + '.jpg')
                            changeSize(
                                os.path.join(
                                    layer['path'], image['shortname'] + image['ext']),
                                subviewImageFile,
                                desired_size=[200, 200])

                    # current axis' subview can not be generated, use default image instead
                    orthogplane = PLANE_PREFSUBVIEW[axis]
                    if orthogplane in subviewToDefault:
                        if isMultiPlane or index == centerImageIndex:

                            defaultSubview = os.path.join(os.path.dirname(
                                __file__), 'assets', 'subview_' + orthogplane + '.jpg')

                            subviewPath = os.path.join(
                                subviewBasePath, orthogplane) if isMultiPlane else subviewBasePath
                            os.makedirs(subviewPath, exist_ok=True)

                            subviewImageFile = os.path.join(
                                subviewPath, (str(index) if isMultiPlane else 'subview') + '.jpg')

                            # copy SVG to output dir
                            copyfile(defaultSubview, subviewImageFile)

                    bar.next()
            bar.finish()

        if 'first_access' not in config:
            config['first_access'] = {
                "plane": axis,
                "slide": centerImageIndex,
                # TODO set value depending on user input
                "delineations": 'show' if hasDelineations else 'hide'
            }
            config['delineations'] = DELINEATION_RELPATH if hasDelineations else ''

        for overlayName, overlay in axisLayersFiles['axis'][axis]['overlays'].items():
            print(f"\t\t{overlayName}")

            # create output folder for layer images
            overlay_ouputpath = os.path.join(ouput_path, overlay['safename'])
            if isMultiPlane:
                overlay_ouputpath = os.path.join(overlay_ouputpath, axis)

            os.makedirs(overlay_ouputpath, exist_ok=True)

            # TODO check SVG conformance
            nbImages = len(overlay['images'])

            bar = Bar('Processing overlay images... ', suffix='%(percent)d%%', max=nbImages, check_tty=False)

            for index, image in enumerate(overlay['images']):
                bar.next()
                source = os.path.join(
                    overlay['path'], image['shortname'] + image['ext'])
                output = os.path.join(
                    overlay_ouputpath, 'Anno_' + str(index) + image['ext'])
                # copy SVG to output dir
                copyfile(source, output)

            bar.finish()

    refImage = axisLayersFiles['axis'][referenceAxis]['layers'][referenceLayerName]['images'][0]

    if 'image_size' not in config:
        config['image_size'] = refImage['final_width']

    if 'matrix' not in config:
        matrix = [0] * 16
        # spacing along image dimensions, in millimeters
        matrix[0] = refImage['spacing'][0] * phys_unit * 1E-3
        matrix[10] = refImage['spacing'][1] * phys_unit * 1E-3
        config['matrix'] = ','.join(str(v) for v in matrix)


def saveConfig(config_filepath, prev_config, config):
    '''
    config['verofdata'] = {
                "all": {
                        "label": title,
                        "uri": uri
                }
        }
    '''

    # back up prexisiting config file
    if prev_config:
        os.rename(config_filepath, config_filepath +
                  datetime.now().isoformat())

    with open(config_filepath, 'w') as config_file:
        json.dump(config, config_file, indent=2)


def startGuidedImport():
    ouput_path = ""
    ouput_path = getCleanedAndCheckedPath(
        "Please indicate output path", "Output path not found", ouput_path)

    print(f"Config & data will be generated in : {ouput_path}")
    config = {}

    # retrieve existing config file, if any
    config_filepath = os.path.join(ouput_path, 'viewer.json')

    prev_config = None
    if os.path.exists(config_filepath):
        if os.path.isfile(config_filepath):
            print(
                f"... inspecting pre-existing config from : {config_filepath}\n")
            with open(config_filepath, 'r') as config_file:
                prev_config = json.loads(config_file.read())
        else:
            raise Exception(
                f"Could not save config in non-file element : {config_filepath}")

    if prev_config is not None:
        logging.debug("pre-exisiting config:",
                      json.dumps(prev_config, indent=2))

    # Docker instructions require data_root_path = "data"
    # data_root_path
    (base_outpath, data_root_path) = os.path.split(ouput_path)
    #data_root_path = './' + data_root_path
    data_root_path = './data'

    if prev_config is not None and prev_config['data_root_path'] != data_root_path:
        print(
            f"[!] non-matching 'data_root_path' parameter, keeping pre-existing value ({prev_config['data_root_path']})")
        config['data_root_path'] = prev_config['data_root_path']
    else:
        config['data_root_path'] = data_root_path

    input_path = getCleanedAndCheckedPath(
        "Path of the source images", "Path of the source images not found")

    # physical unit used in the image spacing properties, hence can be used to determine physical size of the image
    phys_unit = 1
    phys_unit = float(input(
        f"Physical unit used in images, in micrometer ({phys_unit}) : ") or phys_unit)

    #copy provided hierarchical region information resource to output folder
    REGIONTREE_FILENAME = 'regionTree.json'
    regionTreeFilePath = os.path.join(os.path.dirname(__file__), 'assets', REGIONTREE_FILENAME)
    print(f"Copying hierarchical regions info ({regionTreeFilePath}) in output folder.")
    copyfile(regionTreeFilePath, os.path.join(ouput_path, REGIONTREE_FILENAME))
    config['tree'] = data_root_path

    axisLayersFiles = getLayersNFiles(input_path, config, phys_unit)
    # print("axisLayersFiles :",  json.dumps(axisLayersFiles, indent=2))
    prepareImages(axisLayersFiles, config, ouput_path, phys_unit)
    saveConfig(config_filepath, prev_config, config)


startGuidedImport()
