function showSlider(key, name, opacity) {
    var html = "";
    html += "<div class=\"dataset\">";
    html += "<span id=\"" + key + "Name\">" + name + "</span>";
    html += "<br/>";
    html += "<div>";
    html += "<div>";
    html += "<input type=\"checkbox\" id=\"" + key + "Enabled\" class=\"opcChk\" checked/>";
    html += "</div>";
    html += "<div>";
    html += "<input type=\"range\" id=\"" + key + "\" class=\"slider\" value=\"" + opacity + "\" />";
    html += "</div>";
    html += "<input type=\"text\" id=\"" + key + "Opacity\" class=\"opacity\" value=\"" + opacity + "\" />";
    html += "</div>";
    html += "</div>";
    $('#sliderGroup1').append(html);

    //Opacity
    $(document).on('input', '#' + key, function () {
        G.inputEvent = true;
        if (G.layers[key]) {
            setOpacity(key);
        }
    });
    $(document).on('change', '#' + key, function () {
        if (!G.inputEvent) { // IE not work with input event
            if (G.layers[key]) {
                setOpacity(key);
            }
        }
    });

    $(document).on('change', '#' + key + "Enabled", function () {
        if ($('#sliderGroup1 [class="opcChk"]:not(:checked)').length == 0) {
            $.each(G.layers, function (key) {
                //viewer.world.getItemAt(layers[key].index).setOpacity(getOpacity(key));
                setOpacity(key);
            });
        } else {
            $('#sliderGroup1 [class="opcChk"]').each(function (key) {
                var slider = $(this).parent().parent().find("input.slider");
                setOpacity(slider.attr("id"));
            });
        }
    });
    $(document).on('change', '#' + key + "Opacity", function () {
        $("#" + key).val($(this).val());
        setOpacity(key);
    });

    //name
    $(document).on('mousedown', '#' + key + "Name", function () {
        if (!$(this).hasClass("selected")) {
            $('#sliderGroup1 span[class="selected"]').map(function () {
                $(this).removeClass("selected");
            })
            $(this).addClass("selected");
            var matchList = this.id.match(/^(.*)Name$/);
            if (matchList != null && matchList[1]) {
                showInfoText(matchList[1]);
            }
        }
    });
}

function getOpacity(key) {
    var opacity = 0;
    if (G.layers[key]) {
        if ($("#" + key + "Enabled").prop("checked") || $('#sliderGroup1 [class="opcChk"]:checked').length == 0) {
            opacity = $('#' + key).val() / 100;
        }
    }
    return opacity;
}

function setOpacity(key) {
    if (G.layers[key]) {
        var opacity = getOpacity(key);
        $("#" + key + "Opacity").val(parseInt(opacity * 100));
        if (G.viewer.world.getItemAt(G.layers[key].index)) {
            G.viewer.world.getItemAt(G.layers[key].index).setOpacity(opacity);
        }
    }
}
