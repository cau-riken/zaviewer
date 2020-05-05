//--------------------------------------------------
//viewer init
//https://github.com/openseadragon/openseadragon/issues/1421 to improve caching
function getPoint(x, y) {
    var point;
    var tx = G.imageSize - x;
    var ty = G.imageSize - y;
    point = new Array(tx, G.coronalChosenSlice * G.coronalSliceStep, ty, 1);
    //console.log(point);
    //console.log(matrix);
    //return multiplyMatrixAndPoint(point);
    var result = [0, 0, 0, 0];
    for (var i = 0; i < 4; i++) {
        for (var j = 0; j < 4; j++) {
            result[i] += (G.matrix[i * 4 + j] * point[j]);
        }
    }
    //console.log(result);
    return result;
}
function getPointXY(x, y) {
    var pos = getPoint(x, y);
    return { x: pos[0], y: pos[2] };
}

function setPoint(x, y) {
    var pos = getPoint(x, y);

    //$("#posnow").html("x: "+(pos[0]+".00").replace(/(\.\d{2}).*$/,"$1") + "<br/>y: "+(pos[1]+".00").replace(/(\.\d{2}).*$/,"$1") + "<br/>z: "+(pos[2]+".00").replace(/(\.\d{2}).*$/,"$1"));
    $("#posX").text(pos[0].toFixed(2));
    $("#posY").text(pos[1].toFixed(2));
    $("#posZ").text(pos[2].toFixed(2));
}

function resizeCanvas() {
    $("#poscanvas").attr({
        'width': G.viewer.canvas.clientWidth,
        'height': G.viewer.canvas.clientHeight
    });
    viewPosition();

    if (G.viewer.referenceStrip) {
        resetReferenceStrip();
    }
}

//AW(2010/01/16): Modified code to add alpha channel, now the brightness and gamma are disabled, and we expect the NN seg to work on layer
function fullyLoaded() {
    console.log("fullylod");
}

