import Utils from './Utils.js';

class ZAVConfig {

    static getConfig(configId, callbackWhenReady) {
        return new ZAVConfig(configId, callbackWhenReady);
    }

    constructor(configId, callbackWhenReady) {

        const _subviewSize = 200;
        const _subviewZoomRatio = 200 / _subviewSize;

        //configuration default values
        this.config = {
            paramId: configId,

            IIPSERVER_PATH: undefined,
            PUBLISH_PATH: undefined,
            ADMIN_PATH: undefined,

            TILE_EXTENSION: "/info.json",

            subviewFolerName: undefined,
            coronalSlideCount: undefined,
            svgFolerName: undefined,

            coronalFirstIndex: undefined, // the first index of Coronal of selected dataset

            subviewSize: _subviewSize,
            subviewZoomRatio: _subviewZoomRatio,
            yMinGlobal: 5 / _subviewZoomRatio,
            yMaxGlobal: 585 / _subviewZoomRatio,

            matrix: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            coronalSliceStep: 1,
            imageSize: 1000,


            dzWidth: 1000.0,
            dzHeight: 1000.0,

            dzLayerWidth: 1000,
            dzLayerHeight: 1000,

            tileSources: [],
            layers: {},

            THUMB_EXTENSION: "/full/250,/0/default.jpg", //".ptif/full/250,/0/default.jpg";
            editLayers: {},

            initialSlice: 0,


            global_Y: 0, // Green

            colorCoronal: "#ff4444",		// Coronal Red

            dzDiff: 0,//1290.0;


            bHideDelineation: false, // true if delineation is hidden

            treeUrlPath: undefined,

            data: undefined,


        };

        //start retrieving configuration
        //signal config is available
        this.retrieveConfig(callbackWhenReady);

    }

