//globals.js
//regions.js
//layers.js
//layersSliders.js
//info.js
//viewerInit.js
//position.js
//subviews.js
//imagelist.js


if (window.innerHeight - G.topSpace < G.mh) {
	G.mh = window.innerHeight - G.topSpace;
}
if (window.innerWidth < G.mw) {
	$('#widget').width('100%').height(G.mh).split({ orientation: 'vertical', limit: 200, position: '20%', minheight: '600px' });
} else {
	$('#widget').width(G.mw).height(G.mh).split({ orientation: 'vertical', limit: 200, position: '20%', minheight: '600px' });
}
$('#foo').split({ orientation: 'horizontal', position: '10px' });


// getParam
var url = location.search.substring(1).split('&');
for (i = 0; url[i]; i++) {
	var k = url[i].split('=');
	if (k[0] == "id") {
		G.paramId = k[1];
		break;
	}
}


$(document).ready(function () {
	//	updateFilters();
});

$.ajax({
	url: "../path.json",
	type: "GET",
	async: false,
	dataType: 'json',
	success: function (response) {
		G.ADMIN_PATH = response.admin_path;
		G.IIPSERVER_PATH = response.iipserver_path;
		G.PUBLISH_PATH = response.publish_path;
		$.ajax({
			url: "../" + G.ADMIN_PATH + "json.php",
			type: "POST",
			async: false,
			dataType: 'json',
			data: {
				id: G.paramId,
			},
			success: function (response) {
				if (response.error) {
					console.log(response.error);
				}
				createTree(response.tree);

				//dataRootPath = response.data_root_path;
				if (response.subview) { G.subviewFolerName = response.subview.foldername; }
				G.coronalSlideCount = response.slide_count;
				//sagittalSlideCount = response.subview.sagittal_slide;


				//axialFirstIndex = 0;
				G.coronalFirstIndex = 0;//axialFirstIndex;
				//sagittalFirstIndex = coronalFirstIndex + coronalSlideCount;

				var subviewOrgSize = (response.subview && response.subview.size) ? response.subview.size : 200;
				G.subviewZoomRatio = subviewOrgSize / G.subviewSize;
				//		xMinGlobal = (response.subview.x_min ? response.subview.x_min : 0) / subviewZoomRatio;
				//		xMaxGlobal = (response.subview.x_max ? response.subview.x_max : subviewOrgSize) / subviewZoomRatio;
				G.yMinGlobal = (response.subview && response.subview.y_min ? response.subview.min : 0) / G.subviewZoomRatio;
				G.yMaxGlobal = (response.subview && response.subview.y_max ? response.subview.max : subviewOrgSize) / G.subviewZoomRatio;
				//		zMinGlobal = (response.subview.z_min ? response.subview.z_min : 0) / subviewZoomRatio;
				//		zMaxGlobal = (response.subview.z_max ? response.subview.z_max : subviewOrgSize) / subviewZoomRatio;

				if (response.delineations) {
					G.svgFolerName = response.delineations;
				} else {
					$("#btnHideShow").hide();
				}

				G.matrix = response.matrix ? response.matrix.split(",") : G.matrix;
				//console.log(matrix);
				//axialSliceStep = response.axial_slice_step;
				G.coronalSliceStep = response.slice_step;
				//sagittalSliceStep = response.sagittal_slice_step;

				G.imageSize = response.image_size ? response.image_size : G.imageSize;
				G.dzWidth = G.imageSize;
				G.dzHeight = G.imageSize;
				G.dzLayerWidth = G.imageSize;
				G.dzLayerHeight = G.imageSize;

				if (response.data) {
					var i = 0;
					$.each(response.data, function (key, value) {
						showSlider(key, value.metadata, value.opacity);

						// only firstLayer
						if (i == 0) {
							showInfoText(key);
							$("#" + key + "Name").addClass("selected");
							for (var j = 0; j < G.coronalSlideCount; j++) {
								//G.tileSources.push(dataRootPath + "/" + key + "/coronal/" + key +"_Coronal_" + j +".dzi");
								G.tileSources.push(G.IIPSERVER_PATH + key + "/" + j + "." + value.extension + G.TILE_EXTENSION);
								//G.tileSources.push("http://210.230.211.213/iipsrv/iipsrv.fcgi?IIIF=/group3/ptiffs/red/" + j + ".ptif/info.json");
							}
						}
						//dataset[key] = value.metadata;
						//datasetIndex[key] = i++;
						G.layers[key] = { "name": value.metadata, "ext": "." + value.extension, "index": i++ };
					});

				}

				if (response.first_access) {
					//accessData = response.first_access.data ? response.first_access.data : "coronal";
					G.initialSlice = parseInt(response.first_access.slide ? response.first_access.slide : 30);
					if (response.first_access.delineations == "hide") {
						G.bHideDelineation = true;
						$("#btnHideShow").html('Show regions');
					}

					//		selectedSubview = CORONAL;
					G.coronalChosenSlice = G.initialSlice;
					G.initialSlice += G.coronalFirstIndex;
					//global_X = 10 + zMaxGlobal;
					G.global_Y = 10 + (G.coronalSlideCount - response.first_access.slide) * (G.yMaxGlobal - G.yMinGlobal) / G.coronalSlideCount + G.yMinGlobal;
					//global_Z = 10 + xMinGlobal;
				}

				//$("#axial_holder").hide();
				//$("#coronal_holder").hide();
				if (G.coronalSlideCount == 0) { $("#sagittal_holder").hide(); }
				else if (G.coronalSlideCount == 1) {
					$("#sagittal_spinner").hide();
					$("#sagittal_spinner_max").hide();
				} else {
					$("#sagittal_spinner>input").val(G.coronalChosenSlice);
					$("#sagittal_spinner>input").attr('maxlength', ((String)(G.coronalSlideCount - 1)).length);
					$("#sagittal_spinner_max").html(G.coronalSlideCount - 1);
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
			}//success
		});
	}//success
});

viewerInit()

positionInit();
subviewsInit();
addSagittalSelectSection();

G.$infobox = $('.infobox');
G.$infobox.on('click', '.infobox__close', function (e) {
	G.$infobox.css({
		'top': '-99999px',
		'left': '-99999px'
	});
	e.preventDefault();
	e.stopPropagation();
});

imagelistInit();


