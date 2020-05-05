// ┌────────────────────────────────────────────────────────────────────┐ \\
// │ 3D Brain Atlas Viewer                    │ \\
// ├────────────────────────────────────────────────────────────────────┤ \\
// │                │ \\
// ├────────────────────────────────────────────────────────────────────┤ \\
// │  │ \\
//  TODO: Remove dependency on the height of the images
//  Currently I'm assuming 8000 by 8000, I changed this to 1800 by 1800 for the new data set
//					maxLevel: 11, //maxLevel should correspond to the depth of the number of folders in the dzi subdirectory
// before this was at 10 and there were problems with images
//
// └────────────────────────────────────────────────────────────────────┘ \\

var set;
var paper;
var axialHolderPaper;
var axialHolderPaperSet;
var axialRect;
var coronalHolderPaper;
var coronalHolderPaperSet;
var coronalRect;
var sagittalHolderPaper;
var sagittalHolderPaperSet;
var sagittalRect;

var inputEvent = false;

var bHideDelineation = false; // true if delineation is hide

var userClickedRegion = false;
var selectedRegionName = "";
var reloaded = false;
var layers = {};
var editLayers = {};
var firstLayer;

//ALEX
var dzWidth = 1000.0;//Jan 31, 2017 edit//1800.0;//8000.0;
var dzHeight = 1000.0;//Jan 31, 2017 edit//1800.0;//8000.0;
var dzDiff = 0;//1290.0;

//ALEX: NOTE TO NEXTECH, why this seems to work when dzLayerWidth and dzLayerHeight are set to 2000?
//var dzLayerWidth = 2000;//1800; 
//var dzLayerHeight = 2000;//1800;
var dzLayerWidth = 1000;
var dzLayerHeight = 1000;

var tileSources = [];

var axialImg;
var coronalImg;
var sagittalImg;

var axialChosenSlice = 0;
var coronalChosenSlice = 0;
var sagittalChosenSlice = 0;

//var dataset = {}; // key -> object {axial_slide, coronal_slide, sagittal_slide}
//var datasetIndex = {}; // Save index of "key" in dataset
var subviewFolerName;
var coronalSlideCount;
var svgFolerName;
	
//var PUBLISH_PATH = "./data/publish/";
//var FILE_EXTENSION =  ".dzi";
var IIPSERVER_PATH;//"/iipsrv/iipsrv.fcgi?IIIF=/data/publish/";
var PUBLISH_PATH;//"../data/publish/";
var ADMIN_PATH;
var TILE_EXTENSION = "/info.json";//".ptif/info.json";
var THUMB_EXTENSION = "/full/250,/0/default.jpg";//".ptif/full/250,/0/default.jpg";
	
var sagittalVerticalLineId = 'sagittal_vertical_line';
	
var AXIAL = 0;
var CORONAL = 1;
var SAGITTAL = 2;
var coronalFirstIndex; // the first index of Coronal of selected dataset
var initialSlice = 0;
	
//var global_X = 0; // Red
var global_Y = 0; // Green
//var global_Z = 0; // Blue
	
var colorCoronal = "#ff4444";		// Coronal Red
var colorSagittal = "#3399ff";		// Sagittal Blue

var subviewSize = 200;
var subviewZoomRatio = 200/subviewSize; // 600*600 is real size of subview image
var yMinGlobal = 5/subviewZoomRatio; // 5~585 is range of Y in Axial and X in Sagittal subview image
var yMaxGlobal = 585/subviewZoomRatio;

var matrix = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
var coronalSliceStep = 1;
var imageSize = 1000;

//EDIT by Nextech: Set width and height for openseadragon1 div before creating viewer
var mh = 3000;// max height
var mw = 3000;// max width
var topSpace = 0;
if (window.innerHeight-topSpace < mh){
	mh = window.innerHeight-topSpace;
}
if (window.innerWidth < mw){
	$('#widget').width('100%').height(mh).split({orientation:'vertical', limit:200, position:'20%', minheight:'600px'});
}else{
	$('#widget').width(mw).height(mh).split({orientation:'vertical', limit:200, position:'20%', minheight:'600px'});
	}
$('#foo').split({orientation:'horizontal', position:'10px'});


//Finds y value of given object
function findPosY(obj) {
	var curtop = 0;
	if (obj.offsetParent) {
		do {
			curtop += obj.offsetTop;
		} while (obj = obj.offsetParent);
	//console.log(curtop);	
	return [curtop];
	}
}

function findPosX(obj) {
	var curleft = 0;
	if (obj.offsetParent) {
		do {
			curleft += obj.offsetLeft;
		} while (obj = obj.offsetParent);
	//console.log(curleft);	
	return [curleft];
	}
}

function setSelection(selectedRegion){
	var i, j, r = [];
	var found = false;
	var newX = 0;
	var newY = 0;
	var snCount = 0;
	set.forEach(function(el){
		var xvdd = el[0].attr("title");//works
		if (xvdd.trim() == selectedRegion){
		found = true;
		//move to correct location
		var bbox = el[0].getBBox();
		//console.log("The value is"+bbox.x + " "+bbox.y);
			newX += (bbox.x2 - bbox.width/2)/dzWidth;
			newY += (dzDiff+ bbox.y2 - bbox.height/2)/dzHeight;
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
	if (snCount>0){
			//now we have considered all relevant regions
		var windowPoint = new OpenSeadragon.Point(newX/snCount, newY/snCount);
		viewer.viewport.panTo(windowPoint);
		viewer.viewport.zoomTo(1.1);
		return true;
	}
	return false;
}
	
function getAllChildrenTexts(treeObj, nodeId, result) {
	var node = $('#jstree').jstree(true).get_node(nodeId);
	result.push(node.id);
	if (node.children) {
		for (var i = 0; i < node.children.length; i++) {
			getAllChildrenTexts(treeObj, node.children[i], result);
		}
	}
}

function createTree(urlPath) {
	if(!urlPath || urlPath == null || urlPath.lenght == 0){
		return;
	}
	// 6 create an instance when the DOM is ready
	$('#jstree').jstree({
		"core" : {
			"themes" : { "icons": false },
			"data" : {
				"url" : PUBLISH_PATH + urlPath + "/tree.html",
				async: false
			}
		},
		"search" : {
			"show_only_matches" : true
		},
		"plugins" : [ "search" ]
	});

	var to = false;
	$('#region_search_form').keyup(function () {
		if(to) { clearTimeout(to); }
		to = setTimeout(function () {
			var v = $('#region_search_form').val();
			$('#jstree').jstree(true).search(v);
			$('#jstree').scrollLeft(0);
		}, 250);
	});
	
	var json_nodeList =	$('#jstree').jstree().get_json('#', { 'flat': true });
	for (var i=0;i<json_nodeList.length;i++){
		if (json_nodeList[i]['li_attr']['data-regionexists'] == '0'){
			//console.log("tryng to disable");
			$('#jstree').jstree().disable_node(json_nodeList[i]['id']);
		}
	}

	// 7 bind to events triggered on the tree
	$('#jstree').on("changed.jstree", function (e, data) {
		//console.log("user interaction");
		//remove selection on all elements
		set.forEach(function(el){
			if (el[0].attr("title") == "background"){
				el.attr("fill-opacity", "0.0");
			}else{
				el.attr("fill-opacity", "0.4");//works
			}
			el.attr("stroke-opacity", "0");	
			el.attr("stroke-width", "0"); 
		});
		if (data.action == "deselect_all"){
			 //console.log("deselect_all");
		}else if (data.action == "select_node"){
			//console.log("select_node");
			if (userClickedRegion == false){
				var i, j;
				var found = false;
				var sRegion = null;
				var i, j, r = [];
				var found = false;
				
				var node = $('#jstree').jstree(true).get_node(data.selected[0]);
				//handle the case when there are children
				//console.log("testing for children:"+data.selected[0]+"children"+node.children.length)
				if (node.children.length > 0){
					var nameList = []; 
					getAllChildrenTexts(data,data.selected[0].trim(),nameList);
					//how to choose a center?
					var newX = 0;
					var newY = 0;
					var snCount = 0;
					for (var k=0;k<nameList.length;k++){
						//try to find the nodes -> slow way!
						set.forEach(function(el){
							var subNode = el[0];
							if (el[0].attr("title") == nameList[k]){
								snCount++;
								subNode.attr("fill-opacity", "0.4");//we wont fill this in here
								subNode.attr("stroke-opacity", "1");
								subNode.attr("stroke", "#0000ff");
								//EDIT: Alex, Feb 1, 2017
								subNode.attr("stroke-width", "2");//"2");
								var bbox = subNode.getBBox();
								newX += (bbox.x2 - bbox.width/2)/dzWidth;
								newY += (dzDiff+ bbox.y2 - bbox.height/2)/dzHeight;
							}
						});
					}
					if (snCount > 0){
						newX/=snCount;
						newY/=snCount;
						var windowPoint = new OpenSeadragon.Point(newX, newY);
						viewer.viewport.panTo(windowPoint);
						viewer.viewport.zoomTo(1.1);
					}
				}else{
					//console.log("Has no children");
					var newX = 0;
					var newY = 0;
					var snCount = 0;
					set.forEach(function(el){
						var xvdd = el[0].attr("title");//works
						if (xvdd.trim() == data.selected[0].trim()){
							found = true;
							//move to correct location
							var bbox = el[0].getBBox();
							//console.log("The value is"+bbox.x + " "+bbox.y);
							newX += (bbox.x2 - bbox.width/2)/dzHeight;
							newY += (dzDiff+ bbox.y2 - bbox.height/2)/dzHeight;
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
					if (snCount>0){
						//now we have considered all relevant regions
						var windowPoint = new OpenSeadragon.Point(newX/snCount, newY/snCount);
						viewer.viewport.panTo(windowPoint);
					}
				}
				if (found == false){
					//console.log("wasnt found");
					//check for the first occurence
					var org_id = data.selected[0].trim();
					var esc_id = org_id.replace( /(:|\.|\/|\[|\])/g, "\\$1" );
					var nodInfo = $("#" + esc_id);
					var id_value     = nodInfo.attr("id");
					var firstOccVal     = nodInfo.attr("dataFirstOccC");
					//console.log("Coronal Fv: "+firstOccVal+" id:"+id_value+" :"+data.selected[0]);
					if (firstOccVal >= 0 && firstOccVal < coronalSlideCount) {
						selectedRegionName = data.selected[0].trim();
						//console.log("firstOccVal " + firstOccVal);
						coronalChosenSlice = parseInt(firstOccVal);
						viewer.goToPage(coronalFirstIndex + coronalChosenSlice);
						claerPosition();
						
						//coronalImg.node.href.baseVal = dataRootPath + "/" + subviewFolerName +"/coronal/" + coronalChosenSlice + ".jpg";
						//updateLinePosBaseSlide(coronalChosenSlice);
						$("#coronal_spinner>input:first-child").val(coronalChosenSlice);
					}
					//WHILE NOT FOUND IN SETSELECTION, wait a bit and try again
					//console.log("I made it");
				}
				selectedRegionName = data.selected[0].trim();
			}
			userClickedRegion = false;
			/*$('#current_region').html(data.selected[0].trim());*/
		}else{
			//console.log("else");
		}
	});
}
//Stuff for layers
function hideShow() {
	if(set){
		if (bHideDelineation == false){
			set.forEach(function(el){
				el.hide();
				$("#poscanvas").show();
			});
		
			$("#btnHideShow").html('Show delineations'); 
		}else{
			set.forEach(function(el){
				el.show();
				$("#poscanvas").hide();
			});
		
			$("#btnHideShow").html('Hide delineations'); 
		}
		bHideDelineation = !bHideDelineation;
	}
}

function hideDelineation() {
	set.forEach(function(el){
		el.hide();
	});
}

function addLayer( key, name ,ext ) {
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
			//tileSource:dataRootPath + "/" + layerName + "/coronal/" + viewer.currentPage() +".dzi",
			tileSource:IIPSERVER_PATH + key + "/" + viewer.currentPage() + ext + TILE_EXTENSION,// +  TILE_EXTENSION,
			//opacity: ($('#' + key).val()/100),
			opacity:getOpacity(key),
	};

	var addLayerHandler = function( event ) {
		viewer.world.removeHandler( "add-item", addLayerHandler );
		layers[key].name = name;
	};
	viewer.world.addHandler( "add-item", addLayerHandler );
	viewer.addTiledImage( options );
}
//End of layer stuff

// getParam
var paramId = "";
var url = location.search.substring(1).split('&');
for(i=0; url[i]; i++) {
	var k = url[i].split('=');
	if(k[0] == "id"){
		paramId = k[1];
		break;
	}
}


$(document).ready(function(){
	updateFilters();
});

$.ajax({
	url: "../path.json",
	type: "GET",
	async: false,
	dataType: 'json',
	success: function(response){
		ADMIN_PATH = response.admin_path;
		IIPSERVER_PATH = response.iipserver_path;
		PUBLISH_PATH = response.publish_path;
$.ajax({
	url: "../" + ADMIN_PATH + "json.php",
	type: "POST",
	async: false,
	dataType: 'json',
	data: {
		id: paramId,
	},
	success: function(response){
		if(response.error){
			console.log(response.error);
		}
		createTree(response.tree);
		
		//dataRootPath = response.data_root_path;
		if(response.subview){subviewFolerName = response.subview.foldername;}
		coronalSlideCount = response.slide_count;
		//sagittalSlideCount = response.subview.sagittal_slide;
		
		
		//axialFirstIndex = 0;
		coronalFirstIndex = 0;//axialFirstIndex;
		//sagittalFirstIndex = coronalFirstIndex + coronalSlideCount;
		
		var subviewOrgSize = (response.subview && response.subview.size) ? response.subview.size : 200;
		subviewZoomRatio = subviewOrgSize / subviewSize;
//		xMinGlobal = (response.subview.x_min ? response.subview.x_min : 0) / subviewZoomRatio;
//		xMaxGlobal = (response.subview.x_max ? response.subview.x_max : subviewOrgSize) / subviewZoomRatio;
		yMinGlobal = (response.subview && response.subview.y_min ? response.subview.min : 0) / subviewZoomRatio;
		yMaxGlobal = (response.subview && response.subview.y_max ? response.subview.max : subviewOrgSize) / subviewZoomRatio;
//		zMinGlobal = (response.subview.z_min ? response.subview.z_min : 0) / subviewZoomRatio;
//		zMaxGlobal = (response.subview.z_max ? response.subview.z_max : subviewOrgSize) / subviewZoomRatio;

		if(response.delineations){
			svgFolerName = response.delineations;
		}else{
			$("#btnHideShow").hide();
		}
		
		matrix = response.matrix?response.matrix.split(","):matrix;
		//axialSliceStep = response.axial_slice_step;
		coronalSliceStep = response.slice_step;
		//sagittalSliceStep = response.sagittal_slice_step;
		
		imageSize = response.image_size ? response.image_size : imageSize;
		dzWidth       = imageSize;
		dzHeight      = imageSize;
		dzLayerWidth  = imageSize;
		dzLayerHeight = imageSize;
		
		if(response.data){
			var i = 0;
			$.each(response.data, function(key, value) {
				showSlider(key, value.metadata, value.opacity);
			
				// only firstLayer
				if (i == 0) {
					showInfoText(key);
					$("#" + key + "Name").addClass("selected");
					for (var j = 0; j < coronalSlideCount; j++) {
						//tileSources.push(dataRootPath + "/" + key + "/coronal/" + key +"_Coronal_" + j +".dzi");
						tileSources.push(IIPSERVER_PATH + key + "/" + j + "." + value.extension + TILE_EXTENSION);
						//tileSources.push("http://210.230.211.213/iipsrv/iipsrv.fcgi?IIIF=/group3/ptiffs/red/" + j + ".ptif/info.json");
					}
				}
				//dataset[key] = value.metadata;
				//datasetIndex[key] = i++;
				layers[key] = {"name":value.metadata, "ext":"."+value.extension, "index":i++};
			});
		}
		
		if(response.first_access){
			//accessData = response.first_access.data ? response.first_access.data : "coronal";
			initialSlice = parseInt(response.first_access.slide ? response.first_access.slide : 30);
			if (response.first_access.delineations == "hide") {
				bHideDelineation = true;
				$("#btnHideShow").html('Show delineations');
			}

	//		selectedSubview = CORONAL;
			coronalChosenSlice = initialSlice;
			initialSlice += coronalFirstIndex;	
			//global_X = 10 + zMaxGlobal;
			global_Y = 10 + (coronalSlideCount - response.first_access.slide)*(yMaxGlobal-yMinGlobal)/coronalSlideCount + yMinGlobal;
			//global_Z = 10 + xMinGlobal;
		}

		//$("#axial_holder").hide();
		//$("#coronal_holder").hide();
		//if(sagittalSlideCount == 0){$("#sagittal_holder").hide();}
		//$("#sagittal_spinner").hide();
		//$("#sagittal_spinner_max").hide();
				
		if(response.bright){
			$("#intensity_slider").val(response.bright);
		}
		if(response.gamma){
			$("#gamma_slider").val(response.gamma);
		}
		if(response.bright || response.gamma){
			updateFilters();
		}
		
		if(response.group_id || (response.data && Object.keys(response.data).length > 0)){
			$("#GroupName").html(response.group_name);
			$("#editbtn").click(showImageList);
		}else{
			$("#editbtn").hide();
		}
	}//success
});
	}//success
});

function showSlider(key , name, opacity){
	var html = "";
	html += "<div class=\"dataset\">";
	html +=   "<span id=\"" + key + "Name\">" + name + "</span>";
	html +=   "<br/>";
	html +=   "<div>";
	html +=     "<div>";
	html +=       "<input type=\"checkbox\" id=\"" + key + "Enabled\" class=\"opcChk\" />";
	html +=     "</div>";
	html +=     "<div>";
	html +=       "<input type=\"range\" id=\"" + key + "\" class=\"slider\" value=\""+opacity+"\" />";
	html +=     "</div>";
	html +=     "<input type=\"text\" id=\"" + key + "Opacity\" class=\"opacity\" value=\""+opacity+"\" />";
	html +=   "</div>";
	html += "</div>";
	$('#sliderGroup1').append(html);
		
	//Opacity
	$(document).on('input', '#' + key ,function() {
		inputEvent = true;
		if(layers[key]){
			setOpacity(key);
		}
	});
	$(document).on('change', '#' + key ,function() {
		if(!inputEvent){ // IE not work with input event
			if(layers[key]){
				setOpacity(key);
			}
		}
	});
	
	$(document).on('change', '#' + key + "Enabled",function() {
		if( $('#sliderGroup1 [class="opcChk"]:not(:checked)').length == 0){
			$.each(layers,function(key){
				//viewer.world.getItemAt(layers[key].index).setOpacity(getOpacity(key));
				setOpacity(key);
			});
		}else{
			$('#sliderGroup1 [class="opcChk"]').each(function(key) {
				var slider = $(this).parent().parent().find("input.slider");
				setOpacity(slider.attr("id"));
			});
		}
	});
	$(document).on('change', '#' + key + "Opacity",function() {
		$("#" + key).val($(this).val());
		setOpacity(key);
	});
	
	//name
	$(document).on('mousedown', '#' + key + "Name" ,function() {
		if(!$(this).hasClass("selected")){
			$('#sliderGroup1 span[class="selected"]').map(function(){
				$(this).removeClass("selected");
			})
			$(this).addClass("selected");
			var matchList = this.id.match(/^(.*)Name$/);
			if(matchList != null && matchList[1]){
				showInfoText(matchList[1]);
			}
		}
	});
}

function getOpacity(key){
	var opacity = 0;
	if (layers[key]) {
		if($("#" + key + "Enabled").prop("checked") || $('#sliderGroup1 [class="opcChk"]:checked').length == 0){
			opacity = $('#' + key).val()/100;
		}
	}
	return opacity;
}

function setOpacity(key){
	if (layers[key]) {
		var opacity = getOpacity(key);
		$("#" + key + "Opacity").val(parseInt(opacity*100));
		if(viewer.world.getItemAt(layers[key].index)){
			viewer.world.getItemAt(layers[key].index).setOpacity(opacity);
		}
	}
}
				
function showInfoText(publicId){
	$("#infoPanelButton>span").html($("#"+publicId+"Name").html());
	$.ajax({
		url:PUBLISH_PATH + publicId + "/info.txt",
		type:"GET",
		dataType:"text",
		success:function(data){
			$("#infoPanelText").html(data);
		},
		error:function(){
			$("#infoPanelText").html("");
		}
	});
}

//--------------------------------------------------
//viewer init
var viewer = OpenSeadragon({
	id: "openseadragon1",
	tileSources: tileSources,
	initialPage: initialSlice,
	minZoomLevel: 0,
	maxZoomLevel: 10,
	sequenceMode: true,
	showHomeControl: false,
	showZoomControl: false,
	showSequenceControl: false,
	showNavigator: true,
	navigatorId: "navigatorDiv",
	showReferenceStrip: false,
	showFullPageControl: false
});

viewer.scalebar({
	type: OpenSeadragon.ScalebarType.MAP,
	pixelsPerMeter:1000/(getPointXY(0,imageSize/2).x - getPointXY(imageSize,imageSize/2).x)*imageSize,//37cm:1000px
	minWidth: "75px",
	location: OpenSeadragon.ScalebarLocation.BOTTOM_LEFT,
	xOffset: 5,
	yOffset: 10,
	stayInsideImage: false,
	color: "rgb(150, 150, 150)",
	fontColor: "rgb(255,255,255)",
	backgroundColor: "rgba(100,100, 100, 0.5)",
	fontSize: "small",
	barThickness: 2
});


//--------------------------------------------------
//viewer.addHandler
viewer.addHandler('open', function (event) {
	coronalChosenSlice = viewer.currentPage();
	var elt = document.createElement("div");
	elt.className = "overlay";
	
	if(!viewer.source){return;}
	
	var dimensions = viewer.source.dimensions;
	viewer.addOverlay({
		element: elt,
		location: viewer.viewport.imageToViewportRectangle(new OpenSeadragon.Rect(0, 0, dimensions.x, dimensions.y)),
	});
	$.each(layers, function( key, value ) {
		if (value.index != 0) {
			addLayer(key, value.name, value.ext);
		} else {
			setOpacity(key);
			if(!viewer.referenceStrip){
				viewer.referenceStrip = new OpenSeadragon.ReferenceStrip({
					id:          viewer.referenceStripElement,
					position:    viewer.referenceStripPosition,
					sizeRatio:   viewer.referenceStripSizeRatio,
					scroll:      viewer.referenceStripScroll,
					height:      viewer.referenceStripHeight,
					width:       viewer.referenceStripWidth,
					tileSources: viewer.tileSources,
					prefixUrl:   viewer.prefixUrl,
					viewer:      viewer
				});
				viewer.referenceStrip.setFocus(viewer.currentPage());
			}
		}
		i++;
	});
			
	$(viewer.canvas).off('.posview');
	$(viewer.canvas).on('mousemove.posview', mousemoveHandler);
	
	updateSubVLine(viewer.currentPage());
});
	
viewer.addHandler('resize', function (event) {
	resizeCanvas();
	transform(set);
});

viewer.addHandler('animation', function (event) {
	transform(set);
});
		
viewer.addHandler('add-overlay', function (event) {
	//add overlay is called for each page change
	//alert("Adding overlays");
	//Reference 1): http://chrishewett.com/blog/openseadragon-svg-overlays/
	//addSVGData('./data/SVGs/coronal/Anno_'+(viewer.currentPage()+1)+'.svg',event);
	//var currentPage = viewer.currentPage();
	if(svgFolerName != ""){
		//addSVGData(dataRootPath + "/" + svgFolerName + "/coronal/Anno_"+ (currentPage - coronalFirstIndex ) + ".svg",event);
		addSVGData(PUBLISH_PATH + "/" + svgFolerName + "/Anno_"+ (viewer.currentPage() - coronalFirstIndex ) + ".svg",event);
	}
});

//Handle changing the page; perhaps dynamically load new data at this point
viewer.addHandler('page', function (event) {
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
// position
var mousemoveHandler = function(event) {
	if(viewer.currentOverlays[0] == null){return;}
	var rect = viewer.canvas.getBoundingClientRect();
	//var zoom = viewer.viewport.getZoom(true);
	var zoom = viewer.viewport.getZoom(true) * (viewer.canvas.clientWidth/imageSize);
	position[0].x = event.clientX;
	position[0].y = event.clientY;
	var x = (position[0].x - viewer.currentOverlays[0].position.x - rect.left)/zoom;
	var y = (position[0].y - viewer.currentOverlays[0].position.y - rect.top) /zoom;
	setPoint(x,y);
};

function viewPosition(){
	if(viewer.currentOverlays[0] == null){return;}
	if(ctx==null){ctx = $("#poscanvas")[0].getContext('2d');}
	ctx.clearRect(0, 0, $("#poscanvas")[0].width, $("#poscanvas")[0].height);
	var rect = viewer.canvas.getBoundingClientRect();
	//var zoom = viewer.viewport.getZoom(true);
	var zoom = viewer.viewport.getZoom(true) * (viewer.canvas.clientWidth/imageSize);
	var x = (position[0].x - viewer.currentOverlays[0].position.x - rect.left)/zoom;
	var y = (position[0].y - viewer.currentOverlays[0].position.y - rect.top) /zoom;
	setPoint(x,y);
	
	// distance line
	if(position[0].c == 2){
		var px1 = Math.round((position[1].x * zoom) + viewer.currentOverlays[0].position.x + 0.5)-0.5;
		var py1 = Math.round((position[1].y * zoom) + viewer.currentOverlays[0].position.y + 0.5)-0.5;
		var px2 = Math.round((position[2].x * zoom) + viewer.currentOverlays[0].position.x + 0.5)-0.5;
		var py2 = Math.round((position[2].y * zoom) + viewer.currentOverlays[0].position.y + 0.5)-0.5;
		ctx.beginPath();
		ctx.strokeStyle = "#888";
		ctx.moveTo(px1,py1);
		ctx.lineTo(px2,py2);
		ctx.stroke();
	}
	// cross
	if(position[0].c != 0){
		ctx.beginPath();
		ctx.strokeStyle = "#000";
		for(var i=1;i<=position[0].c;i++){
			var px = Math.round((position[i].x * zoom) + viewer.currentOverlays[0].position.x + 0.5)+0.5;
			var py = Math.round((position[i].y * zoom) + viewer.currentOverlays[0].position.y + 0.5)+0.5;
			ctx.moveTo(px,py - 10);
			ctx.lineTo(px,py + 10);
			ctx.moveTo(px - 10,py);
			ctx.lineTo(px + 10,py);
		}
		ctx.stroke();
		ctx.beginPath();
		ctx.strokeStyle = "#FFF";
		for(var i=1;i<=position[0].c;i++){
			var px = Math.round((position[i].x * zoom) + viewer.currentOverlays[0].position.x + 0.5)-0.5;
			var py = Math.round((position[i].y * zoom) + viewer.currentOverlays[0].position.y + 0.5)-0.5;
			ctx.moveTo(px,py - 10);
			ctx.lineTo(px,py + 10);
			ctx.moveTo(px - 10,py);
			ctx.lineTo(px + 10,py);
		}
		ctx.stroke();
	}
};
	
function resetPositionview(){
	$("#pos1x").text("-");
	$("#pos1y").text("-");
	$("#pos2x").text("-");
	$("#pos2y").text("-");
	$("#posdistance").text("");
	position[0].c = 0;
}

function pointerupHandler(event) {
	if(viewer.currentOverlays.length == 0 || $("#poscanvas").is(":hidden")){
		return;
	}
	
	if( pointerdownpos.x > event.clientX + 5 || pointerdownpos.x < event.clientX - 5 ||
		pointerdownpos.y > event.clientY + 5 || pointerdownpos.y < event.clientY - 5){
		return;
	}
	if(position[0].c == 2){
		resetPositionview();
		viewer.drawer.clear();
		viewer.world.draw();
		viewPosition();
		return;
	}
	var rect = viewer.canvas.getBoundingClientRect();
	//var zoom = viewer.viewport.getZoom(true);
	var zoom = viewer.viewport.getZoom(true) * (viewer.canvas.clientWidth/imageSize);
	var x = (event.clientX - viewer.currentOverlays[0].position.x - rect.left)/zoom;
	var y = (event.clientY - viewer.currentOverlays[0].position.y - rect.top) /zoom;
	position[0].c++
	position[position[0].c].x = x;
	position[position[0].c].y = y;
	setPosition();
	
	// show canvas
	viewPosition();
};

function claerPosition(){
	position[0].c = 2;
	resetPositionview();
	viewer.drawer.clear();
	viewer.world.draw();
	viewPosition();
	return;
}
function setPosition(){
	var pos = [getPointXY(position[1].x,position[1].y),getPointXY(position[2].x,position[2].y)];
	for(var i=1;i<=2;i++){
		if(position[0].c>=i){
			//$("#pos" + i).text("P"+i+": "+(pos[i-1].x+".0").replace(/(\.\d).*$/,"$1") + ", " + (pos[i-1].y+".0").replace(/(\.\d).*$/,"$1"));
			$("#pos"+i+"x").text((pos[i-1].x+".00").replace(/(\.\d{2}).*$/,"$1"));
			$("#pos"+i+"y").text((pos[i-1].y+".00").replace(/(\.\d{2}).*$/,"$1"));
		}else{
			//$("#pos" + i).text("P"+i+": ");
			$("#pos"+i+"x").text("-");
			$("#pos"+i+"y").text("-");
		}
	}
	if(position[0].c == 2){
		$("#posdistance").text((Math.sqrt(Math.pow((pos[0].x - pos[1].x),2) + Math.pow((pos[0].y - pos[1].y),2))+".00").replace(/(\.\d{2}).*$/,"$1"));
	}
}

function pointerdownHandler(event) {
	pointerdownpos.x = event.clientX;
	pointerdownpos.y = event.clientY;
};

//--------------------------------------------------
// range pointer
var position = [{x:0,y:0,c:0},{x:0,y:0},{x:0,y:0}];
var pointOverlay = new Array(2);
var pointerdownpos = {x:0,y:0};
var initPosition = false;
var ctx = null;

viewer.canvas.addEventListener('click', pointerupHandler);
viewer.canvas.addEventListener('pointerdown', pointerdownHandler);
viewer.canvas.addEventListener('mousedown', pointerdownHandler);

var cnv = document.createElement("canvas");
cnv.id = "poscanvas";
if(bHideDelineation == false){
	cnv.style.display = "none";
}
viewer.canvas.appendChild(cnv);
resizeCanvas();

function resizeCanvas(){
	$("#poscanvas").attr({
		'width': viewer.canvas.clientWidth,
		'height': viewer.canvas.clientHeight
	});
	viewPosition();
	
	if(viewer.referenceStrip){
		resetReferenceStrip();
	}
}

function getPoint(x,y){
	var point;
	var tx = imageSize-x;
	var ty = imageSize-y;
	point = new Array(tx,coronalChosenSlice * coronalSliceStep,ty,1);
	//return multiplyMatrixAndPoint(point);
	var result = [0,0,0,0];
	for(var i = 0; i < 4;i++){
		for(var j = 0; j < 4;j++){
		result[i] += (matrix[i*4 + j] * point[j]);
		}
	}
	return result;
}
function getPointXY(x,y){
	var pos = getPoint(x,y);
	return {x:pos[0],y:pos[2]};
}

function setPoint(x,y){
	var pos = getPoint(x,y);
	
	//$("#posnow").html("x: "+(pos[0]+".00").replace(/(\.\d{2}).*$/,"$1") + "<br/>y: "+(pos[1]+".00").replace(/(\.\d{2}).*$/,"$1") + "<br/>z: "+(pos[2]+".00").replace(/(\.\d{2}).*$/,"$1"));
	$("#posX").text(pos[0].toFixed(2));
	$("#posY").text(pos[1].toFixed(2));
	$("#posZ").text(pos[2].toFixed(2));
}

	
//--------------------------------------------------

function updateFilters() {
	if(viewer){
		var processors = [];
		if($('#intensity_slider').val() != "0"){
			processors.push(OpenSeadragon.Filters.BRIGHTNESS(parseFloat($('#intensity_slider').val())));
		}
		if($('#gamma_slider').val() != "10"){
			processors.push(OpenSeadragon.Filters.GAMMA(parseFloat($('#gamma_slider').val())/10.0));
		}
		viewer.setFilterOptions({
			filters: {
				processors: processors,
			}
		});
	}
	$("#intensity_value").val($("#intensity_slider").val());
	$("#gamma_value").val((parseFloat($("#gamma_slider").val())/10.0).toFixed(1));
}
$('#intensity_slider, #gamma_slider').change(updateFilters);
$('#intensity_value, #gamma_value').change(function(){
	$("#gamma_value").val(parseFloat($("#gamma_value").val()).toFixed(1))
	$("#intensity_slider").val($("#intensity_value").val())
	$("#gamma_slider").val($("#gamma_value").val()*10);
	updateFilters();
});

function updateSubVLine(page) {
	var sagittalVLine = sagittalHolderPaper.getById(sagittalVerticalLineId);
	sagittalVLine.transform("T" + (yMaxGlobal-yMinGlobal)*page/(coronalSlideCount - 1) + ",0");
}

function resetReferenceStrip(){
	var _marginLeft = viewer.referenceStrip.element.style.marginLeft.replace('px','');
	var _width = viewer.referenceStrip.element.style.width.replace('px','');

	var _element;
	viewer.referenceStrip.panelWidth  = (viewer.element.clientWidth * viewer.referenceStripSizeRatio) + 8;
	viewer.referenceStrip.panelHeight = (viewer.element.clientHeight * viewer.referenceStripSizeRatio) + 8;
	for ( i = 0; i < viewer.referenceStrip.panels.length; i++ ) {
		_element = viewer.referenceStrip.panels[i];
		_element.style.width  = viewer.referenceStrip.panelWidth + 'px';
		_element.style.height = viewer.referenceStrip.panelHeight + 'px';
		if(viewer.referenceStrip.panels[i].children.length > 0){
			_element = viewer.referenceStrip.panels[i].children[0].children[5];
			_element.style.width  = viewer.referenceStrip.panelWidth + 'px';
			_element.style.height = viewer.referenceStrip.panelHeight + 'px';
		}
	}
	var _newWidth = (viewer.element.clientWidth * 
		viewer.referenceStripSizeRatio * 
		viewer.tileSources.length
		) + ( 12 * viewer.tileSources.length ) + 250;
		viewer.referenceStrip.element.style.width = _newWidth + 'px';
	viewer.referenceStrip.element.style.height = (viewer.element.clientHeight * viewer.referenceStripSizeRatio) + 'px';
	
	// marginLeft
	viewer.referenceStrip.element.style.marginLeft = (_newWidth / _width) * _marginLeft + 'px';
}

function addSVGData(svgName, event){
	paper = Raphael(event.element);
	set = paper.set();
	//clear the set if necessary
	set.remove();
	//load from a file
	var strReturn = "";

	jQuery.ajax({
		url: svgName,
		success: function(html) {
			strReturn = html;
			var root = strReturn.getElementsByTagName('svg')[0];
			//I can get the name and paths
			var paths = root.getElementsByTagName('path');
			for (var i=0;i<paths.length;i++){
				var newSet = paper.importSVG(paths[i]);
				newSet.id = paths[i].getAttribute('id');
				newSet.attr("title",paths[i].getAttribute('id'));
				newSet.attr("fill-opacity",0.4);
			
				//handle the background case
				if (paths[i].getAttribute('id') == "background"){
					newSet.attr("fill-opacity",0.0);
/*					newSet.mouseover(function(e)
					{
						document.getElementById('current_region').innerHTML = this.attr("title");
					});*/
			
					newSet.mouseout(function(e){
						if (selectedRegionName != this.attr("title")){ 
						//	this.attr({"fill-opacity":0.4});
						//	this.attr("stroke-opacity", "1");
						}
					});
					
					newSet.click(function(e) {
						$('#jstree').jstree("deselect_all");
						//userClickedRegion = true;	
						selectedRegionName = "";
						if($('#jstree').jstree(true).clear_search){
							$('#jstree').jstree(true).clear_search();
						}
					});
					set.push(newSet);

				}else{
					newSet.mouseover(function(e){
						/*document.getElementById('current_region').innerHTML = this.attr("title");*/
						this.attr({"fill-opacity":0.8});
						this.attr("stroke-opacity", "1");
					});
			
					newSet.mouseout(function(e){
						if (selectedRegionName != this.attr("title")){ 
							this.attr({"fill-opacity":0.4});
							this.attr("stroke-opacity", "1");
						}
					});
					
					newSet.click(function(e) {
						$('#jstree').jstree("deselect_all");
				 
						set.forEach(function(el){
							el.attr("fill-opacity", "0.4");//works
							el.attr("stroke-opacity", "0");		 
						});
						//$('#jstree').jstree(true).select_node(this.attr("title"));
						//console.log(data.selected[0].offsetTop/2);
						//scroll to correct height
						userClickedRegion = true;	
						selectedRegionName = this.attr("title");
						if($('#jstree').jstree(true).clear_search){
							$('#jstree').jstree(true).clear_search();
						}
						$('#jstree').jstree('select_node', this.attr("title"));	
			
						//this is the correct place for updating the scroll position:
						//TODO: change the value of 100 to some calculation
						$('#jstree').scrollTop(findPosY(document.getElementById(this.attr("title")))
									-findPosY(document.getElementById('jstree'))-$('#jstree').height()/2);
					$('#jstree').scrollLeft(findPosX(document.getElementById(this.attr("title"))));
					this.attr("fill-opacity", "0.8");//works
					this.attr("stroke", "#0000ff");
					//EDIT: Alex, Feb 1, 2017
					//make stroke-width input a variable
					this.attr("stroke-width", "2");//"8");
					this.attr("stroke-opacity", "1");
					//update horizontal position too
					//$.jstree.reference('#jstree').select_node(this.attr("title"));
					});
					set.push(newSet);
				}
			}
		
			reloaded = true;
			//console.log("reloaded");
		},
		async:false
	});

	transform(set);
	//if we have come to a new slice from clicking tree view this should occur:
	setSelection(selectedRegionName,true);
	
	if (bHideDelineation) {
		hideDelineation();
	}
}
	
function sagittalOnerror() {
	//console.log("sagittalOnerror");
	sagittalImg.node.href.baseVal = "./img/no_image.jpg";
}
	
function addSagittalSelectSection(){
	// Mapping global min, max of x,y,z to Sagittal subview
	var minX = yMinGlobal; // X of Sagittal is global Y
	var maxX = yMaxGlobal;
	var sagittalImgFg;
	var img = document.getElementById("sagittal_image");
	img.style.display = "none";
	//boundary
	sagittalHolderPaper = Raphael("sagittal_holder", subviewSize + 20, subviewSize + 20);
	sagittalHolderPaperSet = sagittalHolderPaper.set();
	//relative to the surrounding area
	sagittalImg = sagittalHolderPaper.image(img.src, 10, 10, subviewSize, subviewSize, sagittalOnerror);
	if(subviewFolerName){
		sagittalImg.node.href.baseVal = PUBLISH_PATH + "/" + subviewFolerName + "/subview.jpg";
	}else{
		sagittalImg.node.href.baseVal = "./img/null.png";
	}
	sagittalHolderPaper.image("./img/yz.png", 110, 110, 100, 100);
	sagittalImgFg = sagittalHolderPaper.image("./img/null.png", 10, 10, subviewSize, subviewSize);
	sagittalRect = sagittalHolderPaper.rect(10, 10, subviewSize, subviewSize);
	
//		if (selectedSubview == SAGITTAL) {
//			document.getElementById("sagittal_label").className="sagittalLabel btnOn";	// Select SAGITTAL button (First access)
//		}
	
	var startX = 10 + minX;
	var endX = subviewSize + 10 + 1.5;
	var verticalLine = sagittalHolderPaper.path("M" + startX + ",10L" + startX + "," + endX).attr({
		stroke: colorCoronal,
		"stroke-width": 2.0,	// Vertical line of SAGITTAL subview (CORONAL cross)
		opacity: 1.0
	});
	verticalLine.id = sagittalVerticalLineId;
	
	sagittalHolderPaperSet.push(verticalLine);
	if(coronalSlideCount <= 1){verticalLine.attr('stroke-width',0)}
	
	var transferX = global_Y - startX;
	verticalLine.transform("T" + transferX + ",0");
	
	//set up the line
	//add event handling:
	if(sagittalImgFg){
		sagittalImgFg.mousedown(function(event){
			//find x,y click position
			var bnds = event.target.getBoundingClientRect();
			var fx = (event.clientX - bnds.left)/bnds.width * sagittalImg.attrs.width;
			startX = fx;
			updateSubVview(fx, true);
		});
		
		var dragMove = function (dx, dy, x, y, e) {
			var fx = startX + dx;
			updateSubVview(fx, false);
		};
		var dragStart = function (x, y) {
		}
		var dragEnd = function () {
			viewer.goToPage(coronalFirstIndex + coronalChosenSlice);
		};
		sagittalImgFg.drag(dragMove, dragStart, dragEnd);
	}
}

function updateSubVview(fx, isClick) {
	if (fx <= yMinGlobal){
		coronalChosenSlice = 0;//redundant
	}else if (fx > yMaxGlobal){
		coronalChosenSlice = (coronalSlideCount-1.0);
	}else{
		var percent = (fx-yMinGlobal)/(yMaxGlobal-yMinGlobal);
		coronalChosenSlice = Math.round((coronalSlideCount-1.0)*percent);
	}
	if(coronalSlideCount > 1 && isClick){
		viewer.goToPage(coronalFirstIndex + coronalChosenSlice);
	}
	updateSubVLine(coronalChosenSlice);
}

function updateLinePosBaseSlide(coronalSlide) {
// Coronal subview's image is changed
	var tmpCoronalSlide = coronalSlideCount - 1 - coronalSlide;
	updateSubVLine(tmpCoronalSlide);
}


function transform(el) {
	var zoom = viewer.world.getItemAt(0).viewportToImageZoom(viewer.viewport.getZoom(true));
	//offset based on (8000-5420)/2
	//original method (slow)
	// el.transform('s' + zoom + ',' + zoom + ',0,0t0,1290');
	//fast method
	//https://www.circuitlab.com/blog/2012/07/25/tuning-raphaeljs-for-high-performance-svg-interfaces/
	/*
	One caveat here is that the changes we applied only operate within the SVG module of Raphael. Since CircuitLab doesn't currently support Internet Explorer, this isn't a concern for us, however if you rely on Raphael for IE support you will also have to implement the setTransform() method appropriately in the VML module. Here is a link to the change set that shows the changes discussed in this post.*/
	//NOTE: we should set translate appropriately to the size of the SVG
	paper.setTransform(' scale('+zoom+','+zoom+') translate(0,'+dzDiff+')');//translate(0,1290)');
	//console.log('S' + zoom + ',' + zoom + ',0,0');
	viewPosition();
}

var $infobox = $('.infobox');
$infobox.on('click', '.infobox__close', function(e){
	$infobox.css({
		'top' : '-99999px',
		'left' : '-99999px'
	});
	e.preventDefault();
	e.stopPropagation();
});

viewer.addViewerInputHook({hooks: [
	{tracker: 'viewer', handler: 'scrollHandler', hookHandler: onViewerScroll},
	{tracker: 'viewer', handler: 'clickHandler', hookHandler: onViewerClick}
]});

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

addSagittalSelectSection();



//--------------------------------------------------
// image list
function showImageList(){
	findImageList();
	
	$("#layerEditor").css({top:"20px"});
}

function hideImageList(){
	$("#layerEditor").css({top:""});//-100vh
}

function findImageList(){
	if(!ADMIN_PATH){return;}
	//init form
	$("#ImageList>ul").empty();
	$("#LayerList>select").empty();
	
	$.each(layers,function(key,value){
		var tags = "<option value=\""+key+"\">" + value.name +"</option>";
		$("#LayerList>select").append(tags);
	});
	
	//search
	$.ajax({
		url: "../" + ADMIN_PATH + "findImageGroupList.php",
		type: "POST",
		async: false,
		dataType: 'json',
		data: {
			id: paramId,
		},
		success:function(data){
			if(!data["error"]){
				$.each(data,function(key, value){
					var tags;
					if(layers[this["publish_id"]]){
						tags = "<li><span class=\"selected\" ><img src=\""+ IIPSERVER_PATH + this["publish_id"] + "/" + coronalChosenSlice +  "." + this["extension"] + THUMB_EXTENSION + "\"></span><div class=\"imageName\"><div><input type=\"checkbox\" checked=\"checked\" value=\""+this["publish_id"]+"\"/><span>"+this["display_name"]+"</span></div></div></li>";
					}else{
						tags = "<li><span><img src=\""+ IIPSERVER_PATH + this["publish_id"] + "/" + coronalChosenSlice + "." + this["extension"] + THUMB_EXTENSION + "\"></span><div class=\"imageName\"><div><input type=\"checkbox\" value=\""+this["publish_id"]+"\"/><span>"+this["display_name"]+"</span></div></div></li>";
					}
					editLayers[this["publish_id"]] = {"name":this["display_name"], "ext":"." + this["extension"]};
					
					$("#ImageList>ul").append(tags);
				});
				$("#ImageList>ul>li").click(pushImage);
			}else{
				// is error
				$("#ImageList>ul").append("<li>"+data["error"]+"</li>");
			}
		},
		error:function(data){
			$("#ImageList>ul").append("<li>error</li>");
		}
	});
}

function pushImage(e){
	var checkBox = $(this).find("input");
	if(e.target != checkBox[0]){
		var isCheck = checkBox.prop("checked");
		checkBox.prop("checked",!isCheck);
	}
	
	var option = $("#LayerList>select>option[value='"+checkBox.val()+"']");
	
	if(checkBox.prop("checked")){
		if(option.length == 0){
			checkBox.parents("li").children("span").addClass("selected");
			var tags = "<option value=\""+checkBox.val()+"\">" + checkBox.next().html() +"</option>";
			$("#LayerList>select").append(tags);
		}
	}else if(option){
		checkBox.parents("li").children("span").removeClass("selected");
		option.remove();
	}
}

$("#layerUp").click(function(){
  var selected = $("#LayerList>select>option:selected");
  if(selected.length){
		selected.insertBefore(selected.prev());
	}
});
$("#layerDown").click(function(){
  var selected = $("#LayerList>select>option:selected");
  if(selected.length){
    selected.insertAfter(selected.next())
	}
});

$("#layerCancel").click(hideImageList);

$("#layerSubmit").click(function(){
	var optoins = $("#LayerList>select>option");
	if(optoins.length == 0){return;}
	
	var isFirstChanged = true;
	if(layers[optoins[0].value] && layers[optoins[0].value].index == 0){
		isFirstChanged = false;
	}
	
	var infoSelectedId = false;
	
	viewer.world.removeAll();
	layers = {};
	//dataset = [];
	//datasetIndex = [];
	var newSliderList = [];
	var i = 0;
	$.each(optoins,function(){
		var key = this.value;
		var name = editLayers[key].name;
		var ext = editLayers[key].ext;
		if(i == 0 && isFirstChanged){
			for (var j = 0; j < coronalSlideCount; j++) {
				tileSources[j] = IIPSERVER_PATH + key + "/" + j + ext + TILE_EXTENSION //TILE_EXTENSION;
			}
			viewer.tileSources = tileSources;
		}else{
			addLayer(key, name, ext);
		}
		layers[key] = {"key":key, "name":name, "ext":ext, "index":i++};
		
		var opacity = 0;
		if($("#"+key).length > 0){
			opacity = parseInt($("#"+key).val());
		}
		newSliderList.push({"key":key, "name":name, "opacity":opacity});
		
		if($("#"+key+"Name").hasClass("selected")){
			infoSelectedId = key;
		}
	});
	
	$('#sliderGroup1').empty();
	$.each(newSliderList,function(){
		showSlider(this.key,this.name,this.opacity);
	});
	
	if(infoSelectedId){
		$("#"+infoSelectedId + "Name").addClass("selected");
	}else{
		$("#infoPanelButton>span").html("");
		$("#infoPanelText").html("");
	}
	
	if(viewer.referenceStrip && isFirstChanged){
		viewer.referenceStrip.destroy();
		viewer.referenceStrip = null;
	}
	
	editLayers = {};
	hideImageList();
	viewer.goToPage(coronalChosenSlice);
	
});