    retrieveConfig(callbackWhenReady) {
        //FIXME
        const TempPrefix = "http://localhost:8080";

        const that = this;

        $.ajax({
            //FIXME url: "../path.json",
            url: Utils.makePath(TempPrefix, "path.json"),

            type: "GET",
            async: true,
            dataType: 'json',
            success: function (response) {

                //FIXME that.config.ADMIN_PATH = response.admin_path;
                //FIXME that.config.IIPSERVER_PATH = response.iipserver_path;
                //FIXME that.config.PUBLISH_PATH = response.publish_path;

                that.config.ADMIN_PATH = Utils.makePath(TempPrefix, response.admin_path);
                that.config.IIPSERVER_PATH = Utils.makePath(TempPrefix, response.iipserver_path);
                that.config.PUBLISH_PATH = Utils.makePath(TempPrefix, "data");

                $.ajax({
                    //FIXME url: "../" + that.config.ADMIN_PATH + "json.php",
                    url: Utils.makePath(that.config.ADMIN_PATH, "json.php"),

                    type: "POST",
                    async: true,
                    dataType: 'json',
                    data: {
                        id: that.config.paramId,
                    },
                    success: function (response) {
                        if (response.error) {
                            console.log(response.error);

                            //FIXME display explicit message to user
                        }
                        that.config.treeUrlPath = response.tree;


                        //dataRootPath = response.data_root_path;
                        if (response.subview) { that.config.subviewFolerName = response.subview.foldername; }
                        that.config.coronalSlideCount = response.slide_count;
                        //sagittalSlideCount = response.subview.sagittal_slide;


                        //axialFirstIndex = 0;
                        that.config.coronalFirstIndex = 0;//axialFirstIndex;
                        //sagittalFirstIndex = coronalFirstIndex + coronalSlideCount;

                        var subviewOrgSize = (response.subview && response.subview.size) ? response.subview.size : 200;
                        that.config.subviewZoomRatio = subviewOrgSize / that.config.subviewSize;
                        //		xMinGlobal = (response.subview.x_min ? response.subview.x_min : 0) / subviewZoomRatio;
                        //		xMaxGlobal = (response.subview.x_max ? response.subview.x_max : subviewOrgSize) / subviewZoomRatio;
                        that.config.yMinGlobal = (response.subview && response.subview.y_min ? response.subview.min : 0) / that.config.subviewZoomRatio;
                        that.config.yMaxGlobal = (response.subview && response.subview.y_max ? response.subview.max : subviewOrgSize) / that.config.subviewZoomRatio;
                        //		zMinGlobal = (response.subview.z_min ? response.subview.z_min : 0) / subviewZoomRatio;
                        //		zMaxGlobal = (response.subview.z_max ? response.subview.z_max : subviewOrgSize) / subviewZoomRatio;

                        if (response.delineations) {
                            that.config.hasDelineation = true;
                            that.config.svgFolerName = response.delineations;
                        } else {
                            that.config.hasDelineation = false;
                        }

                        that.config.matrix = response.matrix ? response.matrix.split(",") : that.config.matrix;
                        //console.log(matrix);
                        //axialSliceStep = response.axial_slice_step;
                        that.config.coronalSliceStep = response.slice_step;
                        //sagittalSliceStep = response.sagittal_slice_step;

                        that.config.imageSize = response.image_size ? response.image_size : that.config.imageSize;
                        that.config.dzWidth = that.config.imageSize;
                        that.config.dzHeight = that.config.imageSize;
                        that.config.dzLayerWidth = that.config.imageSize;
                        that.config.dzLayerHeight = that.config.imageSize;

                        if (response.data) {
                            that.config.data = response.data;

                            var i = 0;
                            $.each(response.data, function (key, value) {

                                // only firstLayer
                                if (i == 0) {
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

                                    for (var j = 0; j < that.config.coronalSlideCount; j++) {
                                        //that.config.tileSources.push(dataRootPath + "/" + key + "/coronal/" + key +"_Coronal_" + j +".dzi");
                                        that.config.tileSources.push(that.config.IIPSERVER_PATH + key + "/" + j + "." + value.extension + that.config.TILE_EXTENSION);
                                        //that.config.tileSources.push("http://210.230.211.213/iipsrv/iipsrv.fcgi?IIIF=/group3/ptiffs/red/" + j + ".ptif/info.json");
                                    }
                                }
                                //dataset[key] = value.metadata;
                                //datasetIndex[key] = i++;
                                that.config.layers[key] = { "name": value.metadata, "ext": "." + value.extension, "index": i++ };
                            });

                        }

                        if (response.first_access) {
                            //accessData = response.first_access.data ? response.first_access.data : "coronal";
                            that.config.initialSlice = parseInt(response.first_access.slide ? response.first_access.slide : 30);
                            if (response.first_access.delineations === "hide") {
                                that.config.bHideDelineation = true;
                            }

                            //		selectedSubview = CORONAL;

                            that.config.initialSlice += that.config.coronalFirstIndex;
                            //global_X = 10 + zMaxGlobal;
                            that.config.global_Y = 10 + (that.config.coronalSlideCount - response.first_access.slide) * (that.config.yMaxGlobal - that.config.yMinGlobal) / that.config.coronalSlideCount + that.config.yMinGlobal;
                            //global_Z = 10 + xMinGlobal;
                        }

                        ///FIXME
                        /*
                        //$("#axial_holder").hide();
                        //$("#coronal_holder").hide();
                        if (that.config.coronalSlideCount == 0) { $("#sagittal_holder").hide(); }
                        else if (that.config.coronalSlideCount == 1) {
                            $("#sagittal_spinner").hide();
                            $("#sagittal_spinner_max").hide();
                        } else {
                            $("#sagittal_spinner>input").val(that.config.coronalChosenSlice);
                            $("#sagittal_spinner>input").attr('maxlength', ((String)(that.config.coronalSlideCount - 1)).length);
                            $("#sagittal_spinner_max").html(that.config.coronalSlideCount - 1);
                        }
                        //$("#sagittal_spinner").hide();
                        //$("#sagittal_spinner_max").hide();

                        if (response.bright) {
                            $("#intensity_slider").val(response.bright);
                        }
                        if (response.gamma) {
                            $("#gamma_slider").val(response.gamma);
                        }
                        if (response.bright || response.gamma) {
                            //	updateFilters();
                        }

                        if (response.group_id || (response.data && Object.keys(response.data).length > 0)) {
                            $("#GroupName").html(response.group_name);
                            $("#editbtn").click(showImageList);
                        } else {
                            $("#editbtn").hide();
                        }
                        */


                        if (callbackWhenReady && typeof (callbackWhenReady) === 'function') {

                            callbackWhenReady(that.config);
                        }
                    }//success
                });

                //search
                $.ajax({
                    //FIXME url: "../" + G.ADMIN_PATH + "findImageGroupList.php",
                    url: Utils.makePath(G.ADMIN_PATH, "findImageGroupList.php"),
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

            }//success
        });


    }

}


export default ZAVConfig;