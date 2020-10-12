import _ from 'underscore';

import paper from 'paper';
import Color from 'color';

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

            /** info about region currently hovered by mouse cursor */
            hoveredRegion: null,
            hoveredRegionSide: null,

            /** (reusable) mouse event listeners for region contained in the current slice */
            regionEventListeners: {},

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

            /** set to true when measuring tool is activated  */
            measureModeOn: false,


            /** set to true when region editing mode is enabled */
            editModeOn: false,
            /** set to true when a region is being edited */
            editingActive: false,
            /** current editing tool */
            editingTool: 'pen',
            /** current editing tool radius */
            editingToolRadius: 60,

            /** ID of the region being edited */
            editRegionId: undefined,
            /** source path element to be edited (in the region overlay) */
            editRegion: undefined,
            /** root SVG element containing region being edited */
            editSVG: undefined,
            /** color of the edited region */
            editRegionColor: undefined,
            /** path element representing the region being edited */
            editLivePath: undefined,
            /** last recorder position of cursor during region editing*/
            editPos: undefined,

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
            //Reference 1): http://chrishewett.com/blog/openseadragon-svg-overlays/
            if (that.config.svgFolerName != "") {
                //load region delineations in the dedicated overlay
                if (event.element.id === 'svgDelineationOverlay') {
                    const sliceNum = that.getCurrentPlaneChosenSlice();

                    const svgPath = Utils.makePath(
                        that.config.PUBLISH_PATH, that.config.svgFolerName,
                        (that.config.hasMultiPlanes ? ZAVConfig.getPlaneLabel(that.status.activePlane) : null),
                        "Anno_" + sliceNum + ".svg"
                    );

                    that.addSVGData(svgPath, event.element);
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


            $.each(that.config.layers, function (key, value) {
                if (value.index != 0) {
                    that.addLayer(key, value.name, value.ext);
                } else {
                    that.setLayerOpacity(key);
                }
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
                { tracker: 'viewer', handler: 'clickHandler', hookHandler: this.onViewerClick },
                { tracker: 'viewer', handler: 'dragHandler', hookHandler: this.onViewerDrag.bind(this) },
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
    //create SVG element where all editing related drawing is performed  
    static createEditSVGElement() {
        if (this.status.editModeOn) {
            const editOverlay = document.getElementById('svgEditOverlay');
            const regionSVG = document.getElementById('svgDelineationOverlay').getElementsByTagName('svg')[0];

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
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
                    if (this.status.editRegionId) {
                        this.stopEdit(event);
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
        const color = Color(this.status.editRegionColor);
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
 xmlns="http://www.w3.org/2000/svg" 
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
        if (this.status.editRegionId) {
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

    static selectEditRegion(e) {
        //
        const targetElt = e.target;
        this.status.editRegionId = targetElt.id;
        this.status.editRegion = targetElt;
        this.status.editRegionColor = targetElt.getAttribute("fill");

        const editGroup = this.status.editSVG.getElementById('svgEditGroup');
        //copy region svg as a base for edit 
        const newLivPath = targetElt.cloneNode();
        newLivPath.id = "beingEditedRegion";

        //insert in DOM
        editGroup.appendChild(newLivPath);
        newLivPath.setAttribute("stroke", Color(this.status.editRegionColor).negate());
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

    static startEdit(e) {
        this.status.editingActive = true;
        this.status.editPos = this.status.lastPos;
        this.doEdit(e, true);
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

    static stopEdit() {
        this.status.editingActive = false;
        if (this.status.editRegionId) {

            //restore region overlay above edition
            const editOverlay = document.getElementById('svgEditOverlay');
            editOverlay.style.zIndex = 0;

            this.removeEditCursor();
            this.status.editRegionId = null;


            //replace exisiting region by edited one

            //remove un-edited source region from Raphaël set
            this.status.set.exclude(this.status.editRegion);
            const regionId = this.status.editRegion.id;
            //remove from DOM
            this.status.editRegion.remove();

            //import edited region in Raphaël  
            const modifiedRegion = this.status.editRegionPath.exportSVG();
            modifiedRegion.setAttribute('id', regionId);

            //FIXME region order is not conserved, Raphaël will place the newly imported region at the end 
            const newRaphElt = this.status.paper.importSVG(modifiedRegion);
            this.status.set.push(newRaphElt);

            //once path is added to DOM, restore non-scaling strocke attribute
            document.getElementById(regionId).setAttribute("vector-effect", "non-scaling-stroke");

            //reuse region event listener
            this.connectRegionListeners(newRaphElt, this.status.regionEventListeners[regionId]);
            this.applyUnselectedPresentation(newRaphElt);

            this.status.editLivePath.remove();

            this.status.editLivePath = null;
            this.status.editPos = null;
            this.status.editRegion = null;

            this.signalStatusChanged(this.status);
        }
    }

    static simplifyEditedRegion() {
        if (this.status.editRegionId) {

            if (this.status.editRegionPath.simplify()) {
                const newLivPath = this.status.editRegionPath.exportSVG();

                this.status.editLivePath.replaceWith(newLivPath);
                this.status.editLivePath = newLivPath;
            }
        }
    }

    static extendRegionListenerForEdit(listener) {
        listener.dblclick = (e) => {
            if (this.status.editRegionId) {
                this.stopEdit(e);
            } else {
                this.selectEditRegion(e);
            }
        };
        return listener;
    }

    static connectRegionListeners(newPathElt, regionListener) {
        newPathElt.mouseover(function (e) { regionListener.mouseover(e, this); });
        newPathElt.mouseout(function (e) { regionListener.mouseout(e, this); });
        newPathElt.click(function (e) { regionListener.click(e, this); });
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
        //load from a file
        var strReturn = "";
        this.status.currentSVGName = svgName;
        console.log("svg " + svgName);

        //Create SVG element dedecated to edition
        this.createEditSVGElement();

        const that = this;

        //load SVG
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
                    //new set of mouse event listeners 
                    that.status.regionEventListeners = {};

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

                            //Create Background path in the SVG dedicated to edition
                            that.createEditSVGBackground(paths[i]);

                        } else {
                            newPathElt.id = pathId;
                            //extract region abbreviation from path id
                            const suffix = rawId.substring(rawId.length - 2);
                            const side = (suffix === "_L") ? "(left)" : (suffix === "_R") ? "(right)" : "";
                            const abbrev = side ? rawId.substring(0, rawId.length - 2) : rawId;

                            that.status.currentSliceRegions.set(pathId, abbrev);

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
                                            } else {
                                                that.regionActionner.addToSelection(abbrev);
                                            }
                                        } else {
                                            that.regionActionner.replaceSelected(abbrev);
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
                            that.applyUnselectedPresentation(newPathElt);
                        }

                        that.status.set.push(newPathElt);
                    }

                    //once path elements are added to the DOM
                    for (let p of overlayElement.getElementsByTagName('svg')[0].getElementsByTagName('path')) {
                        //make path's stroke width independant of scaling transformations 
                        p.setAttribute("vector-effect", "non-scaling-stroke");
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

            if (this.status.editModeOn) {
                //scale edition overlay
                const editGroup = document.getElementById('svgEditGroup');
                editGroup.setAttribute('transform', ' scale(' + zoom + ',' + zoom + ') translate(0,' + this.config.dzDiff + ')');
                this.updateEditCursor();
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

    static onViewerDrag(event) {
        // Disable panning on the viewer when a region is selected for edition
        if (this.status.editModeOn && this.status.editRegionId) {
            event.preventDefaultAction = true;
        }
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
        if (confFromPath.mode && confFromPath.mode === 'edit') {
            confParams.editMode = true;
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
        this.status.editModeOn = params.editMode === true;
        if (params.editMode === true) {
            this.setBorderDisplay(true);
        }
    }
}

export default ViewerManager;
