//--------------------------------------------------
// image list
function showImageList() {
	findImageList();

	$("#layerEditor").css({ top: "20px" });
}

function hideImageList() {
	$("#layerEditor").css({ top: "" });//-100vh
}

function findImageList() {
	if (!G.ADMIN_PATH) { return; }
	//init form
	$("#ImageList>ul").empty();
	$("#LayerList>select").empty();

	$.each(G.layers, function (key, value) {
		var tags = "<option value=\"" + key + "\">" + value.name + "</option>";
		$("#LayerList>select").append(tags);
	});

	//search
	$.ajax({
		url: "../" + G.ADMIN_PATH + "findImageGroupList.php",
		type: "POST",
		async: false,
		dataType: 'json',
		data: {
			id: G.paramId,
		},
		success: function (data) {
			if (!data["error"]) {
				$.each(data, function (key, value) {
					var tags;
					if (G.layers[this["publish_id"]]) {
						tags = "<li><span class=\"selected\" ><img src=\"" + G.IIPSERVER_PATH + this["publish_id"] + "/" + G.coronalChosenSlice + "." + this["extension"] + G.THUMB_EXTENSION + "\"></span><div class=\"imageName\"><div><input type=\"checkbox\" checked=\"checked\" value=\"" + this["publish_id"] + "\"/><span>" + this["display_name"] + "</span></div></div></li>";
					} else {
						tags = "<li><span><img src=\"" + G.IIPSERVER_PATH + this["publish_id"] + "/" + G.coronalChosenSlice + "." + this["extension"] + G.THUMB_EXTENSION + "\"></span><div class=\"imageName\"><div><input type=\"checkbox\" value=\"" + this["publish_id"] + "\"/><span>" + this["display_name"] + "</span></div></div></li>";
					}
					G.editLayers[this["publish_id"]] = { "name": this["display_name"], "ext": "." + this["extension"] };

					$("#ImageList>ul").append(tags);
				});
				$("#ImageList>ul>li").click(pushImage);
			} else {
				// is error
				$("#ImageList>ul").append("<li>" + data["error"] + "</li>");
			}
		},
		error: function (data) {
			$("#ImageList>ul").append("<li>error</li>");
		}
	});
}

function pushImage(e) {
	var checkBox = $(this).find("input");
	if (e.target != checkBox[0]) {
		var isCheck = checkBox.prop("checked");
		checkBox.prop("checked", !isCheck);
	}

	var option = $("#LayerList>select>option[value='" + checkBox.val() + "']");

	if (checkBox.prop("checked")) {
		if (option.length == 0) {
			checkBox.parents("li").children("span").addClass("selected");
			var tags = "<option value=\"" + checkBox.val() + "\">" + checkBox.next().html() + "</option>";
			$("#LayerList>select").append(tags);
		}
	} else if (option) {
		checkBox.parents("li").children("span").removeClass("selected");
		option.remove();
	}
}

function imagelistInit() {
	$("#layerUp").click(function () {
		var selected = $("#LayerList>select>option:selected");
		if (selected.length) {
			selected.insertBefore(selected.prev());
		}
	});
	$("#layerDown").click(function () {
		var selected = $("#LayerList>select>option:selected");
		if (selected.length) {
			selected.insertAfter(selected.next())
		}
	});

	$("#layerCancel").click(hideImageList);

	$("#layerSubmit").click(function () {
		var optoins = $("#LayerList>select>option");
		if (optoins.length == 0) { return; }

		var isFirstChanged = true;
		if (G.layers[optoins[0].value] && G.layers[optoins[0].value].index == 0) {
			isFirstChanged = false;
		}

		var infoSelectedId = false;

		G.viewer.world.removeAll();
		G.layers = {};
		//dataset = [];
		//datasetIndex = [];
		var newSliderList = [];
		var i = 0;
		$.each(optoins, function () {
			var key = this.value;
			var name = G.editLayers[key].name;
			var ext = G.editLayers[key].ext;
			if (i == 0 && isFirstChanged) {
				for (var j = 0; j < G.coronalSlideCount; j++) {
					G.tileSources[j] = G.IIPSERVER_PATH + key + "/" + j + ext + G.TILE_EXTENSION //TILE_EXTENSION;
				}
				G.viewer.tileSources = G.tileSources;
			} else {
				addLayer(key, name, ext);
			}
			G.layers[key] = { "key": key, "name": name, "ext": ext, "index": i++ };

			var opacity = 0;
			if ($("#" + key).length > 0) {
				opacity = parseInt($("#" + key).val());
			}
			newSliderList.push({ "key": key, "name": name, "opacity": opacity });

			if ($("#" + key + "Name").hasClass("selected")) {
				infoSelectedId = key;
			}
		});

		$('#sliderGroup1').empty();
		$.each(newSliderList, function () {
			showSlider(this.key, this.name, this.opacity);
		});

		if (infoSelectedId) {
			$("#" + infoSelectedId + "Name").addClass("selected");
		} else {
			$("#infoPanelButton>span").html("");
			$("#infoPanelText").html("");
		}

		if (G.viewer.referenceStrip && isFirstChanged) {
			G.viewer.referenceStrip.destroy();
			G.viewer.referenceStrip = null;
		}

		G.editLayers = {};
		hideImageList();
		G.viewer.goToPage(G.coronalChosenSlice);
		hideInfoPanel();
	});

}