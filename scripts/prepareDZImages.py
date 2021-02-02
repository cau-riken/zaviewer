#!/usr/bin/env python3

from typing import Final

import logging
#logging.basicConfig(format='%(asctime)s : %(message)s')

import os
from shutil import copyfile
import re
from datetime import datetime
import json
import base64

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
AXIS: Final = ('coronal', 'sagittal', 'axial')
DELINEATION_RELPATH: Final = "SVGs"


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


def getLayersNFiles(input_path, config):

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
                print(f"\t{len(layersCompo)} layer(s) found:\n")

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

                print(f"\t{len(overlaysCompo)} overlay(s) found:\n")

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

                axisLayersFiles['axis'][axis]['layers'][layerName] = {
                    'name': layerName,
                    'path': axis_layerpath,
                    'safename': layer['safename'],
                    'images': images
                }

                # retrieve image file in input folder : image name must contain a number as suffix (before extension)
                imageFile_re = re.compile(
                    '((?:.+_)?(\d+))(\.(?:png|tif))$', re.IGNORECASE)
                for imageEntry in [f for f in os.scandir(axis_layerpath) if f.is_file()]:
                    imageFile_search = imageFile_re.match(imageEntry.name)
                    if imageFile_search:

                        image2D = sitk.ReadImage(imageEntry.path)
                        images.append({
                            'ordnum': imageFile_search.group(2),
                            'shortname': imageFile_search.group(1),
                            'ext': imageFile_search.group(3),
                            'width': image2D.GetWidth(),
                            'height': image2D.GetHeight()
                        })
                        image2D = None

                # every layers must have same number of slice images (within a specific axis)
                if layerName != referenceLayerName:
                    if len(images) != len(axisLayersFiles['axis'][axis]['layers'][referenceLayerName]['images']):
                        raise Exception(
                            f"Image number in '{layerName}' for {axis} axis is different from layer '{referenceLayerName}'")

                # TODO check that same ordnums are used in every layers

                # images are ordered by their ordinal number
                images = sorted(images, key=lambda image: image['ordnum'])

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

                axisLayersFiles['axis'][axis]['overlays'][overlayName] = {
                    'name': overlayName,
                    'path': axis_overlaypath,
                    'safename': overlay['safename'],
                    'images': images
                }

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


def prepareImages(axisLayersFiles, config, ouput_path):
    print('Preparing images...')

    referenceAxis = next(iter(axisLayersFiles['axis']))
    referenceLayerName = next(
        iter(axisLayersFiles['axis'][referenceAxis]['layers']))
    # FIXME for now only 1 single overlay set, which corresponds to delineations
    hasDelineations = len(
        axisLayersFiles['axis'][referenceAxis]['overlays'].keys())

    isMultiPlane = len(axisLayersFiles['axis'].keys()) > 1
    for axis in axisLayersFiles['axis'].keys():
        print(f"\t{axis}")
        subviewPath = os.path.join(ouput_path, config['subview']['foldername'])
        if isMultiPlane:
            subviewPath = os.path.join(subviewPath, axis)

        os.makedirs(subviewPath, exist_ok=True)

        for layerName, layer in axisLayersFiles['axis'][axis]['layers'].items():
            print(f"\t\t{layerName}")

            # create output folder for layer images
            layer_ouputpath = os.path.join(ouput_path, layer['safename'])
            if isMultiPlane:
                layer_ouputpath = os.path.join(layer_ouputpath, axis)

            os.makedirs(layer_ouputpath, exist_ok=True)

            nbImages = len(layer['images'])
            centerImageIndex = nbImages // 2
            for index, image in enumerate(layer['images']):
                print(f"\t\t\t{index+1}/{nbImages}")

                # create DeepZoom image for the slice
                source = os.path.join(
                    layer['path'], image['shortname'] + image['ext'])
                output = os.path.join(layer_ouputpath, str(index) + '.dzi')

                createDeepZoomImage(source, output)

                # create subview image from image in reference layer (needed in case of multiplane mode only)
                if isMultiPlane and layerName == referenceLayerName:

                    subviewImageFile = os.path.join(
                        subviewPath, str(index) + '.jpg')
                    changeSize(
                        os.path.join(
                            layer['path'], image['shortname'] + image['ext']),
                        subviewImageFile,
                        desired_size=[200, 200])

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
            for index, image in enumerate(overlay['images']):
                print(f"\t\t\t{index+1}/{nbImages}")
                source = os.path.join(
                    overlay['path'], image['shortname'] + image['ext'])
                output = os.path.join(overlay_ouputpath, 'Anno_' + str(index) + image['ext'])
                # copy SVG to output dir
                copyfile(source, output)


    if 'image_size' not in config:
        # TODO set value depending on actual image
        config['image_size'] = 1000

    if 'matrix' not in config:
        # TODO set value depending on actual image
        config['matrix'] = "0.05,0,0,-13.54,0,0.05,0,-16.00,0,0,0.05,-3.0,0,0,0,1"


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

    # data_root_path
    (base_outpath, data_root_path) = os.path.split(ouput_path)
    data_root_path = './' + data_root_path

    if prev_config is not None and prev_config['data_root_path'] != data_root_path:
        print(
            f"[!] non-matching 'data_root_path' parameter, keeping pre-existing value ({prev_config['data_root_path']})")
        config['data_root_path'] = prev_config['data_root_path']
    else:
        config['data_root_path'] = data_root_path

    input_path = getCleanedAndCheckedPath(
        "Please path of the source images", "Path of the source images not found")

    axisLayersFiles = getLayersNFiles(input_path, config)
    # print("axisLayersFiles :",  json.dumps(axisLayersFiles, indent=2))
    prepareImages(axisLayersFiles, config, ouput_path)
    saveConfig(config_filepath, prev_config, config)


startGuidedImport()