function updateFilters() {
    if (G.viewer) {
        var nn_tracer_layer_ind = -1;
        var count = 0;
        $.each(G.layers, function (key) {
            //console.log(key);
            if (G.layers[key].name.includes("nn_tracer")) {
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
        var nn_layer = G.viewer.world.getItemAt(nn_tracer_layer_ind);
        console.log(nn_layer);
        if (nn_tracer_layer_ind != -1 && nn_layer !== undefined) {
            //viewer.world.getItemAt(nn_tracer_layer_ind).addHandler('tile-loaded',fullyLoaded);
            G.viewer.setFilterOptions({
                filters: [{
                    items: G.viewer.world.getItemAt(nn_tracer_layer_ind),
                    processors: [
                        OpenSeadragon.Filters.INTENSITYALPHA()
                    ]
                }]
            });
        }
        else if (nn_tracer_layer_ind != -1 && nn_layer === undefined) {
            waitForNNLayer(nn_tracer_layer_ind);
        }
    }
    $("#intensity_value").val($("#intensity_slider").val());
    $("#gamma_value").val((parseFloat($("#gamma_slider").val()) / 10.0).toFixed(1));
}
function waitForNNLayer(nn_tracer_layer_ind) {
    var nn_layer = G.viewer.world.getItemAt(nn_tracer_layer_ind);
    if (nn_layer === undefined) {
        setTimeout(function () { waitForNNLayer(nn_tracer_layer_ind) }, 100);
    } else {
        updateFilters();
    }
}

function onViewerScroll(event) {
    // Disable mousewheel zoom on the viewer and let the original mousewheel events bubble
    // if (!event.isTouchEvent) {
    //     event.preventDefaultAction = true;
    //     return true;
    // }
}

function onViewerClick(event) {
    // Disable click zoom on the viewer using event.preventDefaultAction
    event.preventDefaultAction = true;
    event.stopBubbling = true;
	/*
	console.log("Hey Alex where are you?");
	if (userClickedRegion == false)
	{ 
		//userClickedRegion = false;
		selectedRegionName = "";
		$('#jstree').jstree(true).clear_search();
		$('#jstree').jstree('deselect_all');	
	}	*/
}



function viewerInit() {

    G.viewer = OpenSeadragon({
        id: "openseadragon1",
        tileSources: G.tileSources,
        initialPage: G.initialSlice,
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
        navigatorId: "navigatorDiv",
        showReferenceStrip: false,
        showFullPageControl: false
    });

    G.viewer.scalebar({
        type: OpenSeadragon.ScalebarType.MICROSCOPY,
        pixelsPerMeter: 1000 / (getPointXY(0, G.imageSize / 2).x - getPointXY(G.imageSize, G.imageSize / 2).x) * G.imageSize,//37cm:1000px
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


    //--------------------------------------------------
    //viewer.addHandler
    G.viewer.addHandler('open', function (event) {
        G.coronalChosenSlice = G.viewer.currentPage();
        var elt = document.createElement("div");
        elt.className = "overlay";

        if (!G.viewer.source) { return; }

        var dimensions = G.viewer.source.dimensions;
        G.viewer.addOverlay({
            element: elt,
            location: G.viewer.viewport.imageToViewportRectangle(new OpenSeadragon.Rect(0, 0, dimensions.x, dimensions.y)),
        });
        $.each(G.layers, function (key, value) {
            if (value.index != 0) {
                addLayer(key, value.name, value.ext);
            } else {
                setOpacity(key);

                if (!G.viewer.referenceStrip) {
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
            i++;
        });

        $(G.viewer.canvas).off('.posview');
        $(G.viewer.canvas).on('mousemove.posview', G.mousemoveHandler);

        updateSubVLine(G.viewer.currentPage());

    });

    G.viewer.addHandler('resize', function (event) {
        resizeCanvas();
        transform(G.set);
    });

    //FPa 20200504
    G.viewer.addHandler('update-viewport', function (event) {
        resizeCanvas();
    });


    G.viewer.addHandler('animation', function (event) {
        transform(G.set);
    });

    G.viewer.addHandler('add-overlay', function (event) {
        //add overlay is called for each page change
        //alert("Adding overlays");
        //Reference 1): http://chrishewett.com/blog/openseadragon-svg-overlays/
        //addSVGData('./data/SVGs/coronal/Anno_'+(viewer.currentPage()+1)+'.svg',event);
        //var currentPage = viewer.currentPage();
        if (G.svgFolerName != "") {
            //addSVGData(dataRootPath + "/" + G.svgFolerName + "/coronal/Anno_"+ (currentPage - coronalFirstIndex ) + ".svg",event);
            addSVGData(G.PUBLISH_PATH + "/" + G.svgFolerName + "/Anno_" + (G.viewer.currentPage() - G.coronalFirstIndex) + ".svg", event);
        }
    });

    //Handle changing the page; perhaps dynamically load new data at this point
    G.viewer.addHandler('page', function (event) {
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

    G.viewer.canvas.addEventListener('click', pointerupHandler);
    G.viewer.canvas.addEventListener('pointerdown', pointerdownHandler);
    G.viewer.canvas.addEventListener('mousedown', pointerdownHandler);

    var cnv = document.createElement("canvas");
    cnv.id = "poscanvas";
    if (G.bHideDelineation == false) {
        cnv.style.display = "none";
    }
    G.viewer.canvas.appendChild(cnv);
    resizeCanvas();







    //--------------------------------------------------
    //AW(2010/01/16): Added a tileDrawnHandler event to call updateFilters once the tiles have drawn properly
    G.tileDrawnHandler = function (event) {
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
    }
    G.viewer.addHandler('tile-drawn', G.tileDrawnHandler);



    $('#intensity_slider, #gamma_slider').change(updateFilters);
    $('#intensity_value, #gamma_value').change(function () {
        $("#gamma_value").val(parseFloat($("#gamma_value").val()).toFixed(1))
        $("#intensity_slider").val($("#intensity_value").val())
        $("#gamma_slider").val($("#gamma_value").val() * 10);
        //	updateFilters();
    });


    G.viewer.addViewerInputHook({
        hooks: [
            { tracker: 'viewer', handler: 'scrollHandler', hookHandler: onViewerScroll },
            { tracker: 'viewer', handler: 'clickHandler', hookHandler: onViewerClick }
        ]
    });


    G.viewer.world.addHandler('add-item', function (event) {
        var tiledImage = event.item;
        console.log("A");
        tiledImage.addHandler('fully-loaded-change', function () {
            var newFullyLoaded = areAllFullyLoaded();
            if (newFullyLoaded !== G.isFullyLoaded) {
                G.isFullyLoaded = newFullyLoaded;
                // Raise event
                console.log("test");
            }
        });
    });

}