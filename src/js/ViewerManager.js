import _ from 'underscore';

import paper from 'paper';
import Color from 'color';

import Utils from './Utils.js';

import RegionsManager from './RegionsManager'
import ZAVConfig from './ZAVConfig.js';

import CustomFilters from './CustomFilters.js';
import UserSettings from './UserSettings.js';

export const VIEWER_ID = "openseadragon1";
export const NAVIGATOR_ID = "navigatorDiv";


const VIEWER_ACTIONSOURCEID = 'VIEWER';
const BACKGROUND_PATHID = 'background';

const SVGNS = "http://www.w3.org/2000/svg";

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

        this.history.listen(({location, action}) => {
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
        Object.entries(this.config.data).forEach(([key, value], i) => {
            //FIXME should use another method than name to identify tracer signal layer
            const isTracer = value.metadata.includes("nn_tracer");

            const itemKeyLayerPrefix = UserSettings.getLayerKeyPrefix(config.viewerId, key)

            const useIIProtocol = value.protocol === 'IIP';

            const initContrast = parseFloat(value.contrast || 1.0);
            const initGamma = parseFloat(value.gamma || 1.0);

            initLayerDisplaySettings[key] = new Proxy({
                key: key,
                enabled: UserSettings.getBoolItem(itemKeyLayerPrefix + 'enabled', true),
                initOpacity: value.opacity ? parseInt(value.opacity) : 100,
                opacity: UserSettings.getNumItem(
                    itemKeyLayerPrefix + 'opacity',
                    value.opacity ? parseInt(value.opacity) : 100
                ),
                name: value.metadata,
                index: i,
                isTracer: isTracer,
                enhanceSignal: false,
                manualEnhancing: false,
                dilation: 0,
                manualDilation: 0,
                autoDilation: 0,

                defaultProtocol: value.protocol || 'IIIF',
                useIIProtocol: useIIProtocol,

                contrastEnabled: UserSettings.getBoolItem(itemKeyLayerPrefix + 'contrastEnabled', initContrast != 1.0),
                initContrast: initContrast,
                contrast: UserSettings.getNumItem(itemKeyLayerPrefix + 'contrast', initContrast),
                gammaEnabled: UserSettings.getBoolItem(itemKeyLayerPrefix + 'gammaEnabled', initGamma != 1.0),
                initGamma: initGamma,
                gamma: UserSettings.getNumItem(itemKeyLayerPrefix + 'gamma', initGamma),
            },
                //handler to intercept Set operations and store it as user settings as required
                {
                    set: function (target, property, value) {
                        if (['enabled', 'contrastEnabled', 'gammaEnabled'].includes(property)) {
                            target[property] = value;
                            const itemKey = itemKeyLayerPrefix + property;
                            UserSettings.setBoolItem(itemKey, value);
                            return true;
                        } else if (['opacity', 'contrast', 'gamma'].includes(property)) {
                            target[property] = value;
                            const itemKey = itemKeyLayerPrefix + property;
                            UserSettings.setNumItem(itemKey, value);
                            return true;
                        } else {
                            return Reflect.set(...arguments);
                        }
                    }
                }
            );
        });

        //params retrieved from initial location
        const overridingConf = this.getParamsFromCurrLocation();
        // should use overrinf configuration only if it make sens with current data
        const overridingPlane = this.config.hasPlane(overridingConf.activePlane) ? overridingConf.activePlane : null;

        /** dynamic state of the viewer */
        this.status = new Proxy({

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
            /** set to true if the above one correspond to an actual (and loaded) SVG */
            hasCurrentSVG: false,

            /** 2D context of canvas used to draw measuring tape */
            ctx: null,

            /** set to true when user directly click region delineation on overlay (vs selecting it from region treeview) */
            userClickedRegion: false,

            disableAutoPanZoom: true,

            /** region info indexed by SVG path id for the current slice (retrieved from SVG) */
            currentSliceRegions: new Map(),

            /** info for measuring line feature  */
            position: [
                {
                    x: 0, y: 0,        // last recorded position of mouse pointer in screen coordinates 
                    c: 0               // number of recorded points 
                },
                { x: 0, y: 0 },        // image space coordinates of recorded point #1
                { x: 0, y: 0 }         // image space coordinates of recorded point #2
            ],

            /** couple of recorded pointer positions in physical space coordinates (used by measuring line feature) */
            markedPos: undefined,
            markedPosColors: ["#ff7", "#ff61b3"],

            /** up-to-date 3D position in physical space coordinates (for live display of position) */
            livePosition: undefined,

            /** pointer position when click started (used to prevent position marking when Dragging occurs) */
            pointerdownpos: { x: 0, y: 0 },


            /** layers display values */
            layerDisplaySettings: initLayerDisplaySettings,

            /** set to true when all tiles are loaded for the current view */
            isAllLoaded: false,

            /** open UI with right panel expanded */
            initExpanded: false,

            /** visibility of region areas & delineations  */
            showRegions: this.config.showRegions,
            displayAreas: this.config.displayAreas,
            displayBorders: this.config.displayBorders,
            initRegionsOpacity: 0.4,
            regionsOpacity: UserSettings.getNumItem(UserSettings.SettingsKeys.OpacityAtlasRegionArea, 0.4),

            /** info about region currently hovered by mouse cursor */
            hoveredRegion: null,
            hoveredRegionSide: null,

            /** path id of the last selected region */
            lastSelectedPath: null,

            /** (reusable) mouse event listeners for region contained in the current slice */
            regionEventListeners: {},

            /** currently displayed plane */
            activePlane: overridingPlane || this.config.firstActivePlane,

            /** currently displayed slice on active plane */
            chosenSlice: undefined,

            /** currently selected slice for each plane */
            axialChosenSlice: (overridingConf.sliceNum && overridingPlane === ZAVConfig.AXIAL)
                ? overridingConf.sliceNum
                : this.config.axialChosenSlice,

            coronalChosenSlice: (overridingConf.sliceNum && overridingPlane === ZAVConfig.CORONAL)
                ? overridingConf.sliceNum
                : this.config.coronalChosenSlice,

            sagittalChosenSlice: (overridingConf.sliceNum && overridingPlane === ZAVConfig.SAGITTAL)
                ? overridingConf.sliceNum
                : this.config.sagittalChosenSlice,

            /** set to true when measuring tool is activated  */
            measureModeOn: false,

            /** set to true when clip selection tool is activated  */
            clippingModeOn: false,

            /** [topleft.x, topleft.y, width, height] in pixels */
            clippedRegion: undefined,
            /** top-left corner of the previous respecting selected processor size constraint  */
            constrainedClippedRegion: undefined,

            /** index of currently selected custom processor */
            selectedprocIndex: undefined,

            /** image resulting of last processing */
            processedImage: undefined,
            /** zoom factor at which the processing has been preformed  */
            processedZoom: undefined,
            /** clip definition used for last processing */
            processedRegion: undefined,
            /** processed image clip top-left pixel coords in the full size image */
            processedTopleftPx: undefined,

            /** set to true while processing is being computed */
            processingActive: undefined,
            /** message to display as model */
            longRunningMessage: undefined,

            /** previous values of gesture to zoom factors stored while zoon is locked */
            prevZoomPerScroll: undefined,
            prevZoomPerClick: undefined,

            /** set to true when region editing mode is enabled */
            editModeOn: false,
            /** set to true when a region is being edited */
            editingActive: false,
            /** current editing tool */
            editingTool: 'pen',
            /** current editing tool radius */
            editingToolRadius: 60,

            /** original ID of the region path being edited */
            editOrigPathId: undefined,
            /** current ID of the region path being edited */
            editPathId: undefined,

            /** source path element to be edited (in the region overlay) */
            editRegion: undefined,
            /** root SVG element containing region being edited */
            editSVG: undefined,
            /** color of the edited path */
            editPathFillColor: undefined,
            editPathStrokeColor: undefined,
            /** path element representing the region being edited */
            editLivePath: undefined,
            /** last recorder position of cursor during region editing*/
            editPos: undefined,

        },
            //handler to intercept Set operations and store it as user settings as required
            {
                set: function (target, property, value) {
                    if ('displayAreas' === property) {
                        target[property] = value;
                        UserSettings.setBoolItem(UserSettings.SettingsKeys.ShowAtlasRegionArea, value);
                        return true;
                    } else if ('displayBorders' === property) {
                        target[property] = value;
                        UserSettings.setBoolItem(UserSettings.SettingsKeys.ShowAtlasRegionBorder, value);
                        return true;
                    } else if ('regionsOpacity' === property) {
                        target[property] = value;
                        UserSettings.setNumItem(UserSettings.SettingsKeys.OpacityAtlasRegionArea, value);
                        return true;
                    } else {
                        return Reflect.set(...arguments);
                    }
                }
            }
        );
        this.status.chosenSlice = this.getCurrentPlaneChosenSlice();

        this.setupTileSources(overridingConf);
    }

    static setupTileSources(overridingConf) {
        const layerEntries = Object.values(this.config.layers);
        const firstLayer = layerEntries.length > 0 ? layerEntries[0] : undefined;

        if (this.config.hasBackend) {
            if (this.config.data) {

                if (firstLayer.protocol === 'IIP') {
                    //Internet Imaging Protocol (IIP)

                    const that = this;

                    //Prerequisite: All pages have same image size and tile composition, so pyramidal infos for first image is reused for all
                    $.ajax({
                        //FIXME use specified plane
                        url: this.getIIIFTileSourceUrl(this.status.coronalChosenSlice, firstLayer.key, firstLayer.ext),
                        async: true,
                        success: (pyramidalImgInfo) => {
                            const tileSources = [];

                            that.status.IIPSVR_PATH = that.config.IIPSERVER_PATH.replace("\?IIIF=", "\?FIF=");

                            const tileDef = pyramidalImgInfo.tiles[0];

                            const minLevel = 0;
                            const maxLevel = tileDef.scaleFactors.length - 1;
                            const iipTileInfos = {
                                minLevel: minLevel,
                                maxLevel: maxLevel,
                                levelScale: {},
                                tileWidth: tileDef.width,
                                tileHeight: tileDef.height,

                                imageWidth: pyramidalImgInfo.width,
                                imgeHeight: pyramidalImgInfo.height,

                                //number of tiles along both axis
                                xTilesNumAtMaxLevel: Math.ceil(pyramidalImgInfo.width / tileDef.width),
                                yTilesNumAtMaxLevel: Math.ceil(pyramidalImgInfo.height / tileDef.height),

                                //number of tiles on X axis at each scale level
                                xTilesNumAtLevel: {},
                            }

                            //at maxLevel, image is at full scale
                            tileDef.scaleFactors.forEach(
                                (scaleFact, level, factors) =>
                                    iipTileInfos.levelScale[level] = scaleFact / factors[maxLevel]
                            );

                            for (var level = minLevel; level <= maxLevel; level++) {
                                iipTileInfos.xTilesNumAtLevel[level] = Math.ceil(iipTileInfos.xTilesNumAtMaxLevel * iipTileInfos.levelScale[level]);
                            }

                            that.status.iipTileInfos = iipTileInfos;

                            //tile source for 1rst layer of each slices
                            //FIXME use specified plane
                            for (var j = 0; j < that.config.coronalSlideCount; j++) {

                                tileSources.push(
                                    that.getTileSourceDef(firstLayer.key, firstLayer.ext)
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

                        //FIXME use specified plane
                        for (var j = 0; j < this.config.coronalSlideCount; j++) {
                            tileSources.push(this.getIIIFTileSourceUrl(j, firstLayer.key, firstLayer.ext));
                        }
                        this.status.tileSources = tileSources;

                        this.init2ndStage(overridingConf);
                    }
                }
            }
        } else {
            //no backend image server

            //in case of multiplanes, first layer tiles source for all defined planes are appended in tileSources array
            const tileSources = [];
            if (this.config.data) {

                if (this.config.hasAxialPlane) {
                    for (var j = 0; j < this.config.axialSlideCount; j++) {
                        tileSources.push(this.getFileTileSourceUrl(j, firstLayer.key, firstLayer.ext, this.config.hasMultiPlanes ? ZAVConfig.AXIAL : null));
                    }
                }
                if (this.config.hasCoronalPlane) {
                    for (var j = 0; j < this.config.coronalSlideCount; j++) {
                        tileSources.push(this.getFileTileSourceUrl(j, firstLayer.key, firstLayer.ext, this.config.hasMultiPlanes ? ZAVConfig.CORONAL : null));
                    }
                }
                if (this.config.hasSagittalPlane) {
                    for (var j = 0; j < this.config.sagittalSlideCount; j++) {
                        tileSources.push(this.getFileTileSourceUrl(j, firstLayer.key, firstLayer.ext, this.config.hasMultiPlanes ? ZAVConfig.SAGITTAL : null));
                    }
                }

                this.status.tileSources = tileSources;

                //prerequisite: all page have same image size and tile composition, so pyramidal infos for first image is reused for all
                const that = this;
                $.ajax({
                    //FIXME use specified plane
                    url: tileSources[0],
                    async: true,
                    dataType: "xml",
                    success: (dziInfo) => {
                        const sizeNodes = dziInfo.getElementsByTagNameNS("http://schemas.microsoft.com/deepzoom/2008", "Size");
                        if (sizeNodes.length) {
                            const sizeNode = sizeNodes.item(0);
                            const widthAttr = sizeNode.attributes["Width"];
                            if (widthAttr) {
                                that.status.imageWidth = parseInt(widthAttr.value);
                            }
                            const heightAttr = sizeNode.attributes["Height"];
                            if (heightAttr) {
                                that.status.imageHeight = parseInt(heightAttr.value);
                            }
                        }
                        that.init2ndStage(overridingConf);
                    }
                });

            }

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
            showFullPageControl: false,
            //keep image size (and zoom) when container/window is resized
            preserveImageSizeOnResize: true,
            autoResize: true,
        });

        if (this.config.matrix) {
            const pixelsPerMeter = 1000 / this.config.matrix[0];
            this.viewer.scalebar({
                type: OpenSeadragon.ScalebarType.MAP,
                pixelsPerMeter: pixelsPerMeter,
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
        }


        this.viewer.addHandler('add-overlay', function (event) {
            //add overlay is called for each page change
            //Reference 1): http://chrishewett.com/blog/openseadragon-svg-overlays/
            if (that.config.svgFolerName != "") {
                //load region delineations in the dedicated overlay
                if (event.element.id === 'svgDelineationOverlay') {
                    if (that.config.hasDelineation) {
                        that.status.hasCurrentSVG = false;
                        const svgPath = that.getRegionsSVGUrl();
                        that.addSVGData(svgPath, event.element);
                    }
                }
            }
        });

        this.viewer.addHandler('open', function (event) {


            if (!that.viewer.source) { return; }
            const dimensions = that.viewer.source.dimensions;

            if (that.status.editModeOn) {
                /** overlay to hold currently edited region */
                const editOverlay = document.createElement("div");
                editOverlay.className = "overlay";
                editOverlay.id = "svgEditOverlay";
                editOverlay.style.zIndex = 0;

                that.viewer.addOverlay({
                    element: editOverlay,
                    location: that.viewer.viewport.imageToViewportRectangle(new OpenSeadragon.Rect(0, 0, dimensions.x, dimensions.y)),
                });
            }

            /** overlay to hold region delineations (triggers 'add-overlay' event) */
            const regionOverlay = document.createElement("div");
            regionOverlay.className = "overlay";
            regionOverlay.id = "svgDelineationOverlay";

            that.viewer.addOverlay({
                element: regionOverlay,
                location: that.viewer.viewport.imageToViewportRectangle(new OpenSeadragon.Rect(0, 0, dimensions.x, dimensions.y)),
            });

            Object.entries(that.config.layers).forEach(([key, value]) => {
                if (value.index != 0) {
                    that.addLayer(key, value.name, value.ext);
                } else {
                    that.setLayerOpacity(key);
                }
            });


            if (that.status.mousemoveHandler) {
                that.viewer.canvas.removeEventListener('mousemove', that.status.mousemoveHandler);
            }
            that.status.mousemoveHandler = that.mousemoveHandler.bind(that);
            that.viewer.canvas.addEventListener('mousemove', that.status.mousemoveHandler);
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

                    //if this tiled image corresponds to tracer signal
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

            const i = that.viewer.world.getIndexOfItem(addItemEvent.item);
            const tiledImage = addItemEvent.item;
            //retrieve layer info associated to tiled image source of the event

            const layers = Object.values(that.status.layerDisplaySettings)
            const layer = i < layers.length ? layers[i] : undefined;
            if (layer) {
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
            }

        });

        this.viewer.addHandler('page', (zoomEvent) => {
            //discard previous custom processing result if any
            that.status.processedImage = null;
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
                { tracker: 'viewer', handler: 'clickHandler', hookHandler: this.onViewerClick },
                { tracker: 'viewer', handler: 'dragHandler', hookHandler: this.onViewerDrag.bind(this) },
                { tracker: 'viewer', handler: 'keyHandler', hookHandler: this.onViewerKey },
            ]
        });

        this.viewer.addHandler('resize', function (event) {
            that.resizeCanvas();
            that.adjustResizeRegionsOverlay(that.status.set);
        });


        this.viewer.addHandler('animation', function (event) {
            that.adjustResizeRegionsOverlay(that.status.set);
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
            if (this.status.isAllLoaded) {
                this.eventSource.raiseEvent('zav-alllayers-loading');
            }
            this.status.isAllLoaded = false;
            this.signalStatusChanged(this.status);
        });
        this.eventSource.addHandler('zav-layer-loaded', (event) => {
            this.status.layerDisplaySettings[event.layer].loading = false;
            const isAllLoaded = !_.findKey(this.status.layerDisplaySettings, function (val, key) { return val.loading; });
            if (isAllLoaded && !this.status.isAllLoaded) {
                this.eventSource.raiseEvent('zav-alllayers-loaded');
            }
            this.status.isAllLoaded = isAllLoaded;
            this.signalStatusChanged(this.status);
        });
        //all layers loaded 
        this.eventSource.addHandler('zav-alllayers-loaded', (event) => {


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
    //create SVG element where all editing related drawing is performed  
    static createEditSVGElement() {
        if (this.status.editModeOn) {
            const editOverlay = document.getElementById('svgEditOverlay');
            const regionSVG = document.getElementById('svgDelineationOverlay').getElementsByTagName('svg')[0];

            const svg = document.createElementNS(SVGNS, "svg");
            //same size a region delineation SVG
            svg.setAttribute('height', regionSVG.getAttribute('height'));
            svg.setAttribute('width', regionSVG.getAttribute('width'));
            svg.setAttribute('style', 'overflow: hidden; position: relative;');
            const svgNS = svg.namespaceURI;
            const g = document.createElementNS(svgNS, 'g');
            g.setAttribute('id', 'svgEditGroup');
            svg.appendChild(g);
            editOverlay.appendChild(svg);
            this.status.editSVG = svg;

            new OpenSeadragon.MouseTracker({

                element: this.status.editSVG,

                dblClickHandler: (event) => {
                    //double-clicking outside a region stop the current region being edited
                    if (this.status.editPathId) {
                        this.stopEditingRegion(event);
                    }
                },
                moveHandler: (event) => {
                    //incremental edit after each move while left button pressed
                    if (event.buttons == 1) {
                        this.doEdit(event);
                    }
                },
                pressHandler: (event) => {
                    //start active editing when left button pressed
                    if (event.buttons == 1) {
                        this.startEdit(event);
                    }
                },
                releaseHandler: (event) => {
                    //stop active editing when left button is released
                    this.suspendEdit(event)
                },
            });
        }
    }


    static createEditSVGBackground(srcBackNode) {
        if (this.status.editModeOn) {

            srcBackNode.setAttribute('id', 'editBackgroundPath');
            srcBackNode.setAttribute('class', 'editBackground');
            srcBackNode.setAttribute('fill-opacity', 0);
            this.status.editBackgNode = srcBackNode.cloneNode();
            const editGroup = document.getElementById('svgEditGroup');
            if (editGroup) {
                editGroup.appendChild(this.status.editBackgNode);
            }

            this.status.editScope = paper.setup([10, 10]);
        }
    }


    static getEditCursorSVG(tool) {
        //
        const brushRadius = this.status.editingToolRadius;
        const brushBorder = 8;
        const color = Color(this.status.editPathFillColor);
        const invcolor = color.negate();
        const zoom = this.viewer.world.getItemAt(0).viewportToImageZoom(this.viewer.viewport.getZoom(true));
        const scaledWidth = 2 * brushRadius * zoom;

        const eraserOn = tool == 'eraser';
        const strokeDash = eraserOn ? 'stroke-dasharray="1 1"' : '';
        const fillColor = eraserOn ? invcolor : color;
        const strokeColor = eraserOn ? 'silver' : invcolor;

        return `url('data:image/svg+xml;utf8,
<svg
 width="${scaledWidth}" 
 height="${scaledWidth}" 
 viewBox="0 0 ${2 * (brushRadius + brushBorder)} ${2 * (brushRadius + brushBorder)}" 
 xmlns="${SVGNS}" 
 style="background-color: transparent;"
 >
  <g>
    <circle 
     cx="${brushRadius + brushBorder}" 
     cy="${brushRadius + brushBorder}" 
     r="${brushRadius}" 
     stroke="${strokeColor}" 
     stroke-width="${brushBorder}" 
     fill="${fillColor}" 
     fill-opacity="0.55"
     ${strokeDash}
    />
  </g>
</svg>
') ${scaledWidth / 2} ${scaledWidth / 2}, crosshair
`.replace(/\n/g, '');

    }

    //set up specific mouse cursor for edit  
    static updateEditCursor() {
        if (this.status.editPathId) {
            const inlinedCursor = this.getEditCursorSVG(this.status.editingTool);
            this.status.editSVG.style.cursor = inlinedCursor;
        }
    }

    static removeEditCursor() {
        this.status.editSVG.style.cursor = 'default';
    }


    static getSVGPos(x, y) {
        const zoom = this.viewer.world.getItemAt(0).viewportToImageZoom(this.viewer.viewport.getZoom(true));
        return { x: Math.round(x / zoom), y: Math.round(y / zoom) };
    }

    static startEditRegionPath(pathId) {
        this.stopEditingRegion();
        const regionInDom = document.getElementById(pathId);
        if (regionInDom) {
            this.selectEditRegion(regionInDom);
        }
    }

    static selectEditRegion(targetElt) {
        //
        if (targetElt.id && !targetElt.id.startsWith(BACKGROUND_PATHID)) {

            this.status.editOrigPathId = this.status.editPathId = targetElt.id;
            this.status.editRegion = targetElt;
            this.status.editPathFillColor = targetElt.getAttribute("fill");
            this.status.editPathStrokeColor = targetElt.getAttribute("stroke");

            const editGroup = this.status.editSVG.getElementById('svgEditGroup');
            //copy region svg as a base for edit 
            const newLivPath = targetElt.cloneNode();
            newLivPath.id = "beingEditedRegion";

            //insert in DOM
            editGroup.appendChild(newLivPath);
            newLivPath.setAttribute("stroke", Color(this.status.editPathFillColor).negate());
            newLivPath.removeAttribute("style");
            newLivPath.setAttribute("fill-opacity", 0.35);
            newLivPath.setAttribute("stroke-opacity", 0.2);
            newLivPath.setAttribute("stroke-width", 20);
            newLivPath.setAttribute("vector-effect", "non-scaling-stroke");


            this.status.editLivePath = newLivPath;
            //import as Paper object for edit transformations
            this.status.editRegionPath = paper.project.importSVG(newLivPath, { insert: false });

            //hide source region while its copy is being edited
            targetElt.style.display = 'none';

            //place the editing overlay on top of region overlay while editing is being done
            const editOverlay = document.getElementById('svgEditOverlay');
            editOverlay.style.zIndex = 1;

            this.updateEditCursor();

            this.signalStatusChanged(this.status);
        }
    }

    static startEdit(e) {
        this.status.editingActive = true;
        this.status.editPos = this.status.lastPos;
        this.doEdit(e, true);
    }

    static changeEditedRegionName(newRegionId) {
        const oldPathId = this.status.editPathId;

        const regionInfo = this.status.currentSliceRegions.get(oldPathId);
        this.status.currentSliceRegions.delete(oldPathId);

        const sepIndex = oldPathId.lastIndexOf('-');
        const pathIdSuffix = oldPathId.substr(sepIndex);
        const newPathId = newRegionId + pathIdSuffix;

        const { suffix, side, abbrev } = this._splitRegionId(newRegionId);
        regionInfo.pathId = newPathId;
        regionInfo.abbrev = abbrev;
        regionInfo.regionId = newRegionId;
        this.status.currentSliceRegions.set(newPathId, regionInfo);
        this.status.editPathId = newPathId;

        this.signalStatusChanged(this.status);
    }

    static changeEditedRegionFill(newFill) {
        const regionInfo = this.status.currentSliceRegions.get(this.status.editPathId);
        regionInfo.fill = newFill;
        this.status.editPathFillColor = newFill;
        this.status.editLivePath.setAttribute('fill', newFill);
        this.status.editLivePath.setAttribute("stroke", Color(newFill).negate());

        //stop/start edit to save change
        this.startEditRegionPath(this.status.editPathId);

        this.signalStatusChanged(this.status);
    }

    static suspendEdit(e) {
        this.status.editingActive = false;
    }

    static doEdit(e, forcedEdit) {
        if (this.status.editingActive) {

            const prevPos = this.status.editPos;
            //const newPos = this.getSVGPos(e.layerX, e.layerY);
            const newPos = this.getSVGPos(e.position.x, e.position.y);
            this.status.editPos = newPos;
            if (forcedEdit || (prevPos && (Math.abs(prevPos.x - newPos.x) > 1 || Math.abs(prevPos.y - newPos.y) > 1))) {

                const outlined = new paper.Path.Circle(new paper.Point(newPos.x, newPos.y), this.status.editingToolRadius);

                const united =
                    this.status.editingTool == 'eraser' ?
                        this.status.editRegionPath.subtract(outlined, { insert: false })
                        :
                        this.status.editRegionPath.unite(outlined, { insert: false });

                const newLivPath = united.exportSVG();
                this.status.editRegionPath = united;

                this.status.editLivePath.replaceWith(newLivPath);
                this.status.editLivePath = newLivPath;

            }
        } else {

            //store first position of editing segment
            this.status.lastPos = this.getSVGPos(e.position.x, e.position.y);

        }
    };

    static stopEditingRegion() {
        this.status.editingActive = false;
        if (this.status.editPathId) {

            //restore region overlay above edition
            const editOverlay = document.getElementById('svgEditOverlay');
            editOverlay.style.zIndex = 0;

            this.removeEditCursor();
            const newPathId = this.status.editPathId;
            this.status.editPathId = null;

            //replace exisiting region by edited one

            //remove un-edited source region from Raphaël set
            this.status.set.exclude(this.status.editRegion);
            const regionId = this.status.editRegion.getAttribute('bma:regionId');

            const origPathId = this.status.editRegion.id;

            //remove from DOM
            this.status.editRegion.remove();

            //import edited region in Raphaël  
            const modifiedRegion = this.status.editRegionPath.exportSVG();
            modifiedRegion.setAttribute('id', newPathId);

            //FIXME region order is not conserved, Raphaël will place the newly imported region at the end 
            const newRaphElt = this.status.paper.importSVG(modifiedRegion);
            newRaphElt.attr('fill', this.status.editPathFillColor);
            newRaphElt.attr('stroke', this.status.editPathStrokeColor);
            this.status.set.push(newRaphElt);

            //once modified path is added to DOM, restore lost attributes
            const modifiedRegionInDom = document.getElementById(newPathId);
            //restore non-scaling strocke attribute
            modifiedRegionInDom.setAttribute("vector-effect", "non-scaling-stroke");

            //in case region id was modified
            const regionInfo = this.status.currentSliceRegions.get(newPathId);
            const newRegionId = regionInfo.regionId ? regionInfo.regionId : regionId;

            //restore region Id
            modifiedRegionInDom.setAttribute('bma:regionId', newRegionId);

            if (newRegionId == regionId) {
                //reuse region event listener
                this.connectRegionListeners(newRaphElt, this.status.regionEventListeners[origPathId]);
            } else {
                //change listener since id has been modified
                delete this.status.regionEventListeners[origPathId];
                this._addNActivateRegion(newPathId, newRegionId, newRaphElt);
            }

            this.applyUnselectedPresentation(newRaphElt);

            this.status.editLivePath.remove();

            this.status.editLivePath = null;
            this.status.editPos = null;
            this.status.editRegion = null;

            //call WS to remotely save
            this.updateSVGRegion(modifiedRegionInDom, this.status.editOrigPathId);
            this.status.editOrigPathId = null;

            this.signalStatusChanged(this.status);
        }
    }

    static createOrUpdateSVGRegion(regionInDom, create, origPathId) {
        const pathId = regionInDom.getAttribute('id');
        const regionId = regionInDom.getAttribute('bma:regionId');

        const url = this.getRegionsSVGEditUrl({ region: pathId });
        fetch(
            url,
            {
                method: 'PUT',
                headers: {
                    "Accept": "application/json",
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    mode: (create ? "cr" : "up"),
                    //original path id in case of id modification
                    pathId: origPathId ? origPathId : pathId,
                    regionId: regionId,
                    pathSVG: regionInDom.outerHTML,
                }),
            })
            .then(response => {
                if (response.ok) {
                    return Promise.resolve(response.json());
                } else {
                    throw new Error(response.status + ' - ' + response.message);
                }
            })
            .then(data => {
                //console.debug((create ? 'New' : 'Modified') + ' region path ' + pathId + ' successfully saved!', data);
            })
            .catch((error) => {
                //FIXME alert user
                console.error('Error when saving region path ' + pathId);
            });

    }

    static updateSVGRegion(regionInDom, origPathId) {
        this.createOrUpdateSVGRegion(regionInDom, false, origPathId);
    }

    static createSVGRegion(regionInDom) {
        this.createOrUpdateSVGRegion(regionInDom, true);
    }

    static createPathForRegion(regionId, fill, stroke) {

        const maxPathIndex = Array.from(this.getCurrentSliceRegions().keys())
            .reduce(
                (maxIndex, pathId) => {
                    const sepPos = pathId.lastIndexOf('-')
                    return Math.max(0, sepPos > 0 ? parseInt(pathId.substr(sepPos + 1)) : -1)
                },
                0
            )
        const pathId = regionId + '-' + (maxPathIndex + 1);
        const newPath = document.createElementNS(SVGNS, "path");
        newPath.id = pathId;
        newPath.setAttribute('fill', fill);
        newPath.setAttribute('stroke', stroke);

        //import in Raphael
        const newRaphElt = this.status.paper.importSVG(newPath);
        this.status.set.push(newRaphElt);
        //locate DOM element created by Raphael
        const regionInDom = document.getElementById(pathId);

        //restore attributes stripped by Raphael import
        regionInDom.setAttribute("vector-effect", "non-scaling-stroke");
        regionInDom.setAttribute('bma:regionId', regionId);

        this._addNActivateRegion(pathId, regionId, newRaphElt);

        //call WS to remotely save
        this.createOrUpdateSVGRegion(regionInDom, true);

        //start editing the new region
        this.selectEditRegion(regionInDom);

        this.signalStatusChanged(this.status);
    }

    static createSVGForRegions() {
        const url = this.getRegionsSVGEditUrl();
        fetch(
            url,
            {
                method: 'POST',
                headers: {
                    "Accept": "application/json",
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    width: this.status.imageWidth,
                    height: this.status.imageHeight
                }),
            })
            .then(response => {
                if (response.ok) {
                    return Promise.resolve(response.json());
                } else {
                    throw new Error(response.status + ' - ' + response.message);
                }
            })
            .then(data => {
                //console.debug('New SVG successfully created!');

                //Reload (newly created) SVG
                this.shiftToSlice(0, true);
            })
            .catch((error) => {
                //FIXME alert user
                console.error('Error while creating new SVG:' + error);
            });

    }

    static startEditingClickedRegion() {
        if (this.status.lastSelectedPath) {
            this.startEditRegionPath(this.status.lastSelectedPath);
        } else {
            this.status.acquiringRegionToEdit = true;
        }
    }

    static simplifyEditedRegion() {
        if (this.status.editPathId) {

            if (this.status.editRegionPath.simplify()) {
                const newLivPath = this.status.editRegionPath.exportSVG();

                this.status.editLivePath.replaceWith(newLivPath);
                this.status.editLivePath = newLivPath;
            }
        }
    }

    static extendRegionListenerForEdit(listener) {
        listener.dblclick = (e) => {
            if (this.status.editPathId) {
                this.stopEditingRegion(e);
            } else {
                this.selectEditRegion(e.target);
            }
        };

        listener.click = [
            listener.click,
            (e, raphElt) => {
                if (this.status.acquiringRegionToEdit) {
                    this.status.acquiringRegionToEdit = false;
                    this.selectEditRegion(e.target);
                }
            }
        ];

        return listener;
    }

    static connectRegionListeners(newPathElt, regionListener) {
        newPathElt.mouseover(function (e) { regionListener.mouseover(e, this); });
        newPathElt.mouseout(function (e) { regionListener.mouseout(e, this); });
        newPathElt.click(function (e) {
            if (_.isArray(regionListener.click)) {
                for (let clickListener of regionListener.click) {
                    clickListener(e, this);
                }
            } else {
                regionListener.click(e, this);
            }
        });
        if (regionListener.dblclick) {
            newPathElt.dblclick(function (e) { regionListener.dblclick(e, this); });
        }
    }

    static changeEditingTool(newTool) {
        this.status.editingTool = newTool;
        this.updateEditCursor();
        this.signalStatusChanged(this.status);
    }

    static changeEditingRadius(newradius) {
        this.status.editingToolRadius = newradius;
        this.updateEditCursor();
        this.signalStatusChanged(this.status);
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

        this.status.currentSVGName = svgName;
        //console.log("svg " + svgName);

        //Create SVG element dedicated to edition
        this.createEditSVGElement();

        const that = this;

        //load SVG
        $.ajax({
            url: svgName,
            async: true,
            success: function (svgFile) {
                // process retrieved data only if it's the last one requested to ensure current slice SVG is loaded
                if (svgName === that.status.currentSVGName) {
                    const root = svgFile.getElementsByTagName('svg')[0];
                    that.status.hasCurrentSVG = (typeof root !== "undefined");
                    var paths = root.getElementsByTagName('path');

                    that.status.currentSliceRegions.clear();
                    //new set of mouse event listeners 
                    that.status.regionEventListeners = {};

                    let hasBackground = false;
                    const svgElement = overlayElement.getElementsByTagName('svg')[0];
                    for (var i = 0; i < paths.length; i++) {

                        let regionId = paths[i].getAttribute('bma:regionId') ? paths[i].getAttribute('bma:regionId').trim() : null;
                        let pathId;
                        if (regionId) {
                            //when a specific attribute holding region id exists, SVG path's id is garanteed to be unique
                            pathId = paths[i].getAttribute('id').trim();
                        } else {
                            //Legacy SVG : regionId is specified in the id attribute of the path
                            regionId = paths[i].getAttribute('id').trim();
                            //append ordinal number to ensure unique id (case of non-contiguous regions)
                            pathId = regionId + (regionId === BACKGROUND_PATHID ? '' : ('-' + i));
                            paths[i].setAttribute('id', pathId);
                        }

                        var newPathElt = that.status.paper.importSVG(paths[i]);

                        that.applyMouseOutPresentation(newPathElt, false);

                        const isBackgroundElement = (regionId === BACKGROUND_PATHID);
                        if (isBackgroundElement) {
                            //background elements
                            newPathElt.id = pathId;
                            newPathElt.attr("fill-opacity", 0.0);

                            //unselect all when click on the background element
                            newPathElt.click(function (e) {
                                if (that.status.showRegions) {
                                    that.unselectRegions();
                                    that.regionActionner.unSelectAll();
                                    that.status.lastSelectedPath = null;
                                }
                            });

                            //Create Background path in the SVG dedicated to edition
                            that.createEditSVGBackground(paths[i]);
                            hasBackground = true;

                        } else {
                            newPathElt.id = pathId;

                            that._addNActivateRegion(pathId, regionId, newPathElt);

                            that.applyUnselectedPresentation(newPathElt);
                        }

                        that.status.set.push(newPathElt);

                        if (!isBackgroundElement) {

                            //once path elements are added to the DOM
                            const modifiedRegionInDom = svgElement.getElementById(pathId);
                            if (modifiedRegionInDom) {
                                //restore custom attribute lost when imported in Raphaël
                                modifiedRegionInDom.setAttribute('bma:regionId', regionId);
                                //make path's stroke width independant of scaling transformations 
                                modifiedRegionInDom.setAttribute("vector-effect", "non-scaling-stroke");
                            }
                        }
                    }
                    if (!hasBackground) {
                        console.warn("SVG without background: Region rendering and edition will likely fail! " + svgName);
                    }

                    that.eventSource.raiseEvent('zav-regions-created', { svgUrl: svgName })

                    that.adjustResizeRegionsOverlay(that.status.set);

                    //restore presentation of regions selected in previous slice
                    that.selectRegions(RegionsManager.getSelectedRegions());

                    if (!that.status.showRegions) {
                        that.hideDelineation();
                    }

                    that.regionActionner.setCurrentSliceRegions(
                        Array.from(that.status.currentSliceRegions.values())
                            .map((r) => r.abbrev)
                    );

                    that.signalStatusChanged(that.status);
                }
            }
        });


    }

    static _splitRegionId(regionId) {
        //extract hemisphere side from region id 
        const suffix = regionId ? regionId.substring(regionId.length - 2) : "";
        const side = (suffix === "_L") ? "(left)" : (suffix === "_R") ? "(right)" : "";
        //region abbreviation without hemisphere side
        const abbrev = side ? regionId.substring(0, regionId.length - 2) : regionId;
        return { suffix, side, abbrev };
    }

    static _addNActivateRegion(pathId, regionId, newPathElt) {
        const that = this;
        const { suffix, side, abbrev } = this._splitRegionId(regionId);

        const pathElt = newPathElt.items[0];
        that.status.currentSliceRegions.set(pathId, {
            abbrev: abbrev,
            pathId: pathId,
            fill: pathElt.attr("fill"),
            stroke: pathElt.attr("stroke"),
        });

        //grouped listeners so they can be easily reused
        const regionListener = {
            abbrev: abbrev,
            side: side,

            mouseover: (e, raphElt) => {
                //highlight border and display info about hovered region
                if (that.status.showRegions) {
                    that.applyMouseOverPresentation(raphElt);
                }
                that.status.hoveredRegion = abbrev;
                that.status.hoveredRegionSide = side;
                that.signalStatusChanged(that.status);
            },

            mouseout: (e, raphElt) => {
                //remove highlighted border and info when cursor move out of region
                if (that.status.showRegions) {
                    that.applyMouseOutPresentation(raphElt, RegionsManager.isSelected(abbrev));
                }
                that.status.hoveredRegion = null;
                that.status.hoveredRegionSide = null;
                that.signalStatusChanged(that.status);
            },

            click: (e, raphElt) => {

                if (that.status.showRegions) {
                    that.unselectRegions();
                    if (e.ctrlKey) {
                        //when Ctrl key is pressed, allow multi-select or toogle of currently selected region 
                        if (RegionsManager.isSelected(abbrev)) {
                            that.regionActionner.unSelect(abbrev);
                            if (that.status.lastSelectedPath == pathId) {
                                that.status.lastSelectedPath = null;
                            } else {
                                that.status.lastSelectedPath = pathId;
                            }
                        } else {
                            that.regionActionner.addToSelection(abbrev);
                            that.status.lastSelectedPath = pathId;
                        }
                    } else {
                        that.regionActionner.replaceSelected(abbrev);
                        that.status.lastSelectedPath = pathId;
                    }
                    that.status.userClickedRegion = true;
                    that.selectRegions(RegionsManager.getSelectedRegions());

                } else if (e.shiftKey) {

                    that.applyMouseOverPresentation(raphElt, true);
                    setTimeout(() => that.applyUnselectedPresentation(raphElt), 2500);
                }
            },

        };

        that.status.regionEventListeners[pathId] = regionListener;

        //Add event listener related to edit mode
        if (that.status.editModeOn) {
            that.status.regionEventListeners[pathId] = that.extendRegionListenerForEdit(regionListener);
        }

        that.connectRegionListeners(newPathElt, that.status.regionEventListeners[pathId]);

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
            if (this.status.paper) {
                this.status.paper.setTransform(' scale(' + zoom + ',' + zoom + ') translate(0,' + this.config.dzDiff + ')');
            }
            //console.log('S' + zoom + ',' + zoom + ',0,0');

            this.refreshCanvasContent();

            if (this.status.editModeOn) {
                //scale edition overlay
                const editGroup = document.getElementById('svgEditGroup');
                if (editGroup) {
                editGroup.setAttribute('transform', ' scale(' + zoom + ',' + zoom + ') translate(0,' + this.config.dzDiff + ')');
                this.updateEditCursor();
                } else {
                    console.error('#svgEditGroup not found!')
                }
            }
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
                    const regionInfo = that.status.currentSliceRegions.get(el.id);
                    const abbrev = regionInfo ? regionInfo.abbrev : null;
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

    static setBorderDisplay(active) {
        this.status.displayBorders = active;
        this.status.showRegions = this.status.displayBorders || this.status.displayAreas;
        if (this.status.showRegions) {
            this.setMeasureMode(false);
        }
        this.updateRegionsVisibility();
        this.updateRegionAreasPresentation();
    }

    static toggleBorderDisplay() {
        this.setBorderDisplay(!this.status.displayBorders);
    }

    static applyMouseOverPresentation(element, forcedBorder = false) {
        const el = element.length ? element[0] : element;
        const color = el.node.getAttribute("fill");
        element.attr({
            "fill-opacity": (!this.status.displayAreas || this.status.regionsOpacity < 0.05) ? 0 : this.status.regionsOpacity + (this.status.regionsOpacity > 0.6 ? -0.4 : 0.4),
            "stroke-opacity": forcedBorder || this.status.displayBorders ? 1 : 0,
            "stroke-width": '4px',
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
            "stroke-width": '3px',
            "stroke": "#0000ff",
        });
    }

    static applyUnselectedPresentation(element) {
        const el = element.length ? element[0] : element;
        const color = el.node.getAttribute("fill");
        element.attr({
            "fill-opacity": this.status.displayAreas ? this.status.regionsOpacity : 0,
            "stroke-opacity": this.status.displayBorders ? 0.5 : 0,
            "stroke-width": '2px',
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
                const regionInfo = that.status.currentSliceRegions.get(el.id);
                const abbrev = regionInfo ? regionInfo.abbrev : null;
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
                const subNode = el[0];
                const regionInfo = that.status.currentSliceRegions.get(el.id);
                if (regionInfo && regionInfo.abbrev == nameList[k]) {
                    snCount++;
                    const bbox = subNode.getBBox();
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

    static getLastSelectedPath() {
        return this.status ? this.status.lastSelectedPath : null;
    }

    static setLastSelectedPath(pathId) {
        this.status.lastSelectedPath = pathId;
    }

    static getCurrentSliceRegions() {
        return this.status ? this.status.currentSliceRegions : null;
    }

    static switchPlane(newPlane) {
        //allow switching to another plane only if it exits!
        if (this.config.hasPlane(newPlane)) {
            this.status.activePlane = newPlane;
            this.status.chosenSlice = this.getCurrentPlaneChosenSlice();

            this.viewer.goToPage(this.getPageNumForCurrentSlice());
            this.claerPosition();
            return true;
        } else {
            return false;
        }
    }

    static getActivePlane() {
        return this.status.activePlane;
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
    static goToPlaneSlice(plane, chosenSlice, regionsToCenterOn, force) {
        //TODO use plane 
        if (force || plane != this.status.activePlane || chosenSlice != this.getCurrentPlaneChosenSlice()) {
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

    static goToSlice(chosenSlice, regionsToCenterOn, force) {
        this.goToPlaneSlice(this.status.activePlane, chosenSlice, regionsToCenterOn, force);
    }

    static shiftToSlice(increment, force) {
        this.goToPlaneSlice(this.status.activePlane, this.status.chosenSlice + increment, null, force);
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


    //get point in physical space coordinates from specified image coordinates
    static getPoint(x, y) {
        const tx = this.config.imageSize - x;
        const ty = this.config.imageSize - y;
        const point = new Array(tx, this.getPlaneChosenSlice(this.status.activePlane) * this.getPlaneSliceStep(this.status.activePlane), ty, 1);
        //return multiplyMatrixAndPoint(point);
        const result = [0, 0, 0, 0];
        for (var i = 0; i < 4; i++) {
            for (var j = 0; j < 4; j++) {
                result[i] += (this.config.matrix[i * 4 + j] * point[j]);
            }
        }
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
        // update current position of pointer in local (DOM content) coordinates
        this.status.position[0].x = event.clientX;
        this.status.position[0].y = event.clientY;
        var orig = this.viewer.viewport.pixelFromPoint(new OpenSeadragon.Point(0, 0), true);
        // convert to coordinates in image space
        var x = (this.status.position[0].x - orig.x - rect.left) / zoom;
        var y = (this.status.position[0].y - orig.y - rect.top) / zoom;

        //update clipping box when clip selection has started
        if (this.status.clippingModeOn && this.status.position[0].c == 1) {
            this.status.position[2].x = x;
            this.status.position[2].y = y;
            this.displayClipBox();
        }

        //update position in physical space
        if (this.config.matrix) {
            this.status.livePosition = this.getPoint(x, y);
        }

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

    static onViewerDrag(event) {
        // Disable panning on the viewer when a region is selected for edition
        if (this.status.editModeOn && this.status.editPathId) {
            event.preventDefaultAction = true;
        }
    }

    static onViewerKey(event) {
        // Disable keyboard shortcuts on the viewer using event.preventDefaultAction
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

    /**
     * Refresh effective opacity of the layer stack including and below the specified one,
     * and returns the id of refreshed layers
     * 
     *   Effective opacity of a layer is zero (to prevent it from being loaded by OSD),
     *   when any fully opaque layer above it renders it invisible.
     *   (Assuming that there's no transparent color in the layer images, except for tracer layer)
     */
    static refreshLayersEffectiveOpacity(startLayerKey) {
        const opacities = [];
        let hasOpaqueLayerAbove = false;

        let skip = true;
        Object.keys(this.config.layers)
            // from top to bottom
            .reverse()
            // iterate over layers
            .forEach((currentLayerKey) => {

                const isStartingLayer = currentLayerKey == startLayerKey;
                const currentlayer = this.status.layerDisplaySettings[currentLayerKey];

                //skip computing opacity for layer above the specified one
                skip = skip && !isStartingLayer;

                if (!skip) {
                    //effective opacity is set to 0 when layer is disabled or covered by another layer above it
                    currentlayer.effectiveOpacity = (!hasOpaqueLayerAbove && currentlayer.enabled) ? currentlayer.opacity / 100 : 0;
                    opacities.push(currentLayerKey);
                }

                //check if the current layer is hidding the one below
                if (!hasOpaqueLayerAbove) {
                    //layeris enabled and fully opaque and not a tracer layer (which has alpha values),
                    hasOpaqueLayerAbove =
                        !currentlayer.isTracer
                        && currentlayer.enabled
                        && currentlayer.opacity == 100;
                }
            });

        return opacities;
    }

    static setLayerOpacity(key) {
        if (this.config.layers[key]) {
            //Update the effective opacity of the specified layer and the ones below
            this.refreshLayersEffectiveOpacity(key)
                .forEach(layerKey => {
                    const layerInfo = this.status.layerDisplaySettings[layerKey];
                    const layerIndex = this.config.layers[layerKey].index;

                    const viewerLayer = this.viewer.world.getItemAt(layerIndex);
                    if (viewerLayer) {
                        viewerLayer.setOpacity(layerInfo.effectiveOpacity);

                        if (layerInfo.effectiveOpacity == 0) {
                            //if effective opacity is zero, loading won't occur or be canceled
                            //hence finished loading status needs to be forced to stop active progress bar
                            this.status.layerDisplaySettings[layerKey].loading = false;
                        }

                        //since changing opacity on the viewer automatically spreads to the navigator, explicit reset to 100% opacity in the navigator is required 
                        const navigatorLayer = this.viewer.navigator.world.getItemAt(layerIndex);
                        if (navigatorLayer) {
                            navigatorLayer.setOpacity(1);
                        }
                    }
                });
        }
    }

    static getRegionsSVGEditUrl(extraParams) {
        const sliceNum = this.getCurrentPlaneChosenSlice();
        const url = new URL(Utils.makePath("../", this.config.ADMIN_PATH, 'SVG.php'), window.location);
        const params = this.config.viewerId ?
            {
                dataset: this.config.viewerId,
                plane: this.status.activePlane
            }
            : {};
        _.extend(params, { slice: this.getCurrentPlaneChosenSlice() });
        if (extraParams) {
            _.extend(params, extraParams);
        }
        url.search = new URLSearchParams(params).toString();
        return url.toString();
    }

    static getRegionsSVGUrl(extraParams) {

        if (this.status.editModeOn) {
            return this.getRegionsSVGEditUrl(extraParams);
        } else {
            const sliceNum = this.getCurrentPlaneChosenSlice();
            const svgurl = Utils.makePath(
                this.config.PUBLISH_PATH, this.config.svgFolerName,
                (this.config.hasMultiPlanes ? ZAVConfig.getPlaneName(this.status.activePlane) : null),
                "Anno_" + sliceNum + ".svg"
            );
            return svgurl;
        }
    }

    static getFileTileSourceUrl(slideNum, key, ext, plane) {
        //if no plane param is specified (= single plane mode), returned plane label will be undefined, thus the url won't contain reference to any plane 
        return Utils.makePath(this.config.dataRootPath, key, ZAVConfig.getPlaneName(plane), slideNum + ext);
    }

    /**
     * compute url to retrieve a specific tile stored in file folders (no backend image server)
     */
    static getFileTileUrl(slideNum, key, ext, level, x, y) {
        switch (this.status.activePlane) {
            case ZAVConfig.AXIAL:
                slideNum -= this.config.axialFirstIndex;
                break;
            case ZAVConfig.CORONAL:
                slideNum -= this.config.coronalFirstIndex;
                break;
            case ZAVConfig.SAGITTAL:
                slideNum -= this.config.sagittalFirstIndex;
                break;
        }
        return this.config.dataRootPath + "/" + key + (this.config.hasMultiPlanes ? "/" + ZAVConfig.getPlaneName(this.status.activePlane) : "") + "/" + slideNum + "_files/" + level + "/" + x + "_" + y + ".jpg";
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
    static getIIPTileUrl(slideNum, key, ext, level, x, y) {
        const xTilesNum = Math.ceil(this.status.iipTileInfos.xTilesNumAtMaxLevel * this.status.iipTileInfos.levelScale[level]);
        const layerDispSettings = this.status.layerDisplaySettings[key];
        return (
            this.status.IIPSVR_PATH + key + "/"
            + slideNum + ext
            + (layerDispSettings.useIIProtocol && layerDispSettings.gammaEnabled ? ("&GAM=" + layerDispSettings.gamma) : "")
            + (layerDispSettings.useIIProtocol && layerDispSettings.contrastEnabled ? ("&CNT=" + layerDispSettings.contrast) : "")
            // + "&WID=" + this.status.iipTileInfos.tileWidth + "&HEI=" + this.status.iipTileInfos.tileHeight
            + "&JTL=" + (level ? level : "0") + "," + (y * xTilesNum + x)
        );
    }

    static getTileSourceDef(key, ext) {
        const currentPage = this.getPageNumForCurrentSlice();
        if (this.config.hasBackend) {
            const layerDispSettings = this.status.layerDisplaySettings[key];
            if (layerDispSettings.useIIProtocol) {
                return {
                    width: this.status.iipTileInfos.imageWidth,
                    height: this.status.iipTileInfos.imgeHeight,
                    tileWidth: this.status.iipTileInfos.tileWidth,
                    tileHeight: this.status.iipTileInfos.tileHeight,

                    overlap: 1,

                    maxLevel: this.status.iipTileInfos.maxLevel,
                    minLevel: this.status.iipTileInfos.minLevel,
                    getTileUrl: (level, x, y) => this.getIIPTileUrl(this.getPageNumForCurrentSlice(), key, ext, level, x, y)
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
        if (tracerLayer) {
            const newDilationSize = zoom > 2.5 ? 0 : zoom > 1.5 ? 3 : zoom > 0.3 ? 5 : 7;
            tracerLayer.autoDilation = newDilationSize;

            //change filters only if dilation kernel size changed
            if (newDilationSize != tracerLayer.dilation && !tracerLayer.manualEnhancing) {
                tracerLayer.dilation = newDilationSize;
                if (tracerLayer.enhanceSignal) {
                    this.setAllFilters();
                }
            }
        }
    }

    /** reset filters : the plugin API allows only to set all processors for all tiled images at once  */
    static setAllFilters() {

        const filters = [];
        let tracerNum = 0;
        Object.values(this.status.layerDisplaySettings).forEach((layer) => {
            const processors = [];

            if (layer.isTracer) {
                //change filters only if dilation kernel size changed
                if (layer.enhanceSignal && layer.dilation > 0) {
                    processors.push(OpenSeadragon.Filters.MORPHOLOGICAL_OPERATION(layer.dilation, Math.max));
                }
                processors.push(CustomFilters.INTENSITYALPHA(tracerNum));
                tracerNum++;

            } else {

                if (!layer.useIIProtocol) {
                    if (layer.contrastEnabled) {
                        processors.push(OpenSeadragon.Filters.CONTRAST(layer.contrast));
                    }
                    if (layer.gammaEnabled) {
                        processors.push(OpenSeadragon.Filters.GAMMA(layer.gamma));
                    }
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

    static resetTiledImageCache(layerid) {
        const layerIndex = Object.keys(this.status.layerDisplaySettings).findIndex(id => id === layerid);

        var tiledImage = this.viewer.world.getItemAt(layerIndex);
        var tiledImageSource = tiledImage.source;

        //Force update tiles's url for those already in viewer's tile matrix
        Object.entries(tiledImage.tilesMatrix).forEach(([level, levelTiles]) =>
            Object.entries(levelTiles).forEach(([x, xTiles]) =>
                Object.entries(xTiles).forEach(([y, tile]) => {
                    const newTileUrl = tiledImageSource.getTileUrl(parseInt(level), parseInt(x), parseInt(y));
                    if (tile.url !== newTileUrl) {
                        tile.exists = true;
                        tile.loaded = false;
                        //update tile url that otherwise would still use previous image adjustement param values
                        tile.url = newTileUrl;
                    }
                })
            )
        );

        //clears all of the current (cached) tiles and sets it to reload.
        tiledImage.reset();
    }

    static changeLayerContrast(layerid, enabled, contrast) {
        if (this.config.layers[layerid]) {
            const layerSettings = this.status.layerDisplaySettings[layerid];
            layerSettings.contrastEnabled = enabled;
            layerSettings.contrast = contrast;
            if (layerSettings.useIIProtocol) {
                this.resetTiledImageCache(layerid);
            } else {
                this.setAllFilters();
            }
            this.signalStatusChanged(this.status);
        }
    }

    static changeLayerGamma(layerid, enabled, gamma) {
        if (this.config.layers[layerid]) {
            const layerSettings = this.status.layerDisplaySettings[layerid];
            layerSettings.gammaEnabled = enabled;
            layerSettings.gamma = gamma;
            if (layerSettings.useIIProtocol) {
                this.resetTiledImageCache(layerid);
            } else {
                this.setAllFilters();
            }
            this.signalStatusChanged(this.status);
        }
    }

    static changeLayerDilation(layerid, enabled, manualEnhancing, dilation) {
        if (this.config.layers[layerid]) {
            const layerSettings = this.status.layerDisplaySettings[layerid];

            if (layerSettings.enhanceSignal != enabled) {
                if (!enabled) {
                    layerSettings.dilation = layerSettings.autoDilation;
                    layerSettings.manualEnhancing = false;
                }
                layerSettings.enhanceSignal = enabled;
            }

            //just enabled or disabled manual setting of dilation value
            else if (layerSettings.manualEnhancing != manualEnhancing) {
                //reset dilation to previous value in corresponding mode
                if (manualEnhancing) {
                    layerSettings.dilation = layerSettings.manualDilation;
                } else {
                    layerSettings.dilation = layerSettings.autoDilation;
                }
                layerSettings.manualEnhancing = manualEnhancing;
            }
            //just manually changed value of dilation
            else if (manualEnhancing) {
                //dilation kernel size must be an odd number
                layerSettings.manualDilation = dilation == 0 ? dilation : Math.floor(dilation / 2) * 2 + 1;
                layerSettings.dilation = layerSettings.manualDilation;
            }

            this.setAllFilters();
            this.signalStatusChanged(this.status);
        }
    }

    //--------------------------------------------------
    // position
    static resizeCanvas() {
        const posCanvas = document.getElementById('poscanvas');
        posCanvas.setAttribute('width', this.viewer.canvas.clientWidth);
        posCanvas.setAttribute('height', this.viewer.canvas.clientHeight);
        this.refreshCanvasContent();

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
        const posCanvas = document.getElementById('poscanvas');
        if (this.viewer.currentOverlays.length == 0 || posCanvas.style.display == "none") {
            return;
        }

        //prevent recording another point if a dragging gesture is occuring
        if (this.status.pointerdownpos.x > event.clientX + 5 || this.status.pointerdownpos.x < event.clientX - 5 ||
            this.status.pointerdownpos.y > event.clientY + 5 || this.status.pointerdownpos.y < event.clientY - 5) {
            return;
        }

        if (this.status.measureModeOn || this.status.clippingModeOn) {
            //already 2 points recorded, reset measuring line
            if (this.status.position[0].c == 2) {
                this.resetPositionview();
                this.viewer.drawer.clear();
                this.viewer.world.draw();
                this.refreshCanvasContent();
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

            //init second position with first one in order to draw initial clipbox 
            if (1 == this.status.position[0].c) {
                this.status.position[2].x = x;
                this.status.position[2].y = y;
            }
        }

        this.setPosition();

        // show canvas
        this.refreshCanvasContent();

        this.signalStatusChanged(this.status);
    };


    static refreshCanvasContent() {
        this.displayMeasureLine();
        this.displayClipBox();
    };

    /** Draw the measure line widgets on the position canvas */
    static displayMeasureLine() {
        if (this.viewer.currentOverlays[0] == null) { return; }
        if (!this.config.matrix) { return; }
        const posCanvas = document.getElementById('poscanvas');
        if (this.status.ctx == null && posCanvas) {
            this.status.ctx = posCanvas.getContext('2d');
        }

        var orig = this.viewer.viewport.pixelFromPoint(new OpenSeadragon.Point(0, 0), true);
        var rect = this.viewer.canvas.getBoundingClientRect();

        var zoom = this.viewer.viewport.getZoom(true) * (this.viewer.canvas.clientWidth / this.config.imageSize);
        var x = (this.status.position[0].x - orig.x - rect.left) / zoom;
        var y = (this.status.position[0].y - orig.y - rect.top) / zoom;

        this.status.livePosition = this.getPoint(x, y);
        this.signalStatusChanged(this.status);
        if (!this.status.measureModeOn) { return; }

        this.status.ctx.clearRect(0, 0, posCanvas.width, posCanvas.height);

        // distance line
        if (this.status.position[0].c == 2) {
            var px1 = Math.round((this.status.position[1].x * zoom) + orig.x + 0.5) - 0.5;
            var py1 = Math.round((this.status.position[1].y * zoom) + orig.y + 0.5) - 0.5;
            var px2 = Math.round((this.status.position[2].x * zoom) + orig.x + 0.5) - 0.5;
            var py2 = Math.round((this.status.position[2].y * zoom) + orig.y + 0.5) - 0.5;
            this.status.ctx.beginPath();
            this.status.ctx.setLineDash([]);
            this.status.ctx.lineWidth = 2;
            this.status.ctx.lineCap = "butt";
            this.status.ctx.strokeStyle = "#888";
            this.status.ctx.moveTo(px1, py1);
            this.status.ctx.lineTo(px2, py2);
            this.status.ctx.stroke();
        }
        // cross
        if (this.status.position[0].c != 0) {
            this.status.ctx.beginPath();
            this.status.ctx.setLineDash([]);
            this.status.ctx.lineWidth = 1;
            this.status.ctx.lineCap = "butt";
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
        this.status.processedImage = null;
        this.signalStatusChanged(this.status);
    }


    static claerPosition() {
        this.status.position[0].c = 2;
        this.resetPositionview();
        this.viewer.drawer.clear();
        this.viewer.world.draw();
        this.refreshCanvasContent();
        return;
    }

    static setPosition() {
        if (this.config.matrix) {
            this.status.markedPos = [this.getPointXY(this.status.position[1].x, this.status.position[1].y), this.getPointXY(this.status.position[2].x, this.status.position[2].y)];
        }
        this.signalStatusChanged(this.status);
    }

    static setMeasureMode(active) {
        this.claerPosition();
        if (active) {
            //measurement mode and display of regions are mutually exclusive
            this.hideRegions();
            this.status.clippingModeOn = false;
        }
        this.status.measureModeOn = active;
        const posCanvas = document.getElementById('poscanvas');
        if (this.status.measureModeOn) {
            posCanvas.style.display = "block";
        } else {
            posCanvas.style.display = "none";
        }
        this.signalStatusChanged(this.status);
    }

    static isMeasureModeOn() {
        return this.status && this.status.measureModeOn;
    }

    static displayClipBox() {
        if (this.viewer.currentOverlays[0] == null) { return; }
        if (!this.status.clippingModeOn) { return; }
        const posCanvas = document.getElementById('poscanvas');
        if (this.status.ctx == null) {
            this.status.ctx = posCanvas.getContext('2d');
        }

        this.status.ctx.clearRect(0, 0, posCanvas.width, posCanvas.height);

        //clip box
        if (this.status.position[0].c != 0) {
            const orig = this.viewer.viewport.pixelFromPoint(new OpenSeadragon.Point(0, 0), true);
            const zoom = this.viewer.viewport.getZoom(true) * (this.viewer.canvas.clientWidth / this.config.imageSize);

            const px1 = Math.round((this.status.position[1].x * zoom) + orig.x + 0.5) - 0.5;
            const py1 = Math.round((this.status.position[1].y * zoom) + orig.y + 0.5) - 0.5;

            const px2 = Math.round((this.status.position[2].x * zoom) + orig.x + 0.5) - 0.5;
            const py2 = Math.round((this.status.position[2].y * zoom) + orig.y + 0.5) - 0.5;

            const lx = Math.min(px1, px2)
            const rx = Math.max(px1, px2)
            const ty = Math.min(py1, py2)
            const by = Math.max(py1, py2)

            const vlx = Math.max(0, lx);
            const vrx = Math.min(rx, this.viewer.canvas.clientWidth);
            const vty = Math.max(0, ty);
            const vby = Math.min(by, this.viewer.canvas.clientHeight);

            let clipWidth = rx - lx;
            let clipHeight = by - ty;

            this.status.ctx.beginPath();
            this.status.ctx.strokeStyle = "#00ffff";
            this.status.ctx.lineCap = "butt";
            if (this.status.position[0].c == 2) {
                this.status.ctx.setLineDash([]);
                this.status.ctx.lineWidth = 1;

                if (!this.status.processedImage) {
                    this.status.ctx.strokeStyle = "#0000ff";
                } else {

                    //override clip dimension by actually computed result (scaled to current zoom factor)
                    const sf = this.getZoomFactor() / this.status.processedZoom;
                    clipWidth = Math.round(this.status.processedImage.width * sf);
                    clipHeight = Math.round(this.status.processedImage.height * sf);

                    if (this.drawProcessingResult(lx, ty, clipWidth, clipHeight)) {
                        //image computed at that zoom factor: green border 
                        this.status.ctx.strokeStyle = "#00ff00";
                    } else {
                        //magenta border to warn user that it was computed at different zoom
                        this.status.ctx.strokeStyle = "#ff00ef";
                    }
                }

                this.status.clippedRegion = [lx, ty, clipWidth, clipHeight]
            } else {
                this.status.ctx.setLineDash([1, 5]);
                this.status.ctx.lineWidth = 3;
            }

            const selectedProc = this.getSelectedProcessor();
            const clipSizeConstraints = selectedProc && selectedProc.inputSize ? selectedProc.inputSize : null;
            const constraintType = clipSizeConstraints ? (clipSizeConstraints.constraint ? clipSizeConstraints.constraint : "none") : null;

            //extra right-bottom space of the clipped area that won't be used for actual processing 
            let extraWidth = 0;
            let extraHeight = 0;

            //take into account size constraints, unless processings already done
            if (constraintType && !this.status.processedImage) {
                if (constraintType == "fixed") {
                    extraWidth = clipSizeConstraints.width ? ((clipWidth - clipSizeConstraints.width) >= 0 ? (clipWidth - clipSizeConstraints.width) : clipWidth) : 0;
                    extraHeight = clipSizeConstraints.height ? ((clipHeight - clipSizeConstraints.height) >= 0 ? (clipHeight - clipSizeConstraints.height) : clipHeight) : 0;
                } else if (constraintType == "ratio") {
                    // keep constant width/height ratio 
                    const multW = clipSizeConstraints.width ? Math.floor(clipWidth / clipSizeConstraints.width) : Infinity;
                    const multH = clipSizeConstraints.height ? Math.floor(clipHeight / clipSizeConstraints.height) : Infinity;
                    const mult = Math.min(multW, multH);
                    if (mult == Infinity) {
                        extraWidth = clipWidth;
                        extraHeight = clipHeight;
                    } else {
                        extraWidth = clipWidth - clipSizeConstraints.width * mult;
                        extraHeight = clipHeight - clipSizeConstraints.height * mult;
                    }
                } else {
                    // no constraint other than using multiple of specified width & height
                    extraWidth = clipSizeConstraints.width ? (clipWidth % clipSizeConstraints.width) : 0;
                    extraHeight = clipSizeConstraints.height ? (clipHeight % clipSizeConstraints.height) : 0;
                }
            }

            //constrained clip is the one who will be processed
            const constrainedClipWidth = clipWidth - extraWidth;
            const constrainedClipHeight = clipHeight - extraHeight;
            this.status.constrainedClippedRegion = [lx, ty, constrainedClipWidth, constrainedClipHeight]

            //constrained clip border
            this.status.ctx.moveTo(lx, ty);
            this.status.ctx.lineTo(lx, ty + constrainedClipHeight);
            this.status.ctx.lineTo(lx + constrainedClipWidth, ty + constrainedClipHeight);
            this.status.ctx.lineTo(lx + constrainedClipWidth, ty);
            this.status.ctx.lineTo(lx, ty);
            this.status.ctx.stroke();


            //border of the extra space
            this.status.ctx.beginPath();
            this.status.ctx.strokeStyle = "#ffff0066";
            this.status.ctx.lineWidth = 3;
            this.status.ctx.setLineDash([1, 2]);
            if (extraHeight) {
                //part at the bottom of constrained clip
                this.status.ctx.moveTo(lx, ty + constrainedClipHeight);
                this.status.ctx.lineTo(lx, by);
                this.status.ctx.lineTo(lx + constrainedClipWidth, by);
            } else {
                this.status.ctx.moveTo(lx + constrainedClipWidth, by);
            }
            if (extraHeight || extraWidth) {
                //bottom-right corner
                this.status.ctx.lineTo(rx, by);
                this.status.ctx.lineTo(rx, ty + constrainedClipHeight);
            }
            if (extraWidth) {
                //part at the right of constrained clip
                this.status.ctx.lineTo(rx, ty);
                this.status.ctx.lineTo(lx + constrainedClipWidth, ty);
            }
            this.status.ctx.stroke();

            //inner grid 
            if (!this.status.processedImage) {

                const blockSize = 64;
                this.status.ctx.beginPath();
                this.status.ctx.strokeStyle = "#ffffff66";
                this.status.ctx.setLineDash([1, 7]);
                this.status.ctx.lineWidth = 3;
                this.status.ctx.lineCap = "round";
                for (var offX = blockSize; offX < constrainedClipWidth; offX += blockSize) {
                    this.status.ctx.moveTo(lx + offX, ty);
                    this.status.ctx.lineTo(lx + offX, ty + constrainedClipHeight);
                }
                for (var offY = blockSize; offY < constrainedClipHeight; offY += blockSize) {
                    this.status.ctx.moveTo(lx, ty + offY);
                    this.status.ctx.lineTo(lx + constrainedClipWidth, ty + offY);
                }
                this.status.ctx.stroke();
            }


            //if clipbox spans outside the viewport, display some warning red lines to show where it is cropped
            this.status.ctx.beginPath();
            this.status.ctx.strokeStyle = "#ff0000";
            this.status.ctx.setLineDash([1, 2]);
            this.status.ctx.lineWidth = 5;
            this.status.ctx.lineCap = "butt";

            if (vty != ty) {
                //top border
                this.status.ctx.moveTo(vlx, vty);
                this.status.ctx.lineTo(vrx, vty);
                this.status.ctx.stroke();
            }
            if (vlx != lx) {
                //left border
                this.status.ctx.moveTo(vlx, vty);
                this.status.ctx.lineTo(vlx, vby);
                this.status.ctx.stroke();
            }
            if (vby != by) {
                //bottom border
                this.status.ctx.moveTo(vlx, vby);
                this.status.ctx.lineTo(vrx, vby);
                this.status.ctx.stroke();
            }
            if (vrx != rx) {
                //right border

                //right panel might be covering OSD canvas, so warning line should be drawn at the panel limit
                const rightPanelWidth = document.getElementById("ZAV-rightPanel").getBoundingClientRect().width;
                this.status.ctx.moveTo(vrx - rightPanelWidth, vty);
                this.status.ctx.lineTo(vrx - rightPanelWidth, vby);
                this.status.ctx.stroke();
            }

            this.status.ctx.setLineDash([]);
        }

    };

    static drawProcessingResult(clipOrigX, clipOrigY, clipWidth, clipHeight) {
        //if the result of previous processing is still available, display it on top of layers
        if (this.status.processedImage) {

            const sf = this.getZoomFactor() / this.status.processedZoom;
            const deltaSF = 1 - sf;
            const needScaling = Math.abs(deltaSF) > Number.EPSILON;
            if (needScaling) {
                //image was computed at different scale factor, so it needs to be scaled
                this.status.ctx.translate(deltaSF * clipOrigX, deltaSF * clipOrigY);
                this.status.ctx.scale(sf, sf);
            }
            //draw computed image on top of layers
            this.status.ctx.drawImage(this.status.processedImage, clipOrigX, clipOrigY);

            if (needScaling) {
                this.status.ctx.resetTransform();
            }
            return !needScaling;
        }
    }

    static setSelectClip(active) {
        this.claerPosition();
        this.status.processedImage = null;
        if (active) {
            //this.viewer.zoomPerScroll =1;
            this.hideRegions();
            this.status.measureModeOn = false;
        }
        this.status.clippingModeOn = active;
        const posCanvas = document.getElementById('poscanvas');
        if (active) {
            posCanvas.style.display = "block";
        } else {
            posCanvas.style.display = "none";
        }
        this.signalStatusChanged(this.status);
    }

    static isSelectClipModeOn() {
        return this.status && this.status.clippingModeOn;
    }

    static isClipSelected() {
        return this.status && this.status.clippingModeOn && this.status.position[0].c == 2;
    }

    static isZoomEnabled() {
        return this.viewer && 1.0 != this.viewer.zoomPerScroll;
    }

    static setZoomEnabled(active) {
        if (active) {
            this.viewer.zoomPerScroll = this.status.prevZoomPerScroll;
            this.viewer.zoomPerClick = this.status.prevZoomPerClick;
        } else {
            this.status.prevZoomPerScroll = this.viewer.zoomPerScroll;
            this.viewer.zoomPerScroll = 1.0;
            this.status.prevZoomPerClick = this.viewer.zoomPerClick;
            this.viewer.zoomPerClick = 1.0;
        }
        this.signalStatusChanged(this.status);
    }

    static getZoomFactor() {
        return (
            this.viewer && this.viewer.world.getItemCount()
                ? (100 * this.viewer.world.getItemAt(0).viewportToImageZoom(this.viewer.viewport.getZoom(true))).toFixed(3)
                : 0
        );
    }

    static setZoomFactor(zf) {
        if (this.viewer) {
            const animDuration = this.viewer.zoomPerSecond;
            this.viewer.zoomPerSecond = 0.1;
            const viewportZoom = this.viewer.viewport.imageToViewportZoom(zf / 100);
            this.viewer.viewport.zoomTo(viewportZoom, null, true);
            this.viewer.zoomPerSecond = animDuration;
        }
    }

    static goHome() {
        if (this.viewer) {
            this.viewer.viewport.goHome(false);
        }
    }

    static hasProcessingsModule() {
        return typeof globalThis.ZAVProcessings != "undefined";
    }

    static hasProcessors() {
        return this.hasProcessingsModule() && globalThis.ZAVProcessings.nbProcessors();
    }

    static getProcessors() {
        return (
            this.hasProcessingsModule()
                ? globalThis.ZAVProcessings.getProcessors()
                : []
        )
    }

    static getProcessor(procIndex) {
        if (this.hasProcessingsModule()) {
            const procs = globalThis.ZAVProcessings.getProcessors();
            return (procIndex < procs.length) ? procs[procIndex] : null;
        } else {
            return null;
        }
    }

    static setSelectedProcessorIndex(procIndex) {
        const nbProcessors = this.hasProcessingsModule() ? globalThis.ZAVProcessings.nbProcessors() : 0;
        if (procIndex < nbProcessors) {
            if (this.status.selectedprocIndex != procIndex) {
                this.status.selectedprocIndex = procIndex
                //reset previous result and its associated clip box if any 
                if (this.status.processedImage) {
                    this.resetPositionview();
                }
                this.displayClipBox();
            }
        }
    }

    static getSelectedProcessorIndex() {
        if (this.hasProcessors() && this.status) {
            if (typeof this.status.selectedprocIndex == "undefined") {
                this.status.selectedprocIndex = 0;
            }
            return this.status.selectedprocIndex;
        } else {
            return -1;
        }
    }

    static getSelectedProcessor() {
        const procIndex = this.getSelectedProcessorIndex();
        if (procIndex >= 0) {
            return this.getProcessor(procIndex);
        } else {
            return null;
        }
    }

    static getProcessedImage() {
        return this.status && this.status.processedImage;
    }

    static isProcessingActive() {
        return this.status && this.status.processingActive;
    }

    static performProcessing(procIndex) {
        if (this.isClipSelected()) {
            this.getProcessors()
            const proc = this.getProcessor(procIndex);
            if (proc) {
                console.debug('Computing "' + proc.name + '"');

                //store zoom factor of the image about to be processed
                this.status.processedZoom = this.getZoomFactor();
                this.status.processedRegion = this.status.constrainedClippedRegion;
                this.status.processedImage = null;
                this.status.processedTopleftPx = null;

                //retrieve image data for custom processing
                const tilescanvas = this.viewer.drawer.canvas;
                const ctx = tilescanvas.getContext('2d');

                //routine to perform processing on specified imageData
                const startProcessor = (imageData) => {
                    console.debug(`start processor "${proc.name}" on ${imageData.width} x ${imageData.height} pixels`);

                    //perform actual computation
                    this.status.processingActive = true;
                    this.status.longRunningMessage = "Performing custom processing...";
                    this.signalStatusChanged(this.status);

                    try {
                        proc.processImageData(imageData)
                            .then((processedImageData) => {
                                //if result is already an image, no conversion necessary
                                if (Image.prototype.isPrototypeOf(processedImageData)) {
                                    return processedImageData;
                                } else {
                                    //convert computed result as image object
                                    return this.imageDataToImage(processedImageData)
                                }
                            })
                            .then((imageObj) => {
                                imageObj.name = proc.name 
                                    //info to identify processed image clip (top-left pixel coords in orginal image and zoom value)
                                    + `-${this.status.processedTopleftPx[0]},${this.status.processedTopleftPx[1]}@${Math.round(this.status.processedZoom*100)/100.0}-`
                                    + new Date().toISOString().slice(0, 19).replaceAll(/[:\-]/g, '');
                                this.status.processedImage = imageObj;
                                this.displayClipBox();
                            })
                            .catch((error) => {
                                console.error(error);
                                alert("An error occured:\n" + error);
                                this.signalStatusChanged(this.status);
                            })
                            .finally(() => {
                                this.status.processingActive = false;
                                this.status.longRunningMessage = null;
                                this.signalStatusChanged(this.status);
                            });
                    } catch (e) {
                        alert("An error occured:\n" + e);
                        this.status.processingActive = false;
                        this.status.longRunningMessage = null;
                        this.signalStatusChanged(this.status);
                    }
                };

                //collect info to check if part of the clipped region is outside of the screen
                const bounds = this.viewer.viewport.getBounds(true);
                const vpCoord1 = this.viewer.viewport.imageToViewportCoordinates(this.status.position[1].x, this.status.position[1].y);
                const vpCoord2 = this.viewer.viewport.imageToViewportCoordinates(this.status.position[2].x, this.status.position[2].y);
                const vlx = Math.min(vpCoord1.x, vpCoord2.x)
                const vrx = Math.max(vpCoord1.x, vpCoord2.x)
                const vty = Math.min(vpCoord1.y, vpCoord2.y)
                const vby = Math.max(vpCoord1.y, vpCoord2.y)

                const [lx, ty, w, h] = this.status.processedRegion;

                this.status.processedTopleftPx = [Math.round(this.config.imageSize * vlx) , Math.round(this.config.imageSize * vty)];

                if (vlx >= bounds.x && vty >= bounds.y && vrx <= (bounds.x + bounds.width) && vby <= (bounds.y + bounds.height)) {
                    //clipped regions within viewport boundaries, complete clipped region imageData is available
                    const imageData = ctx.getImageData(lx, ty, w, h);
                    startProcessor(imageData);
                } else {
                    //part of the clip is outside of the screen, necessary to pan the viewport to retreive complete imageData 

                    {
                        //compute the panning moves (in row-major order) necessary to cover the clipped region at the current zoom level 
                        const panMoves = [];
                        const halfWidth = bounds.width / 2;
                        const halfHeight = bounds.height / 2;
                        let row = 0;
                        for (let panY = vty; panY < vby; panY += bounds.height, row++) {
                            let col = 0;
                            for (let panX = vlx; panX < vrx; panX += bounds.width, col++) {
                                panMoves.push(
                                    {
                                        col: col,
                                        row: row,
                                        lastRow: (panY + bounds.height) >= vby,
                                        lastCol: (panX + bounds.width) >= vrx,
                                        point: new OpenSeadragon.Point(panX + halfWidth, panY + halfHeight)
                                    }
                                );
                            }
                        }
                        const nbParts = panMoves.length;

                        //dimension of imageData that can be collect at once
                        const canvasWidth = tilescanvas.clientWidth;
                        const canvasHeight = tilescanvas.clientHeight;

                        //return a promise which collect image data 
                        const getDeferedCollectImageDataPromise = (imageDataArray, panMove) => {

                            const collectImageData = () => {
                                //collect only the necessary part of the canvas where the viewport is currently panned
                                const partWidth = panMove.lastCol ? (w - panMove.col * canvasWidth) : canvasWidth;
                                const partHeight = panMove.lastRow ? (h - panMove.row * canvasHeight) : canvasHeight;
                                const imageData = ctx.getImageData(0, 0, partWidth, partHeight);
                                imageDataArray.push({
                                    data: imageData,
                                    col: panMove.col,
                                    row: panMove.row,
                                });
                                return imageDataArray;
                            };

                            return new Promise(
                                //resolution deferred to give exta time to browser to finish drawing canvas...
                                (resolve) => setTimeout(() => resolve(collectImageData()), 200)
                            );
                        };

                        const that = this;
                        //return a promise chain which trigger next pan move and image data collection
                        const getNextPanPromise = (imageDataArray) => new Promise((resolve, reject) => {
                            //while there is panning moves left
                            if (panMoves.length) {
                                const panMove = panMoves.shift();
                                this.status.longRunningMessage = `Collecting data... (${nbParts - panMoves.length}/${nbParts})`;

                                //Since image loading and drawing is asynchrously handled by OSD, 
                                //we rely on OSD events to detect when the promise can be resolved

                                //event handler to detect when panning has been performed
                                this.viewer.addOnceHandler('pan', (pannedEvent) => {

                                    let resolveDeferred = false;

                                    //attach a single event handler on the first visible layer not fully loaded 
                                    for (var i = 0; i < that.viewer.world.getItemCount() && !resolveDeferred; i++) {
                                        const tiledImage = that.viewer.world.getItemAt(i);
                                        const layer = _.findWhere(that.status.layerDisplaySettings, { index: i });

                                        if (layer && layer.enabled) {
                                            //check if image is already fully loaded
                                            if (!tiledImage.getFullyLoaded()) {

                                                //event handler to detect when all tiled images have been fully loaded (for current viewport)
                                                that.eventSource.addOnceHandler(
                                                    'zav-alllayers-loaded',
                                                    (event) => {
                                                        resolve(
                                                            getDeferedCollectImageDataPromise(imageDataArray, panMove)
                                                                .then((imgDtaArr) => getNextPanPromise(imgDtaArr))
                                                        );
                                                    }
                                                );
                                                // one single event handler is enough
                                                resolveDeferred = true;
                                            }
                                        }
                                    }

                                    //if no handler was added, it means all tiles are fully loaded at this point
                                    if (!resolveDeferred) {
                                        resolve(
                                            getDeferedCollectImageDataPromise(imageDataArray, panMove)
                                                .then((imgDtaArr) => getNextPanPromise(imgDtaArr))
                                        );
                                    }

                                });

                                // trigger next Panning 
                                this.viewer.viewport.panTo(panMove.point, true);
                            } else {
                                //console.debug("Resolving Last PanPromise");
                                resolve(imageDataArray);
                            }

                        });

                        //create (and execute) Panning and collection Promises chain
                        this.status.longRunningMessage = "Collecting data...";
                        this.signalStatusChanged(this.status);

                        getNextPanPromise([])
                            .then(
                                // create full ImageData by joining collected ImageData parts
                                (imageDataArray) => {
                                    this.status.longRunningMessage = "Aggregating data...";

                                    const fullImgDataSizeByte = w * h * 4;
                                    console.debug(`allocating ${fullImgDataSizeByte} bytes`)
                                    const joinedImgDataPx = new Uint8ClampedArray(fullImgDataSizeByte);
                                    imageDataArray.forEach(
                                        (imageDataInfo, index) => {
                                            const partImgData = imageDataInfo.data;
                                            for (let x = 0; x < partImgData.width; x++) {
                                                for (let y = 0; y < partImgData.height; y++) {
                                                    for (let c = 0; c < 4; c += 1) {
                                                        //vertical pixel offset, filled by parts in above rows
                                                        const vOffset = imageDataInfo.row * canvasHeight * w;
                                                        //horizontal pixel offset, filled by parts in left cols
                                                        const hOffset = imageDataInfo.col * canvasWidth;
                                                        //current line pixel offset for full image
                                                        const fullImgLineOffset = y * w;
                                                        //current line pixel offset for part image
                                                        const partImgLineOffset = y * partImgData.width;

                                                        joinedImgDataPx[(vOffset + hOffset + fullImgLineOffset + x) * 4 + c] =
                                                            partImgData.data[(partImgLineOffset + x) * 4 + c];
                                                    }
                                                }
                                            }
                                        }
                                    );
                                    //clear imageData parts
                                    imageDataArray.length = 0;

                                    const joinedImageData = new ImageData(joinedImgDataPx, w, h);
                                    return joinedImageData;
                                }
                            )
                            .then(
                                (joinedImageData) => {
                                    //pan back to original position
                                    this.viewer.viewport.fitBounds(bounds);
                                    return joinedImageData;
                                }
                            )
                            .then(
                                //launch custom processing
                                (joinedImageData) => startProcessor(joinedImageData)
                            )
                            .catch((error) => {
                                console.error("Error while processing:", error);

                                this.status.longRunningMessage = error;
                                this.signalStatusChanged(this.status);
                                setTimeout(() => {
                                    this.status.longRunningMessage = error;
                                    this.signalStatusChanged(this.status);
                                }, 1500);
                            });
                    }

                }

            }
        }
    };

    static imageDataToImage(imageData) {
        return globalThis.ZAVProcessings.imageDataToImage(imageData);
    };

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
        //omitted param: expanded right panel, region selection 
        Utils.pushHistoryStep(this.history, stepParams, ['px', 'rs']);
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
        if (confFromPath.mode && confFromPath.mode === 'edit') {
            confParams.editMode = true;
        }
        //transient param: open UI with right panel expanded
        if (confFromPath.px && confFromPath.px === '1') {
            confParams.initPanelExpanded = true;
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
        if (typeof params.sliceNum !== "undefined" && params.sliceNum != this.getPlaneChosenSlice(targetPlane)) {
            let targetSlice = params.sliceNum;
            //update active slice    
            targetSlice = this.checkNSetChosenSlice(targetPlane, targetSlice);
        }
        if (params.activePlane) {
            //change active plane and page
            this.switchPlane(targetPlane);
        } else if (typeof params.sliceNum !== "undefined") {
            this.viewer.goToPage(this.getPageNumForCurrentSlice());
        }

        this.status.editModeOn = params.editMode === true;
        if (params.editMode === true) {
            this.setBorderDisplay(true);
        }
        this.status.initExpanded = params.initPanelExpanded;
    }
}

export default ViewerManager;
