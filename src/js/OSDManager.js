import Utils from './Utils.js';

export const VIEWER_ID = "openseadragon1";
export const NAVIGATOR_ID = "navigatorDiv";
export const AXIAL = 0;
export const CORONAL = 1;
export const SAGITTAL = 2;


class OSDManager {

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

    static init(config, callbackWhenStatusChanged) {
        this.config = config;
        this.signalStatusChanged = callbackWhenStatusChanged;
        const that = this;

        //layers initial display values
        const initLayerDisplaySettings = {};
        $.each(that.config.data, function (key, value) {
            initLayerDisplaySettings[key] = { enabled: true, opacity: parseInt(value.opacity), name: value.metadata };
        });

        this.status = {

            set: undefined,
            paper: undefined,
            ctx: null,

            isFullyLoaded: false,
            tileDrawnHandler: undefined,


            userClickedRegion: false,
            selectedRegionName: "",
            reloaded: false,

            // range pointer
            position: [{ x: 0, y: 0, c: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
            pos: undefined,

            pointerdownpos: { x: 0, y: 0 },

            //layers display values
            layerDisplaySettings: initLayerDisplaySettings,

            //visibility of region delineations
            showRegions: !this.config.bHideDelineation,

            coronalChosenSlice: this.config.initialSlice,

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


                that.addSVGData(that.config.PUBLISH_PATH + "/" + that.config.svgFolerName + "/Anno_" + (that.viewer.currentPage() - that.config.coronalFirstIndex) + ".svg", event);
            }
        });

        this.viewer.addHandler('open', function (event) {

            that.status.coronalChosenSlice = that.viewer.currentPage();
            var elt = document.createElement("div");
            elt.className = "overlay";

            if (!that.viewer.source) { return; }

            var dimensions = that.viewer.source.dimensions;
            that.viewer.addOverlay({
                element: elt,
                location: that.viewer.viewport.imageToViewportRectangle(new OpenSeadragon.Rect(0, 0, dimensions.x, dimensions.y)),
            });
            $.each(that.config.layers, function (key, value) {
                if (value.index != 0) {
                    that.addLayer(key, value.name, value.ext);
                } else {
                    that.setOpacity(key);

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
            that.transform(that.status.set);
        });


        this.viewer.addHandler('animation', function (event) {
            that.transform(that.status.set);
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



    }


    static resizeCanvas() {
        $("#poscanvas").attr({
            'width': this.viewer.canvas.clientWidth,
            'height': this.viewer.canvas.clientHeight
        });
        this.viewPosition();

        if (this.viewer.referenceStrip) {
            //FIXME resetReferenceStrip();
        }
    }


    static pointerdownHandler(event) {
        this.status.pointerdownpos.x = event.clientX;
        this.status.pointerdownpos.y = event.clientY;
    };

    static pointerupHandler(event) {
        if (this.viewer.currentOverlays.length == 0 || $("#poscanvas").is(":hidden")) {
            return;
        }

        if (this.status.pointerdownpos.x > event.clientX + 5 || this.status.pointerdownpos.x < event.clientX - 5 ||
            this.status.pointerdownpos.y > event.clientY + 5 || this.status.pointerdownpos.y < event.clientY - 5) {
            return;
        }
        if (this.status.position[0].c == 2) {
            this.resetPositionview();
            this.viewer.drawer.clear();
            this.viewer.world.draw();
            this.viewPosition();
            return;
        }
        var rect = this.viewer.canvas.getBoundingClientRect();
        //var zoom = viewer.viewport.getZoom(true);
        var zoom = this.viewer.viewport.getZoom(true) * (this.viewer.canvas.clientWidth / this.config.imageSize);
        var x = (event.clientX - this.viewer.currentOverlays[0].position.x - rect.left) / zoom;
        var y = (event.clientY - this.viewer.currentOverlays[0].position.y - rect.top) / zoom;
        this.status.position[0].c++
        this.status.position[this.status.position[0].c].x = x;
        this.status.position[this.status.position[0].c].y = y;

        this.setPosition();

        // show canvas
        this.viewPosition();
    };


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
                            OpenSeadragon.Filters.INTENSITYALPHA()
                        ]
                    }]
                });
            }
            else if (nn_tracer_layer_ind != -1 && nn_layer === undefined) {
                this.waitForNNLayer(nn_tracer_layer_ind);
            }
        }
        //TODO remove useless code
        $("#intensity_value").val($("#intensity_slider").val());
        $("#gamma_value").val((parseFloat($("#gamma_slider").val()) / 10.0).toFixed(1));
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

    static addSVGData(svgName, event) {
        this.status.paper = Raphael(event.element);
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
                    var newSet = that.status.paper.importSVG(paths[i]);
                    newSet.id = paths[i].getAttribute('id');
                    newSet.attr("title", paths[i].getAttribute('id'));
                    newSet.attr("fill-opacity", 0.4);

                    //handle the background case
                    if (paths[i].getAttribute('id') == "background") {
                        newSet.attr("fill-opacity", 0.0);
                        /*					newSet.mouseover(function(e)
                                            {
                                                document.getElementById('current_region').innerHTML = this.attr("title");
                                            });*/

                        newSet.mouseout(function (e) {
                            if (that.status.selectedRegionName != this.attr("title")) {
                                //	this.attr({"fill-opacity":0.4});
                                //	this.attr("stroke-opacity", "1");
                            }
                        });

                        newSet.click(function (e) {
                            $('#jstree').jstree("deselect_all");
                            //userClickedRegion = true;	
                            that.status.selectedRegionName = "";
                            if ($('#jstree').jstree(true).clear_search) {
                                $('#jstree').jstree(true).clear_search();
                            }
                        });
                        that.status.set.push(newSet);

                    } else {
                        newSet.mouseover(function (e) {
                            /*document.getElementById('current_region').innerHTML = this.attr("title");*/
                            this.attr({ "fill-opacity": 0.8 });
                            this.attr("stroke-opacity", "1");
                        });

                        newSet.mouseout(function (e) {
                            if (that.status.selectedRegionName != this.attr("title")) {
                                this.attr({ "fill-opacity": 0.4 });
                                this.attr("stroke-opacity", "1");
                            }
                        });

                        newSet.click(function (e) {
                            $('#jstree').jstree("deselect_all");

                            that.status.set.forEach(function (el) {
                                el.attr("fill-opacity", "0.4");//works
                                el.attr("stroke-opacity", "0");
                            });
                            //$('#jstree').jstree(true).select_node(this.attr("title"));
                            //console.log(data.selected[0].offsetTop/2);
                            //scroll to correct height
                            that.status.userClickedRegion = true;
                            that.status.selectedRegionName = this.attr("title");
                            if ($('#jstree').jstree(true).clear_search) {
                                $('#jstree').jstree(true).clear_search();
                            }
                            $('#jstree').jstree('select_node', this.attr("title"));

                            //this is the correct place for updating the scroll position:
                            //TODO: change the value of 100 to some calculation
                            $('#jstree').scrollTop(Utils.findPosY(document.getElementById(this.attr("title")))
                                - Utils.findPosY(document.getElementById('jstree')) - $('#jstree').height() / 2);
                            $('#jstree').scrollLeft(Utils.findPosX(document.getElementById(this.attr("title"))));
                            this.attr("fill-opacity", "0.8");//works
                            this.attr("stroke", "#0000ff");
                            //EDIT: Alex, Feb 1, 2017
                            //make stroke-width input a variable
                            this.attr("stroke-width", "2");//"8");
                            this.attr("stroke-opacity", "1");
                            //update horizontal position too
                            //$.jstree.reference('#jstree').select_node(this.attr("title"));
                        });
                        that.status.set.push(newSet);
                    }
                }

                that.status.reloaded = true;
                //console.log("reloaded");

                that.transform(that.status.set);
                //if we have come to a new slice from clicking tree view this should occur:
                that.setSelection(that.status.selectedRegionName, true);

                if (!that.status.showRegions) {
                    that.hideDelineation();
                }

            }
        });



    }

    static transform(el) {
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

        this.viewPosition();
    }

    static showRegions(visible) {
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

    static hideDelineation() {
        this.status.set.forEach(function (el) {
            el.hide();
        });
    }

    static unselectRegions() {

        this.status.set.forEach(function (el) {
            if (el[0].attr("title") == "background") {
                el.attr("fill-opacity", "0.0");
            } else {
                el.attr("fill-opacity", "0.4");//works
            }
            el.attr("stroke-opacity", "0");
            el.attr("stroke-width", "0");
        });

    }

    static selectRegions(nameList) {
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
                        subNode.attr("fill-opacity", "0.4");//we wont fill this in here
                        subNode.attr("stroke-opacity", "1");
                        subNode.attr("stroke", "#0000ff");
                        //EDIT: Alex, Feb 1, 2017
                        subNode.attr("stroke-width", "2");//"2");
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
            this.status.selectedRegionName = nameList[0];
            this.status.userClickedRegion = false;
        }
    }

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

                    //coronalImg.node.href.baseVal = dataRootPath + "/" + subviewFolerName +"/coronal/" + coronalChosenSlice + ".jpg";
                    //updateLinePosBaseSlide(coronalChosenSlice);
                }
                //WHILE NOT FOUND IN SETSELECTION, wait a bit and try again
                //console.log("I made it");
            }
            this.status.selectedRegionName = regionName;
            this.status.userClickedRegion = false;
        }
    }

    static setSelection(selectedRegion) {
        var i, j, r = [];
        var found = false;
        var newX = 0;
        var newY = 0;
        var snCount = 0;
        this.status.set.forEach(function (el) {
            var xvdd = el[0].attr("title");//works
            if (xvdd.trim() == selectedRegion) {
                found = true;
                //move to correct location
                var bbox = el[0].getBBox();
                //console.log("The value is"+bbox.x + " "+bbox.y);
                newX += (bbox.x2 - bbox.width / 2) / this.config.dzWidth;
                newY += (this.config.dzDiff + bbox.y2 - bbox.height / 2) / this.config.dzHeight;
                snCount++;
                //console.log(newX + " " + newY);
                //set pan to and zoom to
                //var windowPoint = new OpenSeadragon.Point(newX, newY);
                //viewer.viewport.panTo(windowPoint);

                el.attr("fill-opacity", "0.8");//works
                el.attr("stroke", "#0000ff");
                //EDIT: Alex, Feb 1, 2017
                // change this to a parameter
                el.attr("stroke-width", "2");//"8");
                el.attr("stroke-opacity", "1");

                //return true;
            }
        });
        if (snCount > 0) {
            //now we have considered all relevant regions
            var windowPoint = new OpenSeadragon.Point(newX / snCount, newY / snCount);
            this.viewer.viewport.panTo(windowPoint);
            this.viewer.viewport.zoomTo(1.1);
            return true;
        }
        return false;
    }


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

    static getViewer() {
        return this.viewer;
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
        var x = (this.status.position[0].x - this.viewer.currentOverlays[0].position.x - rect.left) / zoom;
        var y = (this.status.position[0].y - this.viewer.currentOverlays[0].position.y - rect.top) / zoom;

        this.status.pos = this.getPoint(x, y);
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


    static getOpacity(key) {
        var opacity = 0;
        if (this.config.layers[key]) {
            if (this.status.layerDisplaySettings[key].enabled) {
                opacity = this.status.layerDisplaySettings[key].opacity / 100;
            }
        }
        return opacity;
    }

    static setOpacity(key) {
        if (this.config.layers[key]) {
            var opacity = this.getOpacity(key);
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

            opacity: this.getOpacity(key),
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
            this.setOpacity(layerid);
            this.signalStatusChanged(this.status);
        }
    }


    //--------------------------------------------------
    // position


    static viewPosition() {
        if (this.viewer.currentOverlays[0] == null) { return; }
        if (this.status.ctx == null) {
            this.status.ctx = $("#poscanvas")[0].getContext('2d');
        }

        this.status.ctx.clearRect(0, 0, $("#poscanvas")[0].width, $("#poscanvas")[0].height);

        var rect = this.viewer.canvas.getBoundingClientRect();
        //var zoom = viewer.viewport.getZoom(true);
        var zoom = this.viewer.viewport.getZoom(true) * (this.viewer.canvas.clientWidth / this.config.imageSize);
        var x = (this.status.position[0].x - this.viewer.currentOverlays[0].position.x - rect.left) / zoom;
        var y = (this.status.position[0].y - this.viewer.currentOverlays[0].position.y - rect.top) / zoom;

        this.status.pos = this.getPoint(x, y);
        this.signalStatusChanged(this.status);

        // distance line
        if (this.status.position[0].c == 2) {
            var px1 = Math.round((this.status.position[1].x * zoom) + this.viewer.currentOverlays[0].position.x + 0.5) - 0.5;
            var py1 = Math.round((this.status.position[1].y * zoom) + this.viewer.currentOverlays[0].position.y + 0.5) - 0.5;
            var px2 = Math.round((this.status.position[2].x * zoom) + this.viewer.currentOverlays[0].position.x + 0.5) - 0.5;
            var py2 = Math.round((this.status.position[2].y * zoom) + this.viewer.currentOverlays[0].position.y + 0.5) - 0.5;
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
                var px = Math.round((this.status.position[i].x * zoom) + this.viewer.currentOverlays[0].position.x + 0.5) + 0.5;
                var py = Math.round((this.status.position[i].y * zoom) + this.viewer.currentOverlays[0].position.y + 0.5) + 0.5;
                this.status.ctx.moveTo(px, py - 10);
                this.status.ctx.lineTo(px, py + 10);
                this.status.ctx.moveTo(px - 10, py);
                this.status.ctx.lineTo(px + 10, py);
            }
            this.status.ctx.stroke();
            this.status.ctx.beginPath();
            this.status.ctx.strokeStyle = "#FFF";
            for (var i = 1; i <= this.status.position[0].c; i++) {
                var px = Math.round((this.status.position[i].x * zoom) + this.viewer.currentOverlays[0].position.x + 0.5) - 0.5;
                var py = Math.round((this.status.position[i].y * zoom) + this.viewer.currentOverlays[0].position.y + 0.5) - 0.5;
                this.status.ctx.moveTo(px, py - 10);
                this.status.ctx.lineTo(px, py + 10);
                this.status.ctx.moveTo(px - 10, py);
                this.status.ctx.lineTo(px + 10, py);
            }
            this.status.ctx.stroke();
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
        this.viewPosition();
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




//const osdManager = new OSDManager();
//Object.freeze(osdManager);

export default OSDManager;
