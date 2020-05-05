function setSelection(selectedRegion) {
    var i, j, r = [];
    var found = false;
    var newX = 0;
    var newY = 0;
    var snCount = 0;
    G.set.forEach(function (el) {
        var xvdd = el[0].attr("title");//works
        if (xvdd.trim() == selectedRegion) {
            found = true;
            //move to correct location
            var bbox = el[0].getBBox();
            //console.log("The value is"+bbox.x + " "+bbox.y);
            newX += (bbox.x2 - bbox.width / 2) / G.dzWidth;
            newY += (G.dzDiff + bbox.y2 - bbox.height / 2) / G.dzHeight;
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
        G.viewer.viewport.panTo(windowPoint);
        G.viewer.viewport.zoomTo(1.1);
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
    if (!urlPath || urlPath == null || urlPath.lenght == 0) {
        return;
    }
    // 6 create an instance when the DOM is ready
    $('#jstree').jstree({
        "core": {
            "themes": { "icons": false },
            "data": {
                "url": G.PUBLISH_PATH + urlPath + "/tree.html",
                async: false
            }
        },
        "search": {
            "show_only_matches": true
        },
        "plugins": ["search"]
    });

    var to = false;
    $('#region_search_form').keyup(function () {
        if (to) { clearTimeout(to); }
        to = setTimeout(function () {
            var v = $('#region_search_form').val();
            $('#jstree').jstree(true).search(v);
            $('#jstree').scrollLeft(0);
        }, 250);
    });

    var json_nodeList = $('#jstree').jstree().get_json('#', { 'flat': true });
    for (var i = 0; i < json_nodeList.length; i++) {
        if (json_nodeList[i]['li_attr']['data-regionexists'] == '0') {
            //console.log("tryng to disable");
            $('#jstree').jstree().disable_node(json_nodeList[i]['id']);
        }
    }

    // 7 bind to events triggered on the tree
    $('#jstree').on("changed.jstree", function (e, data) {
        //console.log("user interaction");
        //remove selection on all elements
        G.set.forEach(function (el) {
            if (el[0].attr("title") == "background") {
                el.attr("fill-opacity", "0.0");
            } else {
                el.attr("fill-opacity", "0.4");//works
            }
            el.attr("stroke-opacity", "0");
            el.attr("stroke-width", "0");
        });
        if (data.action == "deselect_all") {
            //console.log("deselect_all");
        } else if (data.action == "select_node") {
            //console.log("select_node");
            if (G.userClickedRegion == false) {
                var i, j;
                var found = false;
                var sRegion = null;
                var i, j, r = [];
                var found = false;

                var node = $('#jstree').jstree(true).get_node(data.selected[0]);
                //handle the case when there are children
                //console.log("testing for children:"+data.selected[0]+"children"+node.children.length)
                if (node.children.length > 0) {
                    var nameList = [];
                    getAllChildrenTexts(data, data.selected[0].trim(), nameList);
                    //how to choose a center?
                    var newX = 0;
                    var newY = 0;
                    var snCount = 0;
                    for (var k = 0; k < nameList.length; k++) {
                        //try to find the nodes -> slow way!
                        G.set.forEach(function (el) {
                            var subNode = el[0];
                            if (el[0].attr("title") == nameList[k]) {
                                snCount++;
                                subNode.attr("fill-opacity", "0.4");//we wont fill this in here
                                subNode.attr("stroke-opacity", "1");
                                subNode.attr("stroke", "#0000ff");
                                //EDIT: Alex, Feb 1, 2017
                                subNode.attr("stroke-width", "2");//"2");
                                var bbox = subNode.getBBox();
                                newX += (bbox.x2 - bbox.width / 2) / G.dzWidth;
                                newY += (G.dzDiff + bbox.y2 - bbox.height / 2) / G.dzHeight;
                            }
                        });
                    }
                    if (snCount > 0) {
                        newX /= snCount;
                        newY /= snCount;
                        var windowPoint = new OpenSeadragon.Point(newX, newY);
                        G.viewer.viewport.panTo(windowPoint);
                        G.viewer.viewport.zoomTo(1.1);
                    }
                } else {
                    //console.log("Has no children");
                    var newX = 0;
                    var newY = 0;
                    var snCount = 0;
                    G.set.forEach(function (el) {
                        var xvdd = el[0].attr("title");//works
                        if (xvdd.trim() == data.selected[0].trim()) {
                            found = true;
                            //move to correct location
                            var bbox = el[0].getBBox();
                            //console.log("The value is"+bbox.x + " "+bbox.y);
                            newX += (bbox.x2 - bbox.width / 2) / G.dzHeight;
                            newY += (G.dzDiff + bbox.y2 - bbox.height / 2) / G.dzHeight;
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
                        G.viewer.viewport.panTo(windowPoint);
                    }
                }
                if (found == false) {
                    //console.log("wasnt found");
                    //check for the first occurence
                    var org_id = data.selected[0].trim();
                    var esc_id = org_id.replace(/(:|\.|\/|\[|\])/g, "\\$1");
                    var nodInfo = $("#" + esc_id);
                    var id_value = nodInfo.attr("id");
                    var firstOccVal = nodInfo.attr("dataFirstOccC");
                    //console.log("Coronal Fv: "+firstOccVal+" id:"+id_value+" :"+data.selected[0]);
                    if (firstOccVal >= 0 && firstOccVal < G.coronalSlideCount) {
                        G.selectedRegionName = data.selected[0].trim();
                        //console.log("firstOccVal " + firstOccVal);
                        G.coronalChosenSlice = parseInt(firstOccVal);
                        G.viewer.goToPage(G.coronalFirstIndex + G.coronalChosenSlice);
                        claerPosition();

                        //coronalImg.node.href.baseVal = dataRootPath + "/" + subviewFolerName +"/coronal/" + coronalChosenSlice + ".jpg";
                        //updateLinePosBaseSlide(coronalChosenSlice);
                        $("#coronal_spinner>input:first-child").val(G.coronalChosenSlice);
                    }
                    //WHILE NOT FOUND IN SETSELECTION, wait a bit and try again
                    //console.log("I made it");
                }
                G.selectedRegionName = data.selected[0].trim();
            }
            G.userClickedRegion = false;
            /*$('#current_region').html(data.selected[0].trim());*/
        } else {
            //console.log("else");
        }
    });
}
