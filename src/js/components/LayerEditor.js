import React from 'react';


class LayerEditor extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {

        imageGroupListError
        const layers = [];
        const tags = [];
        if (this.props.config) {
            const config = this.props.config;

            $.each(config.layers, function (key, value) {
                layers.push(<option value={key}>{value.name}</option>)
            });


            $.each(config.imageGroupListData, function (key, value) {

                if (config.layers[this["publish_id"]]) {

                    tags.push(
                        <li>
                            <span class="selected" >
                                <img src={Utils.makePath(config.IIPSERVER_PATH, this["publish_id"], config.coronalChosenSlice + "." + this["extension"], config.THUMB_EXTENSION)} />
                            </span>
                            <div className="imageName">
                                <div>
                                    <input type="checkbox" checked="checked" value={this["publish_id"]} />
                                    <span>{this["display_name"]}</span>
                                </div>
                            </div>
                        </li>
                    );

                } else {

                    tags.push(
                        <li>
                            <span class="selected" >
                                <img src={Utils.makePath(config.IIPSERVER_PATH, this["publish_id"], config.coronalChosenSlice + "." + this["extension"], config.THUMB_EXTENSION)} />
                            </span>
                            <div className="imageName">
                                <div>
                                    <input type="checkbox" value={this["publish_id"]} />
                                    <span>{this["display_name"]}</span>
                                </div>
                            </div>
                        </li>
                    );

                }

            });

            //FIXME $("#ImageList>ul>li").click(pushImage);

            if (config.imageGroupListError) {
                tags = [config.imageGroupListError];
            }
        }

        return (
            <div id="layerEditor">
                <div id="GroupName">Image Group Name</div>
                <div id="ImageArea">
                    <div id="ImageList">
                        <ul>
                            {tags}
                        </ul>
                    </div>
                    <div id="LayerList">
                        <select size="10">
                            {layers}
                        </select>
                        <div>
                            <input type="button" id="layerUp" value="Up" />
                            <input type="button" id="layerDown" value="Down" />
                        </div>
                        <div id="layerButton2">
                            <input type="button" id="layerSubmit" value="Submit" />
                            <input type="button" id="layerCancel" value="Cancel" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    //FIXME
    /*

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
*/
}

export default LayerEditor;
