import _ from 'underscore';

import RegionsManager from './RegionsManager.js'

import CustomFilters from './CustomFilters.js';

export const VIEWER_ID = "openseadragon1";
export const NAVIGATOR_ID = "navigatorDiv";
export const AXIAL = 0;
export const CORONAL = 1;
export const SAGITTAL = 2;

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
        /** viewer specific event bus */
        this.eventSource = new OpenSeadragon.EventSource();
        const that = this;

        //layers initial display values
        const initLayerDisplaySettings = {};
        var i = 0;
        $.each(that.config.data, function (key, value) {
            initLayerDisplaySettings[key] = {
                key: key,
                enabled: true,
                opacity: parseInt(value.opacity),
                name: value.metadata,
                index: i++,
                //FIXME should use another method than name to identify tracer signal layer
                isTracer: value.metadata.includes("nn_tracer")
            };
        });

        /** dynamic state of the viewer */
        this.status = {

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

            currentAxis: this.CORONAL,

            /** currently selected coronal slice */
            coronalChosenSlice: this.config.initialSlice,

            measureModeOn: false,
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


        //--------------------------------------------------
        /** quickfix: ensure that whole image is visible at startup */
        this.viewer.addOnceHandler('open', function () {
            const containerSize = that.viewer.viewport.getContainerSize();
            //FIXME id is a  constant
            const rightPanelWidth = document.getElementById("ZAV-rightPanel").getBoundingClientRect().width;

            const coveredPart = rightPanelWidth / containerSize.x;
            const uncoveredBounds = new OpenSeadragon.Rect(0, 0, 1 + coveredPart + 0.05, 1);
            that.viewer.viewport.fitBounds(uncoveredBounds);
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

                                //restore opacity once it is fully loaded
                                that.setLayerOpacity(layer.key);
                                // apply filter
                                that.viewer.setFilterOptions({
                                    filters: [{
                                        items: tiledImage,
                                        processors: [
                                            CustomFilters.INTENSITYALPHA()
                                        ]
                                    }]
                                });
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
    static goToSlice(axis, chosenSlice, regionsToCenterOn) {
        //TODO use axis 
        if (this.status.coronalChosenSlice != chosenSlice) {
            if (chosenSlice > (this.config.coronalSlideCount - 1)) {
                chosenSlice = this.config.coronalSlideCount - 1;
            } else if (chosenSlice < 0) {
                chosenSlice = 0;
            }
            this.status.coronalChosenSlice = chosenSlice;
            //asynchronous focus the view on specified regions of interest 
            if (regionsToCenterOn) {
                const that = this;
                this.eventSource.addOnceHandler('zav-regions-created', (event) => {
                    that.centerOnRegions(regionsToCenterOn);
                });
            }
            this.viewer.goToPage(this.config.coronalFirstIndex + this.status.coronalChosenSlice);
            this.signalStatusChanged(this.status);
        }
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


    static addLayer(key, name, ext) {
        
        //load tracer signal layer with opacity set to 0 to avoid seeing it before filter is applied
        const isTracer = this.status.layerDisplaySettings[key].isTracer;
        const loadingOpacity = isTracer ? 0.01 : this.getLayerOpacity(key);

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

            //
            opacity: loadingOpacity,
            //force loading tracer signal whose opacity has been set to 0 to avoid display glitches
            preload: isTracer && this.getLayerOpacity(key)!=0,
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
