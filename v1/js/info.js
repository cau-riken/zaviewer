
function showInfoText(publicId) {
	$("#infoPanelButton>span").html($("#" + publicId + "Name").html());
	$.ajax({
		url: G.PUBLISH_PATH + publicId + "/info.txt",
		type: "GET",
		dataType: "text",
		success: function (data) {
			$("#infoPanelText").html(data);
		},
		error: function () {
			$("#infoPanelText").html("");
		}
	});
}


function areAllFullyLoaded() {
	var tiledImage;
	var count = G.viewer.world.getItemCount();
	for (var i = 0; i < count; i++) {
		tiledImage = G.viewer.world.getItemAt(i);
		if (!tiledImage.getFullyLoaded()) {
			return false;
		}
	}
	return true;
}



