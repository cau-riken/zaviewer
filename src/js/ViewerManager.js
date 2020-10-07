import _ from 'underscore';

import Utils from './Utils.js';

import RegionsManager from './RegionsManager.js'
import ZAVConfig from './ZAVConfig.js';

import CustomFilters from './CustomFilters.js';

export const VIEWER_ID = "openseadragon1";
export const NAVIGATOR_ID = "navigatorDiv";


const VIEWER_ACTIONSOURCEID = 'VIEWER';
const BACKGROUND_PATHID = 'background';

/** Class in charge of managing viewer's main display (OSD) and state of related elements */
class ViewerManager {

    static get VIEWER_ID() {
        return VIEWER_ID;
    }

    static get NAVIGATOR_ID() {
        return NAVIGATOR_ID;
    }


    /**
     * Create ViewManager from the specified config and setup underlying OpenSeaDragon and related components
     * @param {object} config - configuration used as blueprint to setup the viewer
     * @param {function} callbackWhenReady - function repeatidly invoked whenever viewer's status has changed
     * @param {object} history - browser's history
     */
    static init(config, callbackWhenStatusChanged, history) {
        this.config = config;

        this.history = history;
        //some continuous operations must not be recorded immediately in history (e.g. zooming, paning)
        this.makeHistoryStep = _.debounce(this.makeActualHistoryStep, 500);

        this.history.listen((location, action) => {
            //reset viewer only when navigating the history with Back and Forth buttons
            if (action === "POP") {
                const locParams = this.getParamsFromLocation(location);
                this.applyChangeFromHistory(locParams);
            }
        });

        this.signalStatusChanged = callbackWhenStatusChanged;
        this.regionActionner = RegionsManager.getActionner(VIEWER_ACTIONSOURCEID);
        /** viewer specific event bus */
        this.eventSource = new OpenSeadragon.EventSource();

        //layers initial display values
        const initLayerDisplaySettings = {};
        var i = 0;
        $.each(this.config.data, function (key, value) {
            //FIXME should use another method than name to identify tracer signal layer
            const isTracer = value.metadata.includes("nn_tracer");
            initLayerDisplaySettings[key] = {
                key: key,
                enabled: true,
                opacity: value.opacity ? parseInt(value.opacity) : 100,
                name: value.metadata,
                index: i++,
                isTracer: isTracer,
                enhanceSignal: false,
                dilation: 0,

                contrastEnabled: false,
                contrast: 1,
                gammaEnabled: false,
                gamma: 1,
            };
        });

        //params retrieved from initial location
        const overridingConf = this.getParamsFromCurrLocation();

        /** dynamic state of the viewer */
        this.status = {

            //protocol used with image server 
            useIIProtocol: overridingConf.protocol && "IIP" === overridingConf.protocol,

            //tile sources for every slice of first layer 
            tileSources: [],

            /** Raphael array-like object used to operate on region delineations */
            set: undefined,
            /** Main Raphael object used to handle region delineations */
            paper: undefined,

            /** url of the last requested regions area SVG file */
            currentSVGName: undefined,

            /** 2D context of canvas used to draw measuring tape */
            ctx: null,

            /** set to true when user directly click region delineation on overlay (vs selecting it from region treeview) */
            userClickedRegion: false,

            disableAutoPanZoom: true,

            currentSliceRegions: new Map(),

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
            displayAreas: !this.config.bHideDelineation,
            regionsOpacity: 0.4,
            displayBorders: false,

            hoveredRegion: null,
            hoveredRegionSide: null,

            /** currently displayed plane */
            activePlane: overridingConf.activePlane || this.config.firstActivePlane,

            /** currently displayed slice on active plane */
            chosenSlice: undefined,

            /** currently selected slice for each plane */
            axialChosenSlice: (overridingConf.sliceNum && overridingConf.activePlane === ZAVConfig.AXIAL)
                ? overridingConf.sliceNum
                : this.config.axialChosenSlice,

            coronalChosenSlice: (overridingConf.sliceNum && overridingConf.activePlane === ZAVConfig.CORONAL)
                ? overridingConf.sliceNum
                : this.config.coronalChosenSlice,

            sagittalChosenSlice: (overridingConf.sliceNum && overridingConf.activePlane === ZAVConfig.SAGITTAL)
                ? overridingConf.sliceNum
                : this.config.sagittalChosenSlice,

            measureModeOn: false,
        };

        this.status.chosenSlice = this.getCurrentPlaneChosenSlice();

        this.setupTileSources(overridingConf);
    }

    static setupTileSources(overridingConf) {
        if (this.config.hasBackend) {
            if (this.config.data) {
                //Internet Imaging Protocol (IIP)
                if (this.status.useIIProtocol) {
                    const that = this;
                    const flayer = _.findWhere(this.config.layers, { index: 0 });
                    //prerequisite: all page have same image size and tile composition, so pyramidal infos for first image is reused for all
                    $.ajax({
                        //FIXME use specified plane
                        url: this.getIIIFTileSourceUrl(this.status.coronalChosenSlice, flayer.key, flayer.ext),
                        async: true,
                        success: (pyramidalImgInfo) => {
                            const tileSources = [];

                            that.status.IIPSVR_PATH = that.config.IIPSERVER_PATH.replace("\?IIIF=", "\?FIF=");

                            const tileDef = pyramidalImgInfo.tiles[0];

                            that.status.minLevel = 0;
                            that.status.maxLevel = tileDef.scaleFactors.length - 1;
                            that.status.levelScale = {};

                            //at maxLevel, image is at full scale
                            tileDef.scaleFactors.forEach(
                                (scaleFact, level, factors) =>
                                    that.status.levelScale[level] = scaleFact / factors[that.status.maxLevel]
                            );


                            that.status.tileWidth = tileDef.width;
                            that.status.tileHeight = tileDef.height;

                            that.status.imageWidth = pyramidalImgInfo.width;
                            that.status.imgeHeight = pyramidalImgInfo.height;


                            //number of tiles along both axis
                            that.status.xTilesNumAtMaxLevel = Math.ceil(that.status.imageWidth / that.status.tileWidth);
                            that.status.yTilesNumAtMaxLevel = Math.ceil(that.status.imgeHeight / that.status.tileHeight);

                            //number of tiles on X axis at each scale level
                            that.status.xTilesNumAtLevel = {};
                            for (var level = that.status.minLevel; level <= that.status.maxLevel; level++) {
                                that.status.xTilesNumAtLevel[level] = Math.ceil(that.status.xTilesNumAtMaxLevel * that.status.levelScale[level]);
                            }

                            //tile source for 1rst layer of each slices
                            //FIXME use specified plane
                            for (var j = 0; j < that.config.coronalSlideCount; j++) {

                                tileSources.push(
                                    //apply IIP image adjustments on 1rst layer, if any
                                    that.getTileSourceDef(flayer.key, flayer.ext, true)
                                );
                            }
                            that.status.tileSources = tileSources;

                            that.init2ndStage(overridingConf);
                        }

                    });

                } else {
                    //International Image Interoperability Framework (IIIF) protocol (default)

                    const tileSources = [];
                    if (this.config.data) {
                        const flayer = _.findWhere(this.config.layers, { index: 0 });
                        //FIXME use specified plane
                        for (var j = 0; j < this.config.coronalSlideCount; j++) {
                            tileSources.push(this.getIIIFTileSourceUrl(j, flayer.key, flayer.ext));
                        }
                    }
                    this.status.tileSources = tileSources;

                    this.init2ndStage(overridingConf);
                }
            }
        } else {
            //no backend image server
            /*
            if (this.config.data) {
                const flayer = _.findWhere(this.config.layers, { index: 0 });
                this.status.tileSources = this.getTileSourceDef(flayer.key, flayer.ext);
            }
            */

            //in case of multiplanes, first layer tiles source for all defined planes are appended in tileSources array
            const tileSources = [];
            if (this.config.data) {
                const flayer = _.findWhere(this.config.layers, { index: 0 });

                if (this.config.hasAxialPlane) {
                    for (var j = 0; j < this.config.axialSlideCount; j++) {
                        tileSources.push(this.getFileTileSourceUrl(j, flayer.key, flayer.ext, this.config.hasMultiPlanes ? ZAVConfig.AXIAL : null));
                    }
                }
                if (this.config.hasCoronalPlane) {
                    for (var j = 0; j < this.config.coronalSlideCount; j++) {
                        tileSources.push(this.getFileTileSourceUrl(j, flayer.key, flayer.ext, this.config.hasMultiPlanes ? ZAVConfig.CORONAL : null));
                    }
                }
                if (this.config.hasSagittalPlane) {
                    for (var j = 0; j < this.config.sagittalSlideCount; j++) {
                        tileSources.push(this.getFileTileSourceUrl(j, flayer.key, flayer.ext, this.config.hasMultiPlanes ? ZAVConfig.SAGITTAL : null));
                    }
                }
            }
            this.status.tileSources = tileSources;

            this.init2ndStage(overridingConf);
        }

    }



