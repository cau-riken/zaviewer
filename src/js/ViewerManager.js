import Utils from './Utils.js';

import RegionsManager from './RegionsManager.js'

import CustomFilters from './CustomFilters.js';

export const VIEWER_ID = "openseadragon1";
export const NAVIGATOR_ID = "navigatorDiv";
export const AXIAL = 0;
export const CORONAL = 1;
export const SAGITTAL = 2;

const VIEWER_ACTIONSOURCEID = 'VIEWER';

/** Class in charge of managing viewer's main display (OSD) and state of related elements */
class ViewerManager {

    static get VIEWER_ID() {
        return VIEWER_ID;
    }

    static get NAVIGATOR_ID() {
        return NAVIGATOR_ID;
    }

    static get AXIAL() {
        return AXIAL;
    }
    static get CORONAL() {
        return CORONAL;
    }
    static get SAGITTAL() {
        return SAGITTAL;
    }

    /**
     * Create ViewManager from the specified config and setup underlying OpenSeaDragon and related components
     * @param {object} config - configuration used as blueprint to setup the viewer
     * @param {function} callbackWhenReady - function repeatidly invoked whenever viewer's status has changed
     */
    static init(config, callbackWhenStatusChanged) {
        this.config = config;
        this.signalStatusChanged = callbackWhenStatusChanged;
        this.regionActionner = RegionsManager.getActionner(VIEWER_ACTIONSOURCEID);
        const that = this;

        //layers initial display values
        const initLayerDisplaySettings = {};
        $.each(that.config.data, function (key, value) {
            initLayerDisplaySettings[key] = { enabled: true, opacity: parseInt(value.opacity), name: value.metadata };
        });

        /** dynamic state of the viewer */
        this.status = {

            /** Raphael array-like object used to operate on region delineations */
            set: undefined,
            /** Main Raphael object used to handle region delineations */
            paper: undefined,

            /** 2D context of canvas used to draw measuring tape */
            ctx: null,

            /** set to true when user directly click region delineation on overlay (vs selecting it from region treeview) */
            userClickedRegion: false,


            /** range pointer used to provide info for measuring line feature (image space coordinates) */
            position: [{ x: 0, y: 0, c: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],

            /** couple of recorded pointer positions in physical space coordinates (used by measuring line feature) */
            markedPos: undefined,
            markedPosColors: ["#ff7", "#ff61b3"],

            /** up-to-date 3D position in physical space coordinates (for live display of position) */
            livePosition: undefined,

            /** pointer position when click started (used to prevent position marking when Dragging occurs) */
            pointerdownpos: { x: 0, y: 0 },


            /** layers display values */
            layerDisplaySettings: initLayerDisplaySettings,

            /** visibility of region delineations */
            showRegions: !this.config.bHideDelineation,

            currentAxis: this.CORONAL,

            /** currently selected coronal slice */
            coronalChosenSlice: this.config.initialSlice,


            //TODO probably useless
            isFullyLoaded: false,

            //TODO probably useless
            tileDrawnHandler: undefined,

        }

        this.viewer = OpenSeadragon({
            id: VIEWER_ID,
            tileSources: this.config.tileSources,
            initialPage: this.config.initialSlice,
            minZoomLevel: 0,
            minZoomImageRatio: 0.5,
            maxZoomLevel: 16,
            maxImageCacheCount: 2000,
            sequenceMode: true,
            preserveViewport: true,
            showHomeControl: false,
            showZoomControl: false,
            showSequenceControl: false,
            showNavigator: true,
            navigatorId: NAVIGATOR_ID,
            showReferenceStrip: false,
            showFullPageControl: false
        });

        this.viewer.scalebar({
            type: OpenSeadragon.ScalebarType.MICROSCOPY,
            pixelsPerMeter: 1000 / (this.getPointXY(0, this.config.imageSize / 2).x - this.getPointXY(this.config.imageSize, this.config.imageSize / 2).x) * this.config.imageSize,//37cm:1000px
            minWidth: "150px",
            location: OpenSeadragon.ScalebarLocation.BOTTOM_LEFT,
            xOffset: 5,
            yOffset: 10,
            stayInsideImage: false,
            color: "rgb(255, 0, 0)",
            fontColor: "rgb(255,255,255)",
            backgroundColor: "rgba(100,100, 100, 0.25)",
            fontSize: "small",
            barThickness: 4
        });


        this.viewer.addHandler('add-overlay', function (event) {
            //add overlay is called for each page change
            //alert("Adding overlays");
            //Reference 1): http://chrishewett.com/blog/openseadragon-svg-overlays/
            //addSVGData('./data/SVGs/coronal/Anno_'+(viewer.currentPage()+1)+'.svg',event);
            //var currentPage = viewer.currentPage();
            if (that.config.svgFolerName != "") {
                //addSVGData(dataRootPath + "/" + G.svgFolerName + "/coronal/Anno_"+ (currentPage - coronalFirstIndex ) + ".svg",event);

                that.addSVGData(that.config.PUBLISH_PATH + "/" + that.config.svgFolerName + "/Anno_" + (that.viewer.currentPage() - that.config.coronalFirstIndex) + ".svg", event.element);
            }
        });

        this.viewer.addHandler('open', function (event) {

            that.status.coronalChosenSlice = that.viewer.currentPage();

            if (!that.viewer.source) { return; }

            /** overlay to hold region delineations */
            var elt = document.createElement("div");
            elt.className = "overlay";

            var dimensions = that.viewer.source.dimensions;
            that.viewer.addOverlay({
                element: elt,
                location: that.viewer.viewport.imageToViewportRectangle(new OpenSeadragon.Rect(0, 0, dimensions.x, dimensions.y)),
            });


            $.each(that.config.layers, function (key, value) {
                if (value.index != 0) {
                    that.addLayer(key, value.name, value.ext);
                } else {
                    that.setLayerOpacity(key);

                    if (!that.viewer.referenceStrip) {
                        //AW(2020/01/16): Disabled reference strip
                        //				viewer.referenceStrip = new OpenSeadragon.ReferenceStrip({
                        //					id:          viewer.referenceStripElement,
                        //					position:    viewer.referenceStripPosition,
                        //					sizeRatio:   viewer.referenceStripSizeRatio,
                        //					scroll:      viewer.referenceStripScroll,
                        //					height:      viewer.referenceStripHeight,
                        //					width:       viewer.referenceStripWidth,
                        //					tileSources: viewer.tileSources,
                        //					prefixUrl:   viewer.prefixUrl,
                        //					viewer:      viewer
                        //				});
                        //				viewer.referenceStrip.setFocus(viewer.currentPage());
                    }
                }
                //i++;
            });

            //FIXME updateSubVLine(this.viewer.currentPage());


            $(that.viewer.canvas).off('.posview');
            $(that.viewer.canvas).on('mousemove.posview', that.mousemoveHandler.bind(that));
        });

        this.viewer.addViewerInputHook({
            hooks: [
                { tracker: 'viewer', handler: 'scrollHandler', hookHandler: this.onViewerScroll },
                { tracker: 'viewer', handler: 'clickHandler', hookHandler: this.onViewerClick }
            ]
        });

        this.viewer.addHandler('resize', function (event) {
            that.resizeCanvas();
            that.adjustResizeRegionsOverlay(that.status.set);
        });


        this.viewer.addHandler('animation', function (event) {
            that.adjustResizeRegionsOverlay(that.status.set);
        });

        //Handle changing the page; perhaps dynamically load new data at this point
        this.viewer.addHandler('page', function (event) {
            /*
                var pageNum = event.page;
                $.each(layers, function( key, value ) {
                    if (value.index == 0) {
                        var options = viewer.tileSources[pageNum];
                        if(!options.tileSource){
                            viewer.tileSources[pageNum] = {
                                tileSource:options,
                            };
                        }
                        viewer.tileSources[pageNum].opacity = getOpacity(key);
                    }
                });
                */
        });



        //--------------------------------------------------

        this.viewer.canvas.addEventListener('click', this.pointerupHandler.bind(this));
        this.viewer.canvas.addEventListener('pointerdown', this.pointerdownHandler.bind(this));
        this.viewer.canvas.addEventListener('mousedown', this.pointerdownHandler.bind(this));

        var cnv = document.createElement("canvas");
        cnv.id = "poscanvas";
        if (this.status.showRegions) {
            cnv.style.display = "none";
        }
        this.viewer.canvas.appendChild(cnv);
        this.resizeCanvas();

        //--------------------------------------------------
        //TODO remove useless code 
        //AW(2010/01/16): Added a tileDrawnHandler event to call updateFilters once the tiles have drawn properly
        this.viewer.addHandler('tile-drawn', function (event) {
            //var c=viewer.world.getItemCount();

            //$.each(layers,function(key){
            //	
            //	if(layers[key].name.includes("nn_tracer")){
            //		updateFilters();
            //	}
            //});
            //if (c==5){
            //	viewer.removeHandler('tile-drawn',G.tileDrawnHandler);
            //	updateFilters();
            //}
        });


        //TODO remove useless handler
        this.viewer.world.addHandler('add-item', function (event) {
            var tiledImage = event.item;
            console.log("A");
            tiledImage.addHandler('fully-loaded-change', function () {
                var newFullyLoaded = that.areAllFullyLoaded();
                if (newFullyLoaded !== that.status.isFullyLoaded) {
                    that.status.isFullyLoaded = newFullyLoaded;
                    // Raise event
                    console.log("test");
                }
            });
        });

        //TODO remove useless code
        $('#intensity_slider, #gamma_slider').change(that.updateFilters);
        $('#intensity_value, #gamma_value').change(function () {
            $("#gamma_value").val(parseFloat($("#gamma_value").val()).toFixed(1))
            $("#intensity_slider").val($("#intensity_value").val())
            $("#gamma_slider").val($("#gamma_value").val() * 10);
            //	updateFilters();
        });


        RegionsManager.addListeners(regionsStatus => {
            if (RegionsManager.getLastActionSource() != VIEWER_ACTIONSOURCEID) {
                ViewerManager.unselectRegions();
                ViewerManager.selectRegions(RegionsManager.getSelectedRegions());
            }
        });

    }
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 


    static updateFilters() {
        const that = this;

        if (this.viewer) {
            var nn_tracer_layer_ind = -1;
            var count = 0;
            $.each(this.config.layers, function (key) {
                //console.log(key);
                if (that.config.layers[key].name.includes("nn_tracer")) {
                    //				console.log("FOUND");
                    nn_tracer_layer_ind = count;
                }
                count++;
            });
            //		console.log(nn_tracer_layer_ind);
            var processors = [];
            //TODO remove useless code
            //if($('#intensity_slider').val() != "0"){
            //	processors.push(OpenSeadragon.Filters.BRIGHTNESS(parseFloat($('#intensity_slider').val())));
            //}
            //if($('#gamma_slider').val() != "10"){
            //	processors.push(OpenSeadragon.Filters.GAMMA(parseFloat($('#gamma_slider').val())/10.0));
            //}
            console.log(nn_tracer_layer_ind);
            var nn_layer = this.viewer.world.getItemAt(nn_tracer_layer_ind);
            console.log(nn_layer);
            if (nn_tracer_layer_ind != -1 && nn_layer !== undefined) {
                //viewer.world.getItemAt(nn_tracer_layer_ind).addHandler('tile-loaded',fullyLoaded);
                this.viewer.setFilterOptions({
                    filters: [{
                        items: this.viewer.world.getItemAt(nn_tracer_layer_ind),
                        processors: [
                            CustomFilters.INTENSITYALPHA()
                        ]
                    }]
                });
            }
            else if (nn_tracer_layer_ind != -1 && nn_layer === undefined) {
                this.waitForNNLayer(nn_tracer_layer_ind);
            }
        }
        //TODO remove useless code
        //$("#intensity_value").val($("#intensity_slider").val());
        //$("#gamma_value").val((parseFloat($("#gamma_slider").val()) / 10.0).toFixed(1));
    }

    static waitForNNLayer(nn_tracer_layer_ind) {
        var nn_layer = this.viewer.world.getItemAt(nn_tracer_layer_ind);
        if (nn_layer === undefined) {
            const that = this;
            setTimeout(function () { that.waitForNNLayer(nn_tracer_layer_ind) }, 100);
        } else {
            this.updateFilters();
        }
    };

    /** Add region delineations to specified overlay  
     * 
     *  @param {string} svgName - url to the SVG containing regions  
     *  @param {element} overlayElement - overlay element where to load the regions
     *  @private
     * 
    */
    static addSVGData(svgName, overlayElement) {
        this.status.paper = Raphael(overlayElement);
        this.status.set = this.status.paper.set();
        //clear the set if necessary
        this.status.set.remove();
        //load from a file
        var strReturn = "";
        console.log("svg " + svgName);

        const that = this;

        $.ajax({
            url: svgName,
            async: true,
            success: function (html) {
                strReturn = html;
                var root = strReturn.getElementsByTagName('svg')[0];
                //I can get the name and paths
                var paths = root.getElementsByTagName('path');

                for (var i = 0; i < paths.length; i++) {

                    const abbrev = paths[i].getAttribute('id').trim()
                    //reset path id before importing path to avoid duplicates
                    const newId = abbrev + '-' + i;
                    paths[i].setAttribute('id', newId);

                    var newPathElt = that.status.paper.importSVG(paths[i]);
                    newPathElt.id = newId;
                    newPathElt.attr("title", abbrev);

                    that.applyMouseOutPresentation(newPathElt);

                    if (abbrev == "background") {
                        //background elements

                        newPathElt.attr("fill-opacity", 0.0);

                        //unselect all when click on the background element
                        newPathElt.click(function (e) {
                            that.unselectRegions();
                            that.regionActionner.unSelectAll();
                        });

                    } else {

                        newPathElt.mouseover(function (e) {
                            that.applyMouseOverPresentation(this);
                        });

                        newPathElt.mouseout(function (e) {
                            if (!RegionsManager.isSelected(this.attr("title"))) {
                                that.applyMouseOutPresentation(this);
                            }
                        });

                        newPathElt.click(function (e) {
                            const selectedRegion = this.attr("title");
                            that.unselectRegions();
                            that.status.userClickedRegion = true;
                            that.selectRegions([selectedRegion])
                            that.regionActionner.replaceSelected(selectedRegion);
                        });
                    }

                    that.status.set.push(newPathElt);
                }

                that.adjustResizeRegionsOverlay(that.status.set);

                //restore presentation of regions selected in previous slice
                that.selectRegions(RegionsManager.getSelectedRegions());

                if (!that.status.showRegions) {
                    that.hideDelineation();
                }

            }
        });



    }

    /**  
     * @private
    */
    static adjustResizeRegionsOverlay(el) {
        var zoom = this.viewer.world.getItemAt(0).viewportToImageZoom(this.viewer.viewport.getZoom(true));
        //offset based on (8000-5420)/2
        //original method (slow)
        // el.transform('s' + zoom + ',' + zoom + ',0,0t0,1290');
        //fast method
        //https://www.circuitlab.com/blog/2012/07/25/tuning-raphaeljs-for-high-performance-svg-interfaces/
        /*
        One caveat here is that the changes we applied only operate within the SVG module of Raphael. Since CircuitLab doesn't currently support Internet Explorer, this isn't a concern for us, however if you rely on Raphael for IE support you will also have to implement the setTransform() method appropriately in the VML module. Here is a link to the change set that shows the changes discussed in this post.*/
        //NOTE: we should set translate appropriately to the size of the SVG
        this.status.paper.setTransform(' scale(' + zoom + ',' + zoom + ') translate(0,' + this.config.dzDiff + ')');//translate(0,1290)');
        //console.log('S' + zoom + ',' + zoom + ',0,0');

        this.displayMeasureLine();
    }

    /**  
     * @public
    */
    static changeRegionsVisibility(visible) {
        this.status.showRegions = visible;
        if (this.status.set) {
            if (!this.status.showRegions) {
                this.status.set.forEach(function (el) {
                    el.hide();
                    $("#poscanvas").show();
                });
            } else {
                this.status.set.forEach(function (el) {
                    el.show();
                    $("#poscanvas").hide();
                });
            }
        }
        this.signalStatusChanged(this.status);
    }

    /** 
     * Hide all region delineations
    * @private
    */
    static hideDelineation() {
        this.status.set.forEach(function (el) {
            el.hide();
        });
    }


    static applyMouseOverPresentation(element) {
        element.attr({
            "fill-opacity": 0.8,
            "stroke-opacity": 1
        });
    }

    static applyMouseOutPresentation(element) {
        element.attr({
            "fill-opacity": 0.4,
            "stroke-opacity": 1
        });
    }

    static applySelectedPresentation(element) {
        element.attr({
            "fill-opacity": 0.8,
            "stroke-opacity": 1,
            "stroke-width": 20,
            "stroke": "#0000ff"
        });
    }

    static applyUnselectedPresentation(element) {
        element.attr({
            "fill-opacity": 0.4,
            "stroke-opacity": 0,
            "stroke-width": 0,
            "stroke": "#000000"
        });
    }


    /** 
     * Reset all regions visual presentation to unselected state
    * @private
    */
    static unselectRegions() {
        if (this.status.set) {
            const that = this;
            this.status.set.forEach(function (el) {
                if (el[0].attr("title") !== "background") {
                    that.applyUnselectedPresentation(el);
                }
            });
        }
    }

    /** 
     * Set specified regions visual presentation to selected state
    * @private
    */
    static selectRegions(nameList) {
        if (this.status.set) {
            const that = this;

            // apply presentation for selected regions
            this.status.set.forEach(function (el) {
                var abbrev = el[0].attr("title");
                if (nameList.includes(abbrev)) {
                    that.applySelectedPresentation(el);
                }
            });

            // perform pan & zoom 
            if (!this.status.userClickedRegion) {
                const that = this;
                //how to choose a center?
                var newX = 0;
                var newY = 0;
                var snCount = 0;
                for (var k = 0; k < nameList.length; k++) {
                    //try to find the nodes -> slow way!
                    this.status.set.forEach(function (el) {
                        var subNode = el[0];
                        if (el[0].attr("title") == nameList[k]) {
                            snCount++;
                            var bbox = subNode.getBBox();
                            newX += (bbox.x2 - bbox.width / 2) / that.config.dzWidth;
                            newY += (that.config.dzDiff + bbox.y2 - bbox.height / 2) / that.config.dzHeight;
                        }
                    });
                }
                if (snCount > 0) {
                    newX /= snCount;
                    newY /= snCount;
                    var windowPoint = new OpenSeadragon.Point(newX, newY);
                    this.viewer.viewport.panTo(windowPoint);
                    this.viewer.viewport.zoomTo(1.1);
                }
            }
            this.status.userClickedRegion = false;
        }

    }

    //TODO remove useless code
    /**  
    * @public
    */
    static selectRegion(regionName) {
        if (!this.status.userClickedRegion) {
            var found = false;
            const that = this;

            var newX = 0;
            var newY = 0;
            var snCount = 0;
            this.status.set.forEach(function (el) {
                var xvdd = el[0].attr("title");//works
                if (xvdd.trim() == regionName) {
                    found = true;
                    //move to correct location
                    var bbox = el[0].getBBox();
                    //console.log("The value is"+bbox.x + " "+bbox.y);
                    newX += (bbox.x2 - bbox.width / 2) / that.config.dzHeight;
                    newY += (that.config.dzDiff + bbox.y2 - bbox.height / 2) / that.config.dzHeight;
                    snCount++;
                    //console.log(el[0].attr("title")+" "+newX + " " + newY);
                    //we should consider both hemispheres!
                    //set pan to and zoom to
                    el[0].attr("fill-opacity", "0.8");//works
                    el[0].attr("stroke", "#0000ff");
                    el[0].attr("stroke-width", "2");//"8");
                    el[0].attr("stroke-opacity", "1");
                }
            });
            if (snCount > 0) {
                //now we have considered all relevant regions
                var windowPoint = new OpenSeadragon.Point(newX / snCount, newY / snCount);
                this.viewer.viewport.panTo(windowPoint);
            }

            if (found == false) {
                //console.log("wasnt found");
                //check for the first occurence
                var org_id = regionName;
                var esc_id = org_id.replace(/(:|\.|\/|\[|\])/g, "\\$1");
                var nodInfo = $("#" + esc_id);
                var id_value = nodInfo.attr("id");
                var firstOccVal = nodInfo.attr("dataFirstOccC");
                //console.log("Coronal Fv: "+firstOccVal+" id:"+id_value+" :"+data.selected[0]);
                if (firstOccVal >= 0 && firstOccVal < this.config.coronalSlideCount) {
                    this.status.selectedRegionName = regionName;
                    //console.log("firstOccVal " + firstOccVal);
                    goToSlice(CORONAL, parseInt(firstOccVal))
                    claerPosition();
                    this.signalStatusChanged(this.status);

                    //coronalImg.node.href.baseVal = dataRootPath + "/" + subviewFolderName +"/coronal/" + coronalChosenSlice + ".jpg";
                    //updateLinePosBaseSlide(coronalChosenSlice);
                }
                //WHILE NOT FOUND IN SETSELECTION, wait a bit and try again
                //console.log("I made it");
            }
            this.status.selectedRegionName = regionName;
        }
        this.status.userClickedRegion = false;
    }


    /**  
    * @public
    */
    static goToSlice(axis, chosenSlice) {
        //TODO use axis 

        if (chosenSlice > (this.config.coronalSlideCount - 1)) {
            chosenSlice = this.config.coronalSlideCount - 1;
        } else if (chosenSlice < 0) {
            chosenSlice = 0;
        }
        this.status.coronalChosenSlice = chosenSlice;
        this.viewer.goToPage(this.config.coronalFirstIndex + this.status.coronalChosenSlice);
    }


    //https://github.com/openseadragon/openseadragon/issues/1421 to improve caching
    static getPoint(x, y) {
        var point;
        var tx = this.config.imageSize - x;
        var ty = this.config.imageSize - y;
        point = new Array(tx, this.status.coronalChosenSlice * this.config.coronalSliceStep, ty, 1);
        //console.log(point);
        //console.log(matrix);
        //return multiplyMatrixAndPoint(point);
        var result = [0, 0, 0, 0];
        for (var i = 0; i < 4; i++) {
            for (var j = 0; j < 4; j++) {
                result[i] += (this.config.matrix[i * 4 + j] * point[j]);
            }
        }
        //console.log(result);
        return result;
    }

    static getPointXY(x, y) {
        var pos = this.getPoint(x, y);
        return { x: pos[0], y: pos[2] };
    }

    static mousemoveHandler(event) {
        if (this.viewer.currentOverlays[0] == null) { return; }

        var rect = this.viewer.canvas.getBoundingClientRect();
        var zoom = this.viewer.viewport.getZoom(true) * (this.viewer.canvas.clientWidth / this.config.imageSize);
        this.status.position[0].x = event.clientX;
        this.status.position[0].y = event.clientY;
        var orig = this.viewer.viewport.pixelFromPoint(new OpenSeadragon.Point(0, 0), true);
        var x = (this.status.position[0].x - orig.x - rect.left) / zoom;
        var y = (this.status.position[0].y - orig.y - rect.top) / zoom;

        this.status.livePosition = this.getPoint(x, y);
        this.signalStatusChanged(this.status);
    }

    static onViewerScroll(event) {
        // Disable mousewheel zoom on the viewer and let the original mousewheel events bubble
        // if (!event.isTouchEvent) {
        //     event.preventDefaultAction = true;
        //     return true;
        // }
    }

    static onViewerClick(event) {
        // Disable click zoom on the viewer using event.preventDefaultAction
        event.preventDefaultAction = true;
        event.stopBubbling = true;
    }


    static getLayerOpacity(key) {
        var opacity = 0;
        if (this.config.layers[key]) {
            if (this.status.layerDisplaySettings[key].enabled) {
                opacity = this.status.layerDisplaySettings[key].opacity / 100;
            }
        }
        return opacity;
    }

    static setLayerOpacity(key) {
        if (this.config.layers[key]) {
            var opacity = this.getLayerOpacity(key);
            if (this.viewer.world.getItemAt(this.config.layers[key].index)) {
                this.viewer.world.getItemAt(this.config.layers[key].index).setOpacity(opacity);
            }
        }
    }


    static addLayer(key, name, ext) {
        var options = {
            /*tileSource: {
                //these must be set correctly otherwise there will be incorrect sizing!
                height: dzLayerWidth,
                width: dzLayerHeight,
                tileSize: 256,
                overlap: 1,
                //minLevel: 0,
                //maxLevel: 10, //maxLevel should correspond to the depth of the number of folders in the dzi subdirectory
                getTileUrl: function( level, x, y ){
                    var currentpage = viewer.currentPage() - coronalFirstIndex;
                    //return dataRootPath + "/" + layerName + "/coronal/" + layerName + "_Coronal_"+ currentpage +"_files/" + level + "/" + x + "_" + y + ".jpg";
                    return dataRootPath + "/" + layerName + "/coronal/" + currentpage +"_files/" + level + "/" + x + "_" + y + ".jpg";
                }
            },*/
            /*tileSource:"http://freasy.biz:8000/iipsrv/iipsrv.fcgi?IIIF=/0002.tif/info.json",*/
            //tileSource:dataRootPath + "/" + layerName + "/coronal/" + this.viewer.currentPage() +".dzi",
            tileSource: this.config.IIPSERVER_PATH + key + "/" + this.viewer.currentPage() + ext + this.config.TILE_EXTENSION,// +  TILE_EXTENSION,

            opacity: this.getLayerOpacity(key),
        };

        const that = this;
        const addLayerHandler = function (event) {
            that.viewer.world.removeHandler("add-item", addLayerHandler);
            that.config.layers[key].name = name;

            that.updateFilters();
        };
        this.viewer.world.addHandler("add-item", addLayerHandler);
        this.viewer.addTiledImage(options);

    }


    static changeLayerOpacity(layerid, enabled, opacity) {
        if (this.config.layers[layerid]) {
            this.status.layerDisplaySettings[layerid].enabled = enabled;
            this.status.layerDisplaySettings[layerid].opacity = opacity;
            this.setLayerOpacity(layerid);
            this.signalStatusChanged(this.status);
        }
    }


    //--------------------------------------------------
    // position
    static resizeCanvas() {
        //TODO remove useless code
        $("#poscanvas").attr({
            'width': this.viewer.canvas.clientWidth,
            'height': this.viewer.canvas.clientHeight
        });
        this.displayMeasureLine();

        if (this.viewer.referenceStrip) {
            //FIXME resetReferenceStrip();
        }
    }


    static pointerdownHandler(event) {
        this.status.pointerdownpos.x = event.clientX;
        this.status.pointerdownpos.y = event.clientY;
    };

    static pointerupHandler(event) {
        //
        if (this.viewer.currentOverlays.length == 0 || $("#poscanvas").is(":hidden")) {
            return;
        }

        //prevent recording another point if a dragging gesture is occuring
        if (this.status.pointerdownpos.x > event.clientX + 5 || this.status.pointerdownpos.x < event.clientX - 5 ||
            this.status.pointerdownpos.y > event.clientY + 5 || this.status.pointerdownpos.y < event.clientY - 5) {
            return;
        }
        //already 2 points recorded, reset measuring line
        if (this.status.position[0].c == 2) {
            this.resetPositionview();
            this.viewer.drawer.clear();
            this.viewer.world.draw();
            this.displayMeasureLine();
            return;
        }

        var orig = this.viewer.viewport.pixelFromPoint(new OpenSeadragon.Point(0, 0), true);
        var rect = this.viewer.canvas.getBoundingClientRect();
        //var zoom = viewer.viewport.getZoom(true);
        var zoom = this.viewer.viewport.getZoom(true) * (this.viewer.canvas.clientWidth / this.config.imageSize);

        //record next point for measuring line feature
        var x = (event.clientX - orig.x - rect.left) / zoom;
        var y = (event.clientY - orig.y - rect.top) / zoom;
        this.status.position[0].c++
        this.status.position[this.status.position[0].c].x = x;
        this.status.position[this.status.position[0].c].y = y;

        this.setPosition();

        // show canvas
        this.displayMeasureLine();
    };


    /** Draw the measure line widgets on the position canvas */
    static displayMeasureLine() {
        if (this.viewer.currentOverlays[0] == null) { return; }
        if (this.status.ctx == null) {
            this.status.ctx = $("#poscanvas")[0].getContext('2d');
        }

        this.status.ctx.clearRect(0, 0, $("#poscanvas")[0].width, $("#poscanvas")[0].height);

        var orig = this.viewer.viewport.pixelFromPoint(new OpenSeadragon.Point(0, 0), true);
        var rect = this.viewer.canvas.getBoundingClientRect();

        var zoom = this.viewer.viewport.getZoom(true) * (this.viewer.canvas.clientWidth / this.config.imageSize);
        var x = (this.status.position[0].x - orig.x - rect.left) / zoom;
        var y = (this.status.position[0].y - orig.y - rect.top) / zoom;

        this.status.livePosition = this.getPoint(x, y);
        this.signalStatusChanged(this.status);

        // distance line
        if (this.status.position[0].c == 2) {
            var px1 = Math.round((this.status.position[1].x * zoom) + orig.x + 0.5) - 0.5;
            var py1 = Math.round((this.status.position[1].y * zoom) + orig.y + 0.5) - 0.5;
            var px2 = Math.round((this.status.position[2].x * zoom) + orig.x + 0.5) - 0.5;
            var py2 = Math.round((this.status.position[2].y * zoom) + orig.y + 0.5) - 0.5;
            this.status.ctx.beginPath();
            this.status.ctx.strokeStyle = "#888";
            this.status.ctx.moveTo(px1, py1);
            this.status.ctx.lineTo(px2, py2);
            this.status.ctx.stroke();
        }
        // cross
        if (this.status.position[0].c != 0) {
            this.status.ctx.beginPath();
            this.status.ctx.strokeStyle = "#000";
            for (var i = 1; i <= this.status.position[0].c; i++) {
                var px = Math.round((this.status.position[i].x * zoom) + orig.x + 0.5) + 0.5;
                var py = Math.round((this.status.position[i].y * zoom) + orig.y + 0.5) + 0.5;
                this.status.ctx.moveTo(px, py - 10);
                this.status.ctx.lineTo(px, py + 10);
                this.status.ctx.moveTo(px - 10, py);
                this.status.ctx.lineTo(px + 10, py);
            }
            this.status.ctx.stroke();


            for (var i = 1; i <= this.status.position[0].c; i++) {
                this.status.ctx.beginPath();
                this.status.ctx.strokeStyle = this.status.markedPosColors[i - 1];
                var px = Math.round((this.status.position[i].x * zoom) + orig.x + 0.5) - 0.5;
                var py = Math.round((this.status.position[i].y * zoom) + orig.y + 0.5) - 0.5;
                this.status.ctx.moveTo(px, py - 10);
                this.status.ctx.lineTo(px, py + 10);
                this.status.ctx.moveTo(px - 10, py);
                this.status.ctx.lineTo(px + 10, py);
                this.status.ctx.stroke();
            }

        }
    };

    static resetPositionview() {
        this.status.position[0].c = 0;
        this.signalStatusChanged(this.status);
    }


    static claerPosition() {
        this.status.position[0].c = 2;
        this.resetPositionview();
        this.viewer.drawer.clear();
        this.viewer.world.draw();
        this.displayMeasureLine();
        return;
    }

    static setPosition() {
        this.status.markedPos = [this.getPointXY(this.status.position[1].x, this.status.position[1].y), this.getPointXY(this.status.position[2].x, this.status.position[2].y)];
        this.signalStatusChanged(this.status);
    }

    static areAllFullyLoaded() {
        var tiledImage;
        var count = this.viewer.world.getItemCount();
        for (var i = 0; i < count; i++) {
            tiledImage = this.viewer.world.getItemAt(i);
            if (!tiledImage.getFullyLoaded()) {
                return false;
            }
        }
        return true;
    }


}

export default ViewerManager;
