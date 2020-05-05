function updateSubVLine(page) {
    var sagittalVLine = G.sagittalHolderPaper.getById(G.sagittalVerticalLineId);
    sagittalVLine.transform("T" + (G.yMaxGlobal - G.yMinGlobal) * page / (G.coronalSlideCount - 1) + ",0");
}

function resetReferenceStrip() {
    var _marginLeft = G.viewer.referenceStrip.element.style.marginLeft.replace('px', '');
    var _width = G.viewer.referenceStrip.element.style.width.replace('px', '');

    var _element;
    G.viewer.referenceStrip.panelWidth = (G.viewer.element.clientWidth * G.viewer.referenceStripSizeRatio) + 8;
    G.viewer.referenceStrip.panelHeight = (G.viewer.element.clientHeight * G.viewer.referenceStripSizeRatio) + 8;
    for (i = 0; i < G.viewer.referenceStrip.panels.length; i++) {
        _element = G.viewer.referenceStrip.panels[i];
        _element.style.width = G.viewer.referenceStrip.panelWidth + 'px';
        _element.style.height = G.viewer.referenceStrip.panelHeight + 'px';
        if (G.viewer.referenceStrip.panels[i].children.length > 0) {
            _element = G.viewer.referenceStrip.panels[i].children[0].children[5];
            _element.style.width = G.viewer.referenceStrip.panelWidth + 'px';
            _element.style.height = G.viewer.referenceStrip.panelHeight + 'px';
        }
    }
    var _newWidth = (G.viewer.element.clientWidth *
        G.viewer.referenceStripSizeRatio *
        G.viewer.tileSources.length
    ) + (12 * G.viewer.tileSources.length) + 250;
    G.viewer.referenceStrip.element.style.width = _newWidth + 'px';
    G.viewer.referenceStrip.element.style.height = (G.viewer.element.clientHeight * G.viewer.referenceStripSizeRatio) + 'px';

    // marginLeft
    G.viewer.referenceStrip.element.style.marginLeft = (_newWidth / _width) * _marginLeft + 'px';
}

function addSVGData(svgName, event) {
    G.paper = Raphael(event.element);
    G.set = G.paper.set();
    //clear the set if necessary
    G.set.remove();
    //load from a file
    var strReturn = "";
    console.log("svg");

    jQuery.ajax({
        url: svgName,
        success: function (html) {
            strReturn = html;
            var root = strReturn.getElementsByTagName('svg')[0];
            //I can get the name and paths
            var paths = root.getElementsByTagName('path');
            for (var i = 0; i < paths.length; i++) {
                var newSet = G.paper.importSVG(paths[i]);
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
                        if (G.selectedRegionName != this.attr("title")) {
                            //	this.attr({"fill-opacity":0.4});
                            //	this.attr("stroke-opacity", "1");
                        }
                    });

                    newSet.click(function (e) {
                        $('#jstree').jstree("deselect_all");
                        //userClickedRegion = true;	
                        G.selectedRegionName = "";
                        if ($('#jstree').jstree(true).clear_search) {
                            $('#jstree').jstree(true).clear_search();
                        }
                    });
                    G.set.push(newSet);

                } else {
                    newSet.mouseover(function (e) {
                        /*document.getElementById('current_region').innerHTML = this.attr("title");*/
                        this.attr({ "fill-opacity": 0.8 });
                        this.attr("stroke-opacity", "1");
                    });

                    newSet.mouseout(function (e) {
                        if (G.selectedRegionName != this.attr("title")) {
                            this.attr({ "fill-opacity": 0.4 });
                            this.attr("stroke-opacity", "1");
                        }
                    });

                    newSet.click(function (e) {
                        $('#jstree').jstree("deselect_all");

                        G.set.forEach(function (el) {
                            el.attr("fill-opacity", "0.4");//works
                            el.attr("stroke-opacity", "0");
                        });
                        //$('#jstree').jstree(true).select_node(this.attr("title"));
                        //console.log(data.selected[0].offsetTop/2);
                        //scroll to correct height
                        G.userClickedRegion = true;
                        G.selectedRegionName = this.attr("title");
                        if ($('#jstree').jstree(true).clear_search) {
                            $('#jstree').jstree(true).clear_search();
                        }
                        $('#jstree').jstree('select_node', this.attr("title"));

                        //this is the correct place for updating the scroll position:
                        //TODO: change the value of 100 to some calculation
                        $('#jstree').scrollTop(findPosY(document.getElementById(this.attr("title")))
                            - findPosY(document.getElementById('jstree')) - $('#jstree').height() / 2);
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
                    G.set.push(newSet);
                }
            }

            G.reloaded = true;
            //console.log("reloaded");
        },
        async: false
    });

    transform(G.set);
    //if we have come to a new slice from clicking tree view this should occur:
    setSelection(G.selectedRegionName, true);

    if (G.bHideDelineation) {
        hideDelineation();
    }

}