    static init2ndStage(overridingConf) {
        const that = this;

        const initialPage = this.config.initialPage;

        this.viewer = OpenSeadragon({
            id: VIEWER_ID,
            tileSources: this.status.tileSources,
            initialPage: initialPage,
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
            type: OpenSeadragon.ScalebarType.MAP,
            pixelsPerMeter: 1000 / (this.getPointXY(0, this.config.imageSize / 2).x - this.getPointXY(this.config.imageSize, this.config.imageSize / 2).x) * this.config.imageSize,//37cm:1000px
            minWidth: "150px",
            location: OpenSeadragon.ScalebarLocation.BOTTOM_LEFT,
            xOffset: 5,
            yOffset: 10,
            stayInsideImage: false,
            color: "rgb(255, 0, 0, 0.65)",
            fontColor: "rgb(255,255,255)",
            backgroundColor: "rgba(100,100, 100, 0.25)",
            fontSize: "10px",
            barThickness: 2
        });


        this.viewer.addHandler('add-overlay', function (event) {
            //add overlay is called for each page change
            //alert("Adding overlays");
            //Reference 1): http://chrishewett.com/blog/openseadragon-svg-overlays/
            if (that.config.svgFolerName != "") {
                /*
                let firstIndex;
                switch (that.status.activePlane) {
                    case ZAVConfig.AXIAL:
                        firstIndex = that.config.axialFirstIndex;
                        break;
                    case ZAVConfig.CORONAL:
                        firstIndex = that.config.coronalFirstIndex;
                        break;
                    case ZAVConfig.SAGITTAL:
                        firstIndex = that.config.sagittalFirstIndex;
                        break;
                }
                //const sliceNum = that.viewer.currentPage() - firstIndex;
                */
                const sliceNum = that.getCurrentPlaneChosenSlice();

                const svgPath = Utils.makePath(
                    that.config.PUBLISH_PATH, that.config.svgFolerName,
                    (that.config.hasMultiPlanes ? ZAVConfig.getPlaneLabel(that.status.activePlane) : null),
                    "Anno_" + sliceNum + ".svg"
                );

                that.addSVGData(svgPath, event.element);
            }
        });

        this.viewer.addHandler('open', function (event) {


            if (!that.viewer.source) { return; }

            /** overlay to hold region delineations (triggers 'add-overlay' event) */
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


            $(that.viewer.canvas).off('.posview');
            $(that.viewer.canvas).on('mousemove.posview', that.mousemoveHandler.bind(that));
        });


        //--------------------------------------------------
        /** quickfix: ensure that whole image is visible at startup */
        this.viewer.addOnceHandler('open', function () {
            const containerSize = that.viewer.viewport.getContainerSize();
            //FIXME id is a  constant
            const rightPanelWidth = document.getElementById("ZAV-rightPanel").getBoundingClientRect().width;

            const coveredPart = rightPanelWidth / containerSize.x;
            const uncoveredBounds = new OpenSeadragon.Rect(0, 0, 1 + coveredPart + 0.05, 1);
            that.viewer.viewport.fitBounds(uncoveredBounds);

            //restore state according to history provided at init
            that.applyChangeFromHistory(overridingConf);
        });

        //--------------------------------------------------
        //TODO replace by fixed image
        /** set image displayed in navigator as the one loaded in first layer */
        this.viewer.addHandler("open", function (event) {

            // items are automatically added to navigator when layers are added to viewer,
            // but only first layer at 100% opacity is needed
            const navItemReplaceHnd = function (event) {
                if (that.viewer.navigator.world.getItemCount() == 1 && event.userData.replaced == 0) {

                    var tiledImage = that.viewer.navigator.world.getItemAt(0);
                    //replace first item in navigator view by a clone with forced 100% opacity
                    var options = {
                        tileSource: event.item.source,
                        originalTiledImage: tiledImage,
                        opacity: 1,
                        replace: true,
                        index: 0
                    };
                    event.userData.replaced = 1;
                    that.viewer.navigator.addTiledImage(options);

                } else if (that.viewer.navigator.world.getItemCount() > 1) {

                    //remove any extra items from the navigator
                    event.userData.removed += 1;
                    that.viewer.navigator.world.removeItem(that.viewer.navigator.world.getItemAt(that.viewer.navigator.world.getItemCount() - 1));
                }

                //
                if (event.userData.replaced == 1 && event.userData.removed == _.size(that.config.layers) - 1) {

                    //remove current handler once replacement/removal has been performed
                    that.viewer.navigator.world.removeHandler("add-item", navItemReplaceHnd);
                }
            }

            that.viewer.navigator.world.addHandler("add-item", navItemReplaceHnd, { replaced: 0, removed: 0 });
        });

        //--------------------------------------------------
        //Apply filter on tracer signal once it is fully loaded

        this.viewer.world.addHandler('add-item', (addItemEvent) => {
            const tiledImage = addItemEvent.item;
            //retrieve layer info associated to added tiled image
            for (var i = 0; i < that.viewer.world.getItemCount(); i++) {
                if (that.viewer.world.getItemAt(i) === tiledImage) {
                    const layer = _.findWhere(that.status.layerDisplaySettings, { index: i });

                    //if this tiled imaged correspond to tracer signal
                    if (layer && layer.isTracer) {
                        //handler to set filter on once the image is fully loaded
                        const hnd = (fullyLoadedChangeEvent) => {
                            //this handler is called anytime the fullyLoaded status changes
                            if (fullyLoadedChangeEvent.fullyLoaded) {

                                // apply filter
                                that.setAllFilters();

                                //
                                tiledImage.removeHandler('fully-loaded-change', hnd);
                            }
                        };
                        tiledImage.addHandler('fully-loaded-change', hnd);
                    }
                    break;
                }
            }
        });


        //--------------------------------------------------
        this.viewer.world.addHandler('add-item', (addItemEvent) => {

            for (var i = 0; i < that.viewer.world.getItemCount(); i++) {
                if (that.viewer.world.getItemAt(i) === addItemEvent.item) {
                    const tiledImage = addItemEvent.item;
                    //retrieve layer info associated to tiled image source of the event
                    const layer = _.findWhere(that.status.layerDisplaySettings, { index: i });

                    //signal loading started for current tiledImage
                    that.eventSource.raiseEvent('zav-layer-loading', { layer: layer.key });

                    //register event handler to track loaded state (loaded state will change after panning & zomming)
                    tiledImage.addHandler('fully-loaded-change', (fullyLoadedChangeEvent) => {
                        if (fullyLoadedChangeEvent.fullyLoaded) {

                            that.eventSource.raiseEvent('zav-layer-loaded', { layer: layer.key });

                        } else {

                            that.eventSource.raiseEvent('zav-layer-loading', { layer: layer.key });
                        }
                    });

                    //if tiledImage is already loaded by then, event handler might not be called...
                    if (tiledImage.getFullyLoaded()) {
                        //... thus, signal loading finished for current tiledImage
                        that.eventSource.raiseEvent('zav-layer-loaded', { layer: layer.key })
                    }
                    break;
                }
            }

        });

        this.viewer.addHandler('zoom', (zoomEvent) => {
            //change must be recorded in browser's history
            that.makeHistoryStep();

            //some filter might need to be adjusted after zoom changed
            that.adjustFiltersAfterZoom(zoomEvent.zoom);
        });

        this.viewer.addHandler('pan', (panEvent) => {
            //change must be recorded in browser's history
            that.makeHistoryStep();
        });
        //--------------------------------------------------
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
        this.setMeasureMode(this.status.measureModeOn);
        this.resizeCanvas();

        //--------------------------------------------------
        this.eventSource.addHandler('zav-layer-loading', (event) => {
            this.status.layerDisplaySettings[event.layer].loading = true;
            this.signalStatusChanged(this.status);
        });
        this.eventSource.addHandler('zav-layer-loaded', (event) => {
            this.status.layerDisplaySettings[event.layer].loading = false;
            this.signalStatusChanged(this.status);
        });
        //--------------------------------------------------

        RegionsManager.addListeners(regionsStatus => {
            if (RegionsManager.getLastActionSource() != VIEWER_ACTIONSOURCEID) {
                ViewerManager.unselectRegions();
                ViewerManager.selectRegions(RegionsManager.getSelectedRegions());
            }
        });

    }
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

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
        this.status.currentSVGName = svgName;
        console.log("svg " + svgName);

