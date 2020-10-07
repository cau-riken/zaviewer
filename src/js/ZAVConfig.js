import _ from 'underscore';
import Utils from './Utils.js';

export const AXIAL = 1;
export const CORONAL = 2;
export const SAGITTAL = 3;
export const PLANE_LABELS = { [AXIAL]: 'axial', [CORONAL]: 'coronal', [SAGITTAL]: 'sagittal' };

/** color of plane border  */
export const PLANE_COLORS = { [AXIAL]: '#33dd33', [CORONAL]: '#ff4444', [SAGITTAL]: '#3399ff' };

/** orthogonal planes  */
export const PLANE_ORTHOG = {
    [AXIAL]: { 'v': SAGITTAL, 'h': CORONAL },
    [CORONAL]: { 'v': SAGITTAL, 'h': AXIAL },
    [SAGITTAL]: { 'v': CORONAL, 'h': AXIAL }
};

/** preferred subview plane for main image plane (signel plane mode) */
export const PLANE_PREFSUBVIEW = { [AXIAL]: CORONAL, [CORONAL]: SAGITTAL, [SAGITTAL]: AXIAL };


/** Class in charge of retrieving and holding configuration associated to a dataset */
class ZAVConfig {

    static get AXIAL() {
        return AXIAL;
    }
    static get CORONAL() {
        return CORONAL;
    }
    static get SAGITTAL() {
        return SAGITTAL;
    }

    static getPlaneLabel(plane) {
        return PLANE_LABELS[plane];
    }

    static getPlaneColor(plane) {
        return PLANE_COLORS[plane];
    }

    static getPlaneOrthoVertical(plane) {
        return PLANE_ORTHOG[plane]['v'];
    }

    static getPlaneOrthoHorizontal(plane) {
        return PLANE_ORTHOG[plane]['h'];
    }

    static getPreferredSubviewForPlane(plane) {
        return PLANE_PREFSUBVIEW[plane];
    }

    static getConfig(configId, callbackWhenReady) {
        return new ZAVConfig(configId, callbackWhenReady);
    }

    /**
     * Create a configuration 
     * @param {string} configId - ID of the configuration.
     * @param {function} callbackWhenReady - function asynchronously invoked to signal that the configuration is fully loaded
     */
    constructor(configId, callbackWhenReady) {

        /** default subview size */
        const _subviewSize = 200;
        const _subviewZoomRatio = 200 / _subviewSize;

        //configuration default values
        this.config = {
            /** ZAViewer can be run with or without a backend instance (i.e. web services used to request dataset config repository, and an images server)
             * Without backend, only one dataset is available, and its data is stored as files directly served by the http server */
            hasBackend: (configId !== null),

            /** planes for which slices images can be displayed */
            hasMultiPlanes: false,
            firstActivePlane: undefined,
            hasAxialPlane: false,
            hasCoronalPlane: false,
            hasSagittalPlane: false,

            hasPlane: function (plane) {
                switch (plane) {
                    case AXIAL:
                        return this.hasAxialPlane;
                    case CORONAL:
                        return this.hasCoronalPlane;
                    case SAGITTAL:
                        return this.hasSagittalPlane;
                    default:
                        return false;
                }
            },

            /** total number of slices for each planes in the selected dataset */
            axialSlideCount: 0,
            coronalSlideCount: 0,
            sagittalSlideCount: 0,

            /** index increment between 2 consecutive slices */
            axialSliceStep: 1,
            coronalSliceStep: 1,
            sagittalSliceStep: 1,

            /** first index of slice image*/
            axialFirstIndex: 0,
            coronalFirstIndex: 0,
            sagittalFirstIndex: 0,


            /** folder of the SVG region files */
            svgFolerName: undefined,
            /** Set to true if region delineations are hidden */
            bHideDelineation: false,


            /** relative path to folder containing subview background images */
            subviewFolderName: undefined,

            /** size of the subview widget */
            subviewSize: _subviewSize,
            subviewZoomRatio: _subviewZoomRatio,

            // horizontal range in Axial and Coronal subview image  
            xMinGlobal: undefined,
            xMaxGlobal: undefined,

            // vertical range in Axial subview, and horizontal range in Sagittal subview image
            yMinGlobal: undefined,
            yMaxGlobal: undefined,

            // vertical range in Coronal and Sagittal subview image
            zMinGlobal: undefined,
            zMaxGlobal: undefined,

            getSubviewHRange: function (plane) {
                switch (plane) {
                    case AXIAL:
                    case CORONAL:
                        return { min: this.xMinGlobal, max: this.xMaxGlobal, len: this.xMaxGlobal - this.xMinGlobal };
                    case SAGITTAL:
                        return { min: this.yMinGlobal, max: this.yMaxGlobal, len: this.yMaxGlobal - this.yMinGlobal };
                }
            },

            getSubviewVRange: function (plane) {
                switch (plane) {
                    case AXIAL:
                        return { min: this.yMinGlobal, max: this.yMaxGlobal, len: this.yMaxGlobal - this.yMinGlobal };
                    case CORONAL:
                    case SAGITTAL:
                        return { min: this.zMinGlobal, max: this.zMaxGlobal, len: this.zMaxGlobal - this.zMinGlobal };
                }
            },

            /** matrix to convert image space to physical space */
            matrix: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],

            imageSize: 1000,


            dzWidth: 1000.0,
            dzHeight: 1000.0,

            dzLayerWidth: 1000,
            dzLayerHeight: 1000,

            /** zooming limits */
            //minImageZoom: 0.036,
            //maxImageZoom: 1.557,
            minImageZoom: 0.648,
            maxImageZoom: 28.026,


            layers: {},


            editLayers: {},

            initialPage: 0,

            axialChosenSlice: 0,
            coronalChosenSlice: 0,
            sagittalChosenSlice: 0,


            global_X: 0, // Red
            global_Y: 0, // Green
            global_Z: 0, // Blue

            dzDiff: 0,//1290.0;


            /** URL path to the folder holding tree region data */
            treeUrlPath: undefined,

            /** raw configuration data for layers */
            data: undefined,
        };


        if (this.config.hasBackend) {
            /** dataset id */
            this.config.paramId = configId;

            /** base URL of image server */
            this.config.IIPSERVER_PATH = undefined;
            /** base URL for region infos, region SVGs, ... */
            this.config.PUBLISH_PATH = undefined;
            /** base URL of admin web services */
            this.config.ADMIN_PATH = undefined;

            this.config.TILE_EXTENSION = "/info.json";
            this.config.THUMB_EXTENSION = "/full/250,/0/default.jpg"; //".ptif/full/250,/0/default.jpg";

            //FIXME retrieve from config stored on server
            /** url of the tracer signal (including injection point) on the flatmap */
            this.config.fmTracerSignalImgUrl = "https://www.brainminds.riken.jp/injections_point/" + configId + ".png";


        } else {

            /*
            var dataset = {}; // key -> object {axial_slide, coronal_slide, sagittal_slide}
            var datasetIndex = {}; // Save index of "key" in dataset
            */

            this.config.dataRootPath = undefined;
            /** base URL for region infos, region SVGs, ... */
            this.config.PUBLISH_PATH = undefined;

            this.config.fallbackExtension = 'dzi';

            /** URL path to the default tree region */
            this.config.fallbackTreeUrl = "regionTree.json";

        }