function sagittalOnerror() {
    //console.log("sagittalOnerror");
    G.sagittalImg.node.href.baseVal = "./img/no_image.jpg";
}

function addSagittalSelectSection() {
    // Mapping global min, max of x,y,z to Sagittal subview
    var minX = G.yMinGlobal; // X of Sagittal is global Y
    var maxX = G.yMaxGlobal;
    var sagittalImgFg;
    var img = document.getElementById("sagittal_image");
    img.style.display = "none";
    //boundary
    G.sagittalHolderPaper = Raphael("sagittal_holder", G.subviewSize + 20, G.subviewSize + 20);
    G.sagittalHolderPaperSet = G.sagittalHolderPaper.set();
    //relative to the surrounding area
    G.sagittalImg = G.sagittalHolderPaper.image(img.src, 10, 10, G.subviewSize, G.subviewSize, sagittalOnerror);
    if (G.subviewFolerName) {
        G.sagittalImg.node.href.baseVal = G.PUBLISH_PATH + "/" + G.subviewFolerName + "/subview.jpg";
    } else {
        G.sagittalImg.node.href.baseVal = "./img/null.png";
    }
    G.sagittalHolderPaper.image("./img/yz.png", 110, 110, 100, 100);
    sagittalImgFg = G.sagittalHolderPaper.image("./img/null.png", 10, 10, G.subviewSize, G.subviewSize);
    G.sagittalRect = G.sagittalHolderPaper.rect(10, 10, G.subviewSize, G.subviewSize);

    //		if (selectedSubview == SAGITTAL) {
    //			document.getElementById("sagittal_label").className="sagittalLabel btnOn";	// Select SAGITTAL button (First access)
    //		}

    var startX = 10 + minX;
    var endX = G.subviewSize + 10 + 1.5;
    var verticalLine = G.sagittalHolderPaper.path("M" + startX + ",10L" + startX + "," + endX).attr({
        stroke: G.colorCoronal,
        "stroke-width": 2.0,	// Vertical line of SAGITTAL subview (CORONAL cross)
        opacity: 1.0
    });
    verticalLine.id = G.sagittalVerticalLineId;

    G.sagittalHolderPaperSet.push(verticalLine);
    if (G.coronalSlideCount <= 1) { verticalLine.attr('stroke-width', 0) }

    var transferX = G.global_Y - startX;
    verticalLine.transform("T" + transferX + ",0");

    //set up the line
    //add event handling:
    if (sagittalImgFg) {
        sagittalImgFg.mousedown(function (event) {
            //find x,y click position
            var bnds = event.target.getBoundingClientRect();
            var fx = (event.clientX - bnds.left) / bnds.width * G.sagittalImg.attrs.width;
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
            G.viewer.goToPage(G.coronalFirstIndex + G.coronalChosenSlice);
        };
        sagittalImgFg.drag(dragMove, dragStart, dragEnd);
    }
}

function updateSubVview(fx, isClick) {
    if (fx <= G.yMinGlobal) {
        G.coronalChosenSlice = 0;//redundant
    } else if (fx > G.yMaxGlobal) {
        G.coronalChosenSlice = (G.coronalSlideCount - 1.0);
    } else {
        var percent = (fx - G.yMinGlobal) / (G.yMaxGlobal - G.yMinGlobal);
        G.coronalChosenSlice = Math.round((G.coronalSlideCount - 1.0) * percent);
    }
    if (G.coronalSlideCount > 1 && isClick) {
        G.viewer.goToPage(G.coronalFirstIndex + G.coronalChosenSlice);
    }
    $("#sagittal_spinner>input:first-child").val(G.coronalChosenSlice);
    updateSubVLine(G.coronalChosenSlice);
    //AW(2010/01/16): Added this code to call a tile-drawn event, which then calls updateFilters
    G.viewer.addHandler('tile-drawn', G.tileDrawnHandler);
}

function updateLinePosBaseSlide(coronalSlide) {
    // Coronal subview's image is changed
    var tmpCoronalSlide = G.coronalSlideCount - 1 - coronalSlide;
    updateSubVLine(tmpCoronalSlide);
}


function transform(el) {
    var zoom = G.viewer.world.getItemAt(0).viewportToImageZoom(G.viewer.viewport.getZoom(true));
    //offset based on (8000-5420)/2
    //original method (slow)
    // el.transform('s' + zoom + ',' + zoom + ',0,0t0,1290');
    //fast method
    //https://www.circuitlab.com/blog/2012/07/25/tuning-raphaeljs-for-high-performance-svg-interfaces/
	/*
	One caveat here is that the changes we applied only operate within the SVG module of Raphael. Since CircuitLab doesn't currently support Internet Explorer, this isn't a concern for us, however if you rely on Raphael for IE support you will also have to implement the setTransform() method appropriately in the VML module. Here is a link to the change set that shows the changes discussed in this post.*/
    //NOTE: we should set translate appropriately to the size of the SVG
    G.paper.setTransform(' scale(' + zoom + ',' + zoom + ') translate(0,' + G.dzDiff + ')');//translate(0,1290)');
    //console.log('S' + zoom + ',' + zoom + ',0,0');
    viewPosition();
}

function changeSpinner(id) {
    var num = parseInt($("#" + id + ">input:first-child").val());
    var old = num;
    switch (id) {
        case "sagittal_spinner":
            if (num > (G.coronalSlideCount - 1)) {
                num = G.coronalSlideCount - 1;
            } else if (num < 0) {
                num = 0;
            }
            if (G.coronalChosenSlice != num) {
                G.coronalChosenSlice = num;
                //sagittalImg.node.href.baseVal = dataRootPath + "/" + subviewFolerName +"/sagittal/" + sagittalChosenSlice + ".jpg";
                updateLinePosBaseSlide(-1, -1, G.coronalChosenSlice);
                //if(selectedSubview == SAGITTAL){
                G.viewer.goToPage(G.coronalFirstIndex + G.coronalChosenSlice);
                //}
            }
            break;
    }
    if (old != num) {
        $("#" + id + ">input:first-child").val(num);
    }
}



function subviewsInit() {
    $(document).on('keydown', '.spinner-input', function (e) {
        var k = e.keyCode;
        // 0~9,t0~t9,arrow,BS,DLL
        if (!((k >= 48 && k <= 57) || (k >= 96 && k <= 105) || (k >= 37 && k <= 40) || k == 8 || k == 46)) {
            return false;
        }
    });
    $(document).on('keyup', '.spinner-input', function (e) {
        $(this).val($(this).val().replace(/[^\d]|^0+/g, ""));
        if ($(this).val() == "") { $(this).val("0"); }
        if (e.which == 38) { // up-arrow
            $(this).val((parseInt($(this).val()) + 1));
        } else if (e.which == 40) { // down-arrow
            $(this).val((parseInt($(this).val()) - 1));
        }
        changeSpinner(this.parentElement.id);
    });
    /*
    $(document).on('click', '.spinner-button', function(){
        var target = $(this).siblings(':first');
        target.val(target.val().replace(/[^\d]/g,""));
        if(target.val() == ""){target.val("0");}
        if ($(this).hasClass('spinner-up')){
            target.val((parseInt(target.val()) + 1));
        }else{
            target.val((parseInt(target.val()) - 1));
        }
        changeSpinner(this.parentElement.id);
        return false;
    });*/
    var intervalID = null;
    var timeoutID = 0;
    var spinnerTarget = null;
    $(document).on('mousedown', '.spinner-button', function () {
        //console.log("mousedown");
        if (intervalID == null) {
            spinnerTarget = this;
            setSpinner(true);
            intervalID = setInterval(function () {
                setSpinner();
            }, 150);
            timeoutID = setTimeout(function () {
                timeoutID = null;
            }, 500);
        }
    });
    function setSpinner(force) {
        //console.log("setSpinner");
        if (spinnerTarget != null && (timeoutID == null || force == true)) {
            var target = $(spinnerTarget).siblings(':first');
            target.val(target.val().replace(/[^\d]/g, ""));
            if (target.val() == "") { target.val("0"); }
            if ($(spinnerTarget).hasClass('spinner-up')) {
                target.val((parseInt(target.val()) + 1));
            } else {
                target.val((parseInt(target.val()) - 1));
            }
            changeSpinner(spinnerTarget.parentElement.id);
        }
    }
    $(document).on('mouseup', function () {
        clearInterval(intervalID);
        clearInterval(timeoutID);
        intervalID = null;
        timeoutID = 0;
        spinnerTarget = null;
        //console.log("clearInterval");
    });

}