        const that = this;

        $.ajax({
            url: svgName,
            async: true,
            success: function (html) {
                // process retrieved data only if it's the last one requested to ensure current slice SVG is loaded
                if (svgName === that.status.currentSVGName) {

                    strReturn = html;
                    var root = strReturn.getElementsByTagName('svg')[0];
                    var paths = root.getElementsByTagName('path');

                    that.status.currentSliceRegions.clear();

                    for (var i = 0; i < paths.length; i++) {

                        const rawId = paths[i].getAttribute('id').trim();
                        //append ordinal number to ensure unique id (case of non-contiguous regions)
                        const pathId = rawId + "-" + i;
                        paths[i].setAttribute('id', pathId);
                        var newPathElt = that.status.paper.importSVG(paths[i]);

                        that.applyMouseOutPresentation(newPathElt, false);

                        if (rawId === BACKGROUND_PATHID) {
                            //background elements
                            newPathElt.id = rawId;
                            newPathElt.attr("fill-opacity", 0.0);
                            that.status.currentSliceRegions.set(rawId, rawId);

                            //unselect all when click on the background element
                            newPathElt.click(function (e) {
                                if (that.status.showRegions) {
                                    that.unselectRegions();
                                    that.regionActionner.unSelectAll();
                                }
                            });

                        } else {
                            newPathElt.id = pathId;
                            //extract region abbreviation from path id
                            const suffix = rawId.substring(rawId.length - 2);
                            const side = (suffix === "_L") ? "(left)" : (suffix === "_R") ? "(right)" : "";
                            const abbrev = side ? rawId.substring(0, rawId.length - 2) : rawId;

                            that.status.currentSliceRegions.set(pathId, abbrev);

                            newPathElt.mouseover(function (e) {
                                if (that.status.showRegions) {
                                    that.applyMouseOverPresentation(this);
                                }
                                that.status.hoveredRegion = abbrev;
                                that.status.hoveredRegionSide = side;
                                that.signalStatusChanged(this.status);
                            });

                            newPathElt.mouseout(function (e) {
                                if (that.status.showRegions) {
                                    that.applyMouseOutPresentation(this, RegionsManager.isSelected(abbrev));
                                }
                                that.status.hoveredRegion = null;
                                that.status.hoveredRegionSide = null;
                                that.signalStatusChanged(this.status);
                            });

                            newPathElt.click(function (e) {
                                if (that.status.showRegions) {
                                    that.unselectRegions();
                                    if (e.ctrlKey) {
                                        //when Ctrl key is pressed, allow multi-select or toogle of currently selected region 
                                        if (RegionsManager.isSelected(abbrev)) {
                                            that.regionActionner.unSelect(abbrev);
                                        } else {
                                            that.regionActionner.addToSelection(abbrev);
                                        }
                                    } else {
                                        that.regionActionner.replaceSelected(abbrev);
                                    }
                                    that.status.userClickedRegion = true;
                                    that.selectRegions(RegionsManager.getSelectedRegions());

                                } else if (e.shiftKey) {

                                    that.applyMouseOverPresentation(this, true);
                                    setTimeout(() => that.applyUnselectedPresentation(this), 2500);
                                }
                            });
                        }

                        that.status.set.push(newPathElt);
                    }
                    that.eventSource.raiseEvent('zav-regions-created', { svgUrl: svgName })

                    that.adjustResizeRegionsOverlay(that.status.set);

                    //restore presentation of regions selected in previous slice
                    that.selectRegions(RegionsManager.getSelectedRegions());

                    if (!that.status.showRegions) {
                        that.hideDelineation();
                    }

                    RegionsManager.setCurrentSliceRegions(Array.from(that.status.currentSliceRegions.values()));

                    that.signalStatusChanged(this.status);
                }
            }
        });


    }

    /**  
     * @private
    */
    static adjustResizeRegionsOverlay(el) {
        if (this.viewer.world.getItemCount()) {

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
    }

    /**  
     * @private
    */
    static updateRegionsVisibility() {
        if (this.status.set) {
            if (!this.status.showRegions) {
                this.status.set.forEach(function (el) {
                    this.applyHiddenPresentation(el);
                }.bind(this));
            } else {
                this.status.set.forEach(function (el) {
                    if (el.id !== BACKGROUND_PATHID) {
                        this.applyUnselectedPresentation(el);
                    }
                }.bind(this));
            }
        }
    }

    /** 
     * Hide all region delineations
    * @private
    */
    static hideDelineation() {
        this.status.set.forEach(function (el) {
            this.applyHiddenPresentation(el);
        }.bind(this));
    }

    static updateRegionAreasPresentation() {
        if (this.status.set) {
            const selectedRegions = RegionsManager.getSelectedRegions();
            const that = this;
            this.status.set.forEach(function (el) {
                if (el.id !== BACKGROUND_PATHID) {
                    var abbrev = that.status.currentSliceRegions.get(el.id);
                    if (selectedRegions.includes(abbrev)) {
                        that.applySelectedPresentation(el);
                    } else {
                        that.applyUnselectedPresentation(el);
                    }
                }
            });
        }
        this.signalStatusChanged(this.status);
    }

    static changeRegionsOpacity(opacity) {
        this.status.regionsOpacity = opacity;
        this.updateRegionAreasPresentation();
    }

    static isShowingRegions() {
        return this.status.showRegions;
    }

    static hideRegions() {
        this.status.displayAreas = false;
        this.status.displayBorders = false;
        this.status.showRegions = false;
        this.updateRegionsVisibility();
        this.updateRegionAreasPresentation();
    }

    static toggleAreaDisplay() {
        this.status.displayAreas = !this.status.displayAreas;
        this.status.showRegions = this.status.displayBorders || this.status.displayAreas;
        if (this.status.showRegions) {
            this.setMeasureMode(false);
        }
        this.updateRegionsVisibility();
        this.updateRegionAreasPresentation();
    }

    static toggleBorderDisplay() {
        this.status.displayBorders = !this.status.displayBorders;
        this.status.showRegions = this.status.displayBorders || this.status.displayAreas;
        if (this.status.showRegions) {
            this.setMeasureMode(false);
        }
        this.updateRegionsVisibility();
        this.updateRegionAreasPresentation();
    }

    static applyMouseOverPresentation(element, forcedBorder = false) {
        const el = element.length ? element[0] : element;
        const color = el.node.getAttribute("fill");
        element.attr({
            "fill-opacity": (!this.status.displayAreas || this.status.regionsOpacity < 0.05) ? 0 : this.status.regionsOpacity + (this.status.regionsOpacity > 0.6 ? -0.4 : 0.4),
            "stroke-opacity": forcedBorder || this.status.displayBorders ? 1 : 0,
            "stroke-width": 30,
            "stroke": color,
        });
    }

    static applyMouseOutPresentation(element, isSelected) {
        if (isSelected) {
            this.applySelectedPresentation(element);
        } else {
            this.applyUnselectedPresentation(element);
        }
    }

    static applySelectedPresentation(element) {
        element.attr({
            "fill-opacity": (!this.status.displayAreas || this.status.regionsOpacity < 0.05) ? 0 : this.status.regionsOpacity + (this.status.regionsOpacity > 0.6 ? -0.4 : 0.4),
            "stroke-opacity": this.status.showRegions ? 0.7 : 0,
            "stroke-width": 20,
            "stroke": "#0000ff",
        });
    }

    static applyUnselectedPresentation(element) {
        const el = element.length ? element[0] : element;
        const color = el.node.getAttribute("fill");
        element.attr({
            "fill-opacity": this.status.displayAreas ? this.status.regionsOpacity : 0,
            "stroke-opacity": this.status.displayBorders ? 0.5 : 0,
            "stroke-width": 10,
            "stroke": color,
        });
    }

    static applyHiddenPresentation(element) {
        element.attr({
            "fill-opacity": 0,
            "stroke-opacity": 0,
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
                if (el.id !== BACKGROUND_PATHID) {
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
                var abbrev = that.status.currentSliceRegions.get(el.id);
                if (nameList.includes(abbrev)) {
                    that.applySelectedPresentation(el);
                }
            });

            // perform pan & zoom 
            if (!this.status.disableAutoPanZoom && !this.status.userClickedRegion) {
                this.centerOnRegions(nameList);
            }
            this.status.userClickedRegion = false;
        }

    }

    static centerOnRegions(nameList) {
        const that = this;
        //how to choose a center?
        var newX = 0;
        var newY = 0;
        var snCount = 0;
        for (var k = 0; k < nameList.length; k++) {
            //try to find the nodes -> slow way!
            this.status.set.forEach(function (el) {
                var subNode = el[0];
                if (that.status.currentSliceRegions.get(el.id) == nameList[k]) {
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

    static centerOnSelectedRegions() {
        this.centerOnRegions(RegionsManager.getSelectedRegions());
    }

    static switchPlane(newPlane) {
        this.status.activePlane = newPlane;
        this.status.chosenSlice = this.getCurrentPlaneChosenSlice();

        this.viewer.goToPage(this.getPageNumForCurrentSlice());
        this.claerPosition();
    }

    static activatePlane(newPlane) {
        if (newPlane !== this.status.activePlane) {
            this.switchPlane(newPlane);

            //change must be recorded (immediately) in browser's history
            this.makeActualHistoryStep({ s: this.status.chosenSlice, a: this.status.activePlane });
            this.signalStatusChanged(this.status);
        }
    }

    static getPlaneSlideCount(plane) {
        switch (plane) {
            case ZAVConfig.AXIAL:
                return this.config.axialSlideCount;
            case ZAVConfig.CORONAL:
                return this.config.coronalSlideCount;
            case ZAVConfig.SAGITTAL:
                return this.config.sagittalSlideCount;
        }
    }

    static getPlaneSliceStep(plane) {
        switch (plane) {
            case ZAVConfig.AXIAL:
                return this.config.axialSliceStep;
            case ZAVConfig.CORONAL:
                return this.config.coronalSliceStep;
            case ZAVConfig.SAGITTAL:
                return this.config.sagittalSliceStep;
        }
    }

    static getCurrentPlaneChosenSlice() {
        const chosenSlice = this.getPlaneChosenSlice(this.status.activePlane);
        return chosenSlice;
    }

    static getPlaneChosenSlice(plane) {
        switch (plane) {
            case ZAVConfig.AXIAL:
                return this.status.axialChosenSlice;
            case ZAVConfig.CORONAL:
                return this.status.coronalChosenSlice;
            case ZAVConfig.SAGITTAL:
                return this.status.sagittalChosenSlice;
        }
    }


    static getPageNumForCurrentPlaneSlice(sliceNum) {
        return this.getPageNumForPlaneSlice(this.status.activePlane, sliceNum);
    }

    static getPageNumForPlaneSlice(plane, sliceNum) {
        switch (plane) {
            case ZAVConfig.AXIAL:
                return this.config.axialFirstIndex + sliceNum;
            case ZAVConfig.CORONAL:
                return this.config.coronalFirstIndex + sliceNum;
            case ZAVConfig.SAGITTAL:
                return this.config.sagittalFirstIndex + sliceNum;
        }
    }

    static getPageNumForCurrentSlice() {
        return this.getPageNumForCurrentPlaneSlice(this.getCurrentPlaneChosenSlice());
    }

    static checkNSetChosenSlice(plane, chosenSlice) {
        switch (plane) {
            case ZAVConfig.AXIAL:
                if (chosenSlice > (this.config.axialSlideCount - 1)) {
                    chosenSlice = this.config.axialSlideCount - 1;
                } else if (chosenSlice < 0) {
                    chosenSlice = 0;
                }
                this.status.axialChosenSlice = chosenSlice;
                return chosenSlice;

            case ZAVConfig.CORONAL:
                if (chosenSlice > (this.config.coronalSlideCount - 1)) {
                    chosenSlice = this.config.coronalSlideCount - 1;
                } else if (chosenSlice < 0) {
                    chosenSlice = 0;
                }
                this.status.coronalChosenSlice = chosenSlice;
                return chosenSlice;

            case ZAVConfig.SAGITTAL:
                if (chosenSlice > (this.config.sagittalSlideCount - 1)) {
                    chosenSlice = this.config.sagittalSlideCount - 1;
                } else if (chosenSlice < 0) {
                    chosenSlice = 0;
                }
                this.status.sagittalChosenSlice = chosenSlice;
                return chosenSlice;

        }
    }

    /**  
    * @public
    */
    static goToPlaneSlice(plane, chosenSlice, regionsToCenterOn) {
        //TODO use plane 
        if (plane != this.status.activePlane || chosenSlice != this.getCurrentPlaneChosenSlice()) {
            this.status.activePlane = plane;
            chosenSlice = this.checkNSetChosenSlice(plane, chosenSlice);
            this.status.chosenSlice = chosenSlice;

            //asynchronous focus the view on specified regions of interest 
            if (regionsToCenterOn) {
                const that = this;
                this.eventSource.addOnceHandler('zav-regions-created', (event) => {
                    that.centerOnRegions(regionsToCenterOn);
                });
            }

            const pageNum = this.getPageNumForCurrentSlice();
            this.viewer.goToPage(pageNum);

            //change must be recorded (immediately) in browser's history
            this.makeActualHistoryStep({ s: chosenSlice, a: this.status.activePlane });

            this.signalStatusChanged(this.status);
        }
    }

    static goToSlice(chosenSlice, regionsToCenterOn) {
        this.goToPlaneSlice(this.status.activePlane, chosenSlice, regionsToCenterOn);
    }

    static shiftToSlice(increment) {
        this.goToPlaneSlice(this.status.activePlane, this.status.chosenSlice + increment);
    }

    static changeSlices(slicesByPlane) {

        //for all planes but the active one
        for (const [p, slice] of Object.entries(slicesByPlane)) {
            const plane = parseInt(p);
            if (plane != this.status.activePlane) {
                this.checkNSetChosenSlice(plane, slice);
            }
        }

        //eventually change active plane's slice
        if (_.has(slicesByPlane, this.status.activePlane)) {
            this.goToPlaneSlice(this.status.activePlane, slicesByPlane[this.status.activePlane]);
        } else {
            this.signalStatusChanged(this.status);
        }
    }


    //https://github.com/openseadragon/openseadragon/issues/1421 to improve caching
    static getPoint(x, y) {
        var point;
        var tx = this.config.imageSize - x;
        var ty = this.config.imageSize - y;
        point = new Array(tx, this.getPlaneChosenSlice(this.status.activePlane) * this.getPlaneSliceStep(this.status.activePlane), ty, 1);
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
            const layerIndex = this.config.layers[key].index;
            const viewerLayer = this.viewer.world.getItemAt(layerIndex);
            if (viewerLayer) {
                viewerLayer.setOpacity(opacity);
                //since changing opacity on the viewer automatically spreads to the navigator, explicit reset to 100% opacity in the navigator is required 
                const navigatorLayer = this.viewer.navigator.world.getItemAt(layerIndex);
                if (navigatorLayer) {
                    navigatorLayer.setOpacity(1);
                }
            }
        }
    }


    static getFileTileSourceUrl(slideNum, key, ext, plane) {
        //if no plane param is specified (= single plane mode), returned plane label will be undefined, thus the url won't contain reference to any plane 
        return Utils.makePath(this.config.dataRootPath, key, ZAVConfig.getPlaneLabel(plane), slideNum + ext);
    }

    /**
     * compute url to retrieve a specific tile stored in file folders (no backend image server)
     */
    static getFileTileUrl(slideNum, key, ext, level, x, y) {
        switch (this.status.activePlane) {
            case ZAVConfig.AXIAL:
                slideNum -= this.config.axialFirstIndex;
                return this.config.dataRootPath + "/" + key + "/axial/" + slideNum + "_files/" + level + "/" + x + "_" + y + ".jpg";

            case ZAVConfig.CORONAL:
                slideNum -= this.config.coronalFirstIndex;
                return this.config.dataRootPath + "/" + key + "/coronal/" + slideNum + "_files/" + level + "/" + x + "_" + y + ".jpg";

            case ZAVConfig.SAGITTAL:
                slideNum -= this.config.sagittalFirstIndex;
                return this.config.dataRootPath + "/" + key + "/sagittal/" + slideNum + "_files/" + level + "/" + x + "_" + y + ".jpg";
        }
    }

    static getIIIFTileSourceUrl(slideNum, key, ext) {
        return this.config.IIPSERVER_PATH + key + "/" + slideNum + ext + this.config.TILE_EXTENSION;
    }

    /**
     * compute url to retrieve a specific tile following IIP protocol format 
     * @param {*} slideNum : slide number
     * @param {*} key : layer id
     * @param {*} ext : image file extension
     * @param {*} level : scale level
     * @param {*} x : x index of the tile
     * @param {*} y : y index of the tile
     */
    static getIIPTileUrl(slideNum, key, ext, level, x, y, applyIIPadjustment) {
        const xTilesNum = Math.ceil(this.status.xTilesNumAtMaxLevel * this.status.levelScale[level]);
        return (
            this.status.IIPSVR_PATH + key + "/"
            + slideNum + ext
            + (applyIIPadjustment && this.status.gamma ? ("&GAM=" + this.status.gamma) : "")
            + (applyIIPadjustment && this.status.contrast ? ("&CNT=" + this.status.contrast) : "")
            // + "&WID=" + this.status.tileWidth + "&HEI=" + this.status.tileHeight
            + "&JTL=" + (level ? level : "0") + "," + (y * xTilesNum + x)
        );
    }

    static getTileSourceDef(key, ext, applyIIPadjustment) {
        const currentPage = this.getPageNumForCurrentSlice();
        if (this.config.hasBackend) {
            if (this.status.useIIProtocol) {
                return {
                    width: this.status.imageWidth,
                    height: this.status.imgeHeight,
                    tileWidth: this.status.tileWidth,
                    tileHeight: this.status.tileHeight,

                    overlap: 1,

                    maxLevel: this.status.maxLevel,
                    minLevel: this.status.minLevel,
                    getTileUrl: (level, x, y) => this.getIIPTileUrl(currentPage, key, ext, level, x, y, applyIIPadjustment)
                }
            } else {
                return this.getIIIFTileSourceUrl(currentPage, key, ext);
            }
        } else {
            return {
                width: this.config.dzLayerWidth,
                height: this.config.dzLayerHeight,
                tileSize: 256,

                overlap: 1,

                //minLevel: 0,
                //maxLevel: 10, //maxLevel should correspond to the depth of the number of folders in the dzi subdirectory

                getTileUrl: (level, x, y) => this.getFileTileUrl(currentPage, key, ext, level, x, y)
            }
        }
    };

    /**
     * Called once 1rst layer is opened to add other layers
     */
    static addLayer(key, name, ext) {
        var options = {
            tileSource: this.getTileSourceDef(key, ext),
            opacity: this.getLayerOpacity(key),
            success: (event) => this.setAllFilters()
        };

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

    /** adjust filters to the new zoom factor */
    static adjustFiltersAfterZoom(zoom) {
        const tracerLayer = _.findWhere(this.status.layerDisplaySettings, { isTracer: true });
        const newDilationSize = zoom > 2.5 ? 0 : zoom > 1.5 ? 3 : zoom > 0.3 ? 5 : 7;
        //change filters only if dilation kernel size changed
        if (tracerLayer && newDilationSize != tracerLayer.dilation) {
            tracerLayer.dilation = newDilationSize;
            if (tracerLayer.enhanceSignal) {
                this.setAllFilters();
            }
        }
    }

    /** reset filters : the plugin API allows only to set all processors for all tiled images at once  */
    static setAllFilters() {

        const filters = [];
        _.each(this.status.layerDisplaySettings, (layer, key) => {
            const processors = [];

            if (layer.isTracer) {
                //change filters only if dilation kernel size changed
                if (layer.enhanceSignal && layer.dilation > 0) {
                    processors.push(OpenSeadragon.Filters.MORPHOLOGICAL_OPERATION(layer.dilation, Math.max));
                }
                processors.push(CustomFilters.INTENSITYALPHA());

            } else {

                if (layer.contrastEnabled) {
                    processors.push(OpenSeadragon.Filters.CONTRAST(layer.contrast));
                }
                if (layer.gammaEnabled) {
                    processors.push(OpenSeadragon.Filters.GAMMA(layer.gamma));
                }
            }

            if (processors.length) {
                const tiledImage = this.viewer.world.getItemAt(layer.index);
                filters.push({
                    items: tiledImage,
                    processors: processors
                });
            }

        });
        this.viewer.setFilterOptions({
            filters: filters
        });

    }


    static changeLayerContrast(layerid, enabled, contrast) {
        if (this.config.layers[layerid]) {
            this.status.layerDisplaySettings[layerid].contrastEnabled = enabled;
            this.status.layerDisplaySettings[layerid].contrast = contrast;
            this.setAllFilters();
            this.signalStatusChanged(this.status);
        }
    }

    static changeLayerGamma(layerid, enabled, gamma) {
        if (this.config.layers[layerid]) {
            this.status.layerDisplaySettings[layerid].gammaEnabled = enabled;
            this.status.layerDisplaySettings[layerid].gamma = gamma;
            this.setAllFilters();
            this.signalStatusChanged(this.status);
        }
    }

    static changeLayerEnhancer(layerid, enabled) {
        if (this.config.layers[layerid]) {
            this.status.layerDisplaySettings[layerid].enhanceSignal = enabled;
            this.setAllFilters();
            this.signalStatusChanged(this.status);
        }
    }

    //--------------------------------------------------
    // position
    static resizeCanvas() {
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

        if (this.status.measureModeOn) {
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
        }

        this.setPosition();

        // show canvas
        this.displayMeasureLine();

        this.signalStatusChanged(this.status);
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
        if (!this.status.measureModeOn) { return; }

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

    static setMeasureMode(active) {
        this.claerPosition();
        if (active) {
            //measurement mode and display of regions are mutually exclusive
            this.hideRegions();
        }
        this.status.measureModeOn = active;
        if (this.status.measureModeOn) {
            $("#poscanvas").show();
        } else {
            $("#poscanvas").hide();
        }
        this.signalStatusChanged(this.status);
    }

    static isMeasureModeOn() {
        return this.status && this.status.measureModeOn;
    }


    //record current viewer state in browser history
    static makeActualHistoryStep(explicitParams) {
        let stepParams;
        //explicitely specified params override live values
        if (explicitParams) {
            stepParams = explicitParams;
        } else {
            //get live values (Beware, OSD must not be transitioning)
            const imageZoom = this.viewer.viewport.viewportToImageZoom(this.viewer.viewport.getZoom());
            const center = this.viewer.viewport.viewportToImageCoordinates(this.viewer.viewport.getCenter());
            const sliceNum = this.getCurrentPlaneChosenSlice();

            stepParams = {
                z: imageZoom.toFixed(3),
                x: Math.round(center.x), y: Math.round(center.y),
                s: sliceNum, a: this.status.activePlane
            };
        }
        Utils.pushHistoryStep(this.history, stepParams);
    }

    static getParamsFromCurrLocation() {
        return this.getParamsFromLocation(this.history.location);
    }

    /** get params from location and check that they are well-formed  */
    static getParamsFromLocation(location) {
        const confParams = {};
        const confFromPath = Utils.getConfigFromLocation(location);
        if (confFromPath.a) {
            const plane = parseInt(confFromPath.a, 10);
            if (plane === ZAVConfig.AXIAL || plane === ZAVConfig.CORONAL || plane === ZAVConfig.SAGITTAL) {
                confParams.activePlane = plane;
            }
        }
        if (confFromPath.s) {
            const sliceNum = parseInt(confFromPath.s, 10);
            if (!isNaN(sliceNum) && isFinite(sliceNum)) {
                const plane = confParams.activePlane || this.status.activePlane;
                if (sliceNum >= 0
                    && sliceNum <= (this.getPlaneSlideCount(plane) - 1)) {
                    confParams.sliceNum = sliceNum;
                }
            }
        }
        if (confFromPath.z) {
            const imageZoom = Number(confFromPath.z);
            if (!isNaN(imageZoom) && isFinite(imageZoom)) {
                if (imageZoom >= this.config.minImageZoom && imageZoom <= this.config.maxImageZoom) {
                    confParams.imageZoom = imageZoom;
                }
            }
        }
        if (confFromPath.x && confFromPath.y) {
            const x = parseInt(confFromPath.x, 10);
            const y = parseInt(confFromPath.y, 10);
            if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
                if (x >= 0 && y >= 0) {
                    confParams.center = new OpenSeadragon.Point(x, y);
                }
            }
        }
        if (confFromPath.p) {
            confParams.protocol = confFromPath.p;
        }
        if (confFromPath.GAM) {
            const gamma = Number(confFromPath.GAM);
            if (!isNaN(gamma) && isFinite(gamma)) {
                if (gamma >= 0 && gamma <= 5) {
                    confParams.gamma = gamma;
                }
            }
        }
        if (confFromPath.CNT) {
            const contrast = Number(confFromPath.CNT);
            if (!isNaN(contrast) && isFinite(contrast)) {
                if (contrast >= 0 && contrast <= 5) {
                    confParams.contrast = contrast;
                }
            }
        }
        return confParams;
    }

    static applyChangeFromHistory(params) {
        if (params.imageZoom) {
            const viewportZoom = this.viewer.viewport.imageToViewportZoom(params.imageZoom);
            this.viewer.viewport.zoomTo(viewportZoom);
        }
        if (params.center) {
            const refPoint = this.viewer.viewport.imageToViewportCoordinates(params.center);
            this.viewer.viewport.panTo(refPoint);
        }

        let targetPlane = params.activePlane || this.status.activePlane;
        if (params.sliceNum && params.sliceNum != this.getPlaneChosenSlice(targetPlane)) {
            let targetSlice = params.sliceNum || this.getPlaneChosenSlice(targetPlane);
            //update active slice    
            targetSlice = this.checkNSetChosenSlice(targetPlane, targetSlice);
        }
        if (params.activePlane) {
            //change active plane and page
            this.switchPlane(targetPlane);
        } else if (params.sliceNum) {
            this.viewer.goToPage(this.getPageNumForCurrentSlice());
        }

        if (params.gamma) {
            this.status.gamma = params.gamma;
        } else {
            delete this.status.gamma;
        }
        if (params.contrast) {
            this.status.contrast = params.contrast;
        } else {
            delete this.status.contrast;
        }
    }
}

export default ViewerManager;