        //start retrieving configuration
        if (this.config.hasBackend) {
            this.retrieveConfigFromBackend(callbackWhenReady);
        } else {
            this.retrieveSimpleConfig(callbackWhenReady);
        }

    }



    /**
     * Retrieve configuration from remote backend
     * @param {function} callbackWhenReady - function invoked when the configuration is fully loaded
     * @private
     */
    retrieveConfigFromBackend(callbackWhenReady) {

        const that = this;

        $.ajax({
            url: "../path.json",

            type: "GET",
            async: true,
            dataType: 'json',
            success: function (response) {

                that.config.ADMIN_PATH = response.admin_path;
                that.config.IIPSERVER_PATH = response.iipserver_path;
                that.config.PUBLISH_PATH = response.publish_path;

                $.ajax({
                    url: Utils.makePath("../", that.config.ADMIN_PATH, "json.php"),

                    type: "POST",
                    async: true,
                    dataType: 'json',
                    data: {
                        id: that.config.paramId,
                    },
                    success: that.parseLayersConfig.bind(that, callbackWhenReady)
                });


                /** retrieve extra info for dataset from flatmap backend */
                $.ajax({
                    //FIXME retrieve url from server config
                    url: "https://www.brainminds.riken.jp/wp-json/bmind/p3/get_dataset/",
                    type: "GET",
                    async: true,
                    dataType: 'json',
                    success: function (data) {
                        const dataset_info = _.findWhere(data, { marmoset_id: that.config.paramId });
                        if (dataset_info) {
                            that.config.dataset_info = dataset_info;
                        } else {
                            console.warn("Missing info for dataset ", that.config.paramId);
                        }
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.warn(errorThrown);
                    }
                });


                //search
                $.ajax({
                    url: Utils.makePath("../", that.config.ADMIN_PATH, "findImageGroupList.php"),
                    type: "POST",
                    async: true,
                    dataType: 'json',
                    data: {
                        id: that.config.paramId,
                    },
                    success: function (data) {
                        if (!data["error"]) {

                            that.config.imageGroupListData = data;
                            $.each(data, function (key, value) {
                                that.config.editLayers[this["publish_id"]] = { "name": this["display_name"], "ext": "." + this["extension"] };
                            });

                        } else {
                            // is error
                            that.config.imageGroupListError = data["error"];
                        }
                    },
                    error: function (data) {
                        that.config.imageGroupListError = "Error";
                    }
                });

            }
        });
    }


    /**
    * Retrieve configuration from web sever
    * @param {function} callbackWhenReady - function invoked when the configuration is fully loaded
    * @private
    */
    retrieveSimpleConfig(callbackWhenReady) {
        const that = this;

        $.ajax({
            url: "viewer.json",
            type: "GET",
            async: true,
            dataType: 'json',
            success: that.parseLayersConfig.bind(that, callbackWhenReady)
        });
    }


    parseLayersConfig(callbackWhenReady, response) {


        if (response.error) {
            console.log(response.error);

            //FIXME display explicit message to user
        }

        this.config.hasAxialPlane = _.has(response.subview, 'axial_slide');
        this.config.hasCoronalPlane = _.has(response.subview, 'coronal_slide');
        this.config.hasSagittalPlane = _.has(response.subview, 'sagittal_slide');
        //single or multi-plane mode?
        this.config.hasMultiPlanes = (this.config.hasAxialPlane + this.config.hasCoronalPlane + this.config.hasSagittalPlane) > 1;

        this.config.treeUrlPath = response.tree;

        if (!this.config.hasBackend) {
            this.config.dataRootPath = response.data_root_path;
            this.config.PUBLISH_PATH = response.data_root_path;
        }

        this.config.subviewFolderName = response.subview.foldername;

        if (this.config.hasMultiPlanes) {

            this.config.axialSlideCount = this.config.hasAxialPlane ? parseInt(response.subview.axial_slide) : 0;
            this.config.coronalSlideCount = this.config.hasCoronalPlane ? parseInt(response.subview.coronal_slide) : 0;
            this.config.sagittalSlideCount = this.config.hasSagittalPlane ? parseInt(response.subview.sagittal_slide) : 0;

        } else {
            const sliceCount = parseInt(response.slide_count);

            this.config.axialSlideCount = this.config.hasAxialPlane ? sliceCount : 0;
            this.config.coronalSlideCount = this.config.hasCoronalPlane ? sliceCount : 0;
            this.config.sagittalSlideCount = this.config.hasSagittalPlane ? sliceCount : 0;

        }

        //In multiplanes mode, slices of all available planes are appended to the OSD viewer page list in that order : Axial, Coronal then Sagittal.
        //Hence, each plane start at diffrent page offset which must be taken into account to display correct slice.

        //index of first slice of each plane within the Page axis 
        this.config.axialFirstIndex = 0;
        this.config.coronalFirstIndex = this.config.axialFirstIndex + this.config.axialSlideCount;
        this.config.sagittalFirstIndex = this.config.coronalFirstIndex + this.config.coronalSlideCount;

        //size of subview images
        const subviewOrgSize = (response.subview && response.subview.size) ? response.subview.size : this.config.subviewSize;

        this.config.subviewZoomRatio = subviewOrgSize / this.config.subviewSize;
        if (this.config.hasMultiPlanes) {
            this.config.xMinGlobal = (response.subview.x_min ? response.subview.x_min : 0) / this.config.subviewZoomRatio;
            this.config.xMaxGlobal = (response.subview.x_max ? response.subview.x_max : subviewOrgSize) / this.config.subviewZoomRatio;
            this.config.yMinGlobal = (response.subview.y_min ? response.subview.y_min : 0) / this.config.subviewZoomRatio;
            this.config.yMaxGlobal = (response.subview.y_max ? response.subview.y_max : subviewOrgSize) / this.config.subviewZoomRatio;
            this.config.zMinGlobal = (response.subview.z_min ? response.subview.z_min : 0) / this.config.subviewZoomRatio;
            this.config.zMaxGlobal = (response.subview.z_max ? response.subview.z_max : subviewOrgSize) / this.config.subviewZoomRatio;
        } else {
            this.config.xMinGlobal = this.config.yMinGlobal = this.config.zMinGlobal = (response.subview.min ? response.subview.min : 0) / this.config.subviewZoomRatio;
            this.config.xMaxGlobal = this.config.yMaxGlobal = this.config.zMaxGlobal = (response.subview.max ? response.subview.max : subviewOrgSize) / this.config.subviewZoomRatio;
        }

        if (response.delineations) {
            this.config.hasDelineation = true;
            this.config.svgFolerName = response.delineations;
        } else {
            this.config.hasDelineation = false;
        }

        this.config.matrix = response.matrix ? response.matrix.split(",") : this.config.matrix;

        if (this.config.hasMultiPlanes) {
            this.config.axialSliceStep = response.axial_slice_step ? parseInt(response.axial_slice_step) : 0;
            this.config.coronalSliceStep = response.coronal_slice_step ? parseInt(response.coronal_slice_step) : 0;
            this.config.sagittalSliceStep = response.sagittal_slice_step ? parseInt(response.sagittal_slice_step) : 0;
        } else {
            const sliceStep = parseInt(response.slice_step);
            this.config.axialSliceStep = this.config.hasAxialPlane ? sliceStep : 0;
            this.config.coronalSliceStep = this.config.hasCoronalPlane ? sliceStep : 0;
            this.config.sagittalSliceStep = this.config.hasSagittalPlane ? sliceStep : 0;
        }

        this.config.imageSize = response.image_size ? parseInt(response.image_size) : this.config.imageSize;
        this.config.dzWidth = this.config.imageSize;
        this.config.dzHeight = this.config.imageSize;
        this.config.dzLayerWidth = this.config.imageSize;
        this.config.dzLayerHeight = this.config.imageSize;
        //zooming limits proportional to image resolution
        this.config.minImageZoom = this.config.minImageZoom / this.config.imageSize * 1000;
        this.config.maxImageZoom = this.config.maxImageZoom / this.config.imageSize * 1000;

        if (response.data) {
            this.config.data = response.data;
            const that = this;
            var i = 0;
            $.each(response.data, function (key, value) {

                // only firstLayer when running with a backend 
                if (that.config.hasBackend && (i == 0)) {
                    //showInfoText(key);
                    that.config.infoTextName = value.metadata;
                    $.ajax({
                        url: Utils.makePath(that.config.PUBLISH_PATH, key, "/info.txt"),
                        type: "GET",
                        dataType: "text",
                        success: function (data) {
                            that.config.infoText = data;
                        },
                        error: function () {
                            that.config.infoText = "";
                        }
                    });
                }

                that.config.layers[key] = {
                    "name": value.metadata,
                    "ext": "." + (value.extension || that.config.fallbackExtension),
                    "index": i++,
                    "key": key,
                };
            });

        }

        if (response.first_access) {

            if (response.first_access.plane) {
                switch (response.first_access.plane) {
                    case PLANE_LABELS[AXIAL]:
                        this.config.firstActivePlane = AXIAL;
                        break;

                    case PLANE_LABELS[CORONAL]:
                    default:
                        this.config.firstActivePlane = CORONAL;
                        break;

                    case PLANE_LABELS[SAGITTAL]:
                        this.config.firstActivePlane = SAGITTAL;
                        break;
                }
            } else {

                if (this.config.hasCoronalPlane) {
                    this.config.firstActivePlane = CORONAL;
                } else if (this.config.hasAxialPlane) {
                    this.config.firstActivePlane = AXIAL;
                } else if (this.config.hasSagittalPlane) {
                    this.config.firstActivePlane = SAGITTAL;
                }
            }



            //initial state for displaying regions
            if (response.first_access.delineations === "hide") {
                this.config.bHideDelineation = true;
            }

            //start with the middle slice if none is specified 
            this.config.axialChosenSlice = Math.round(this.config.axialSlideCount / 2);
            this.config.coronalChosenSlice = Math.round(this.config.coronalSlideCount / 2);
            this.config.sagittalChosenSlice = Math.round(this.config.sagittalSlideCount / 2);

            //FIXME magic value!!
            const initialSlice = response.first_access.slide ? parseInt(response.first_access.slide) : 30;
            switch (this.config.firstActivePlane) {
                case AXIAL:
                    this.config.axialChosenSlice = initialSlice;
                    this.config.initialPage = this.config.axialChosenSlice + this.config.axialFirstIndex;
                    //FIXME magic value!!
                    this.config.global_X = 10 + (this.config.axialSlideCount - response.first_access.slide) * (this.config.zMaxGlobal - this.config.zMinGlobal) / this.config.axialSlideCount + this.config.zMinGlobal;
                    this.config.global_Y = 10 + this.config.yMinGlobal;
                    this.config.global_Z = 10 + this.config.xMinGlobal;

                    break;
                case CORONAL:
                    this.config.coronalChosenSlice = initialSlice;
                    this.config.initialPage = this.config.coronalChosenSlice + this.config.coronalFirstIndex;
                    //FIXME magic value!!
                    this.config.global_X = 10 + this.config.zMaxGlobal;
                    this.config.global_Y = 10 + (this.config.coronalSlideCount - response.first_access.slide) * (this.config.yMaxGlobal - this.config.yMinGlobal) / this.config.coronalSlideCount + this.config.yMinGlobal;
                    this.config.global_Z = 10 + this.config.xMinGlobal;

                    break;
                case SAGITTAL:
                    this.config.sagittalChosenSlice = initialSlice;
                    this.config.initialPage = this.config.sagittalChosenSlice + this.config.sagittalFirstIndex;
                    //FIXME magic value!!
                    this.config.global_X = 10 + this.config.zMaxGlobal;
                    this.config.global_Y = 10 + this.config.yMinGlobal;
                    this.config.global_Z = 10 + (this.config.sagittalSlideCount - response.first_access.slide) * (this.config.xMaxGlobal - this.config.xMinGlobal) / this.config.sagittalSlideCount + this.config.xMinGlobal;

                    break;
            }


        } else {
            this.config.firstActivePlane = CORONAL;
        }

        if (response.verofdata) {

            //FIXME

        }


        if (callbackWhenReady && typeof (callbackWhenReady) === 'function') {

            callbackWhenReady(this.config);
        }
    }

}

export default ZAVConfig;
