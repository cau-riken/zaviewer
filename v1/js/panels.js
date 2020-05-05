$(window).load(function() {
	$("#infoPanel").css({"left" : $(".vsplitter").css("left")});
	$(this).bind('splitter.resize', function(e) {
		$("#infoPanel").css({"left" : $(".vsplitter").css("left")});
    });
    //hideInfoPanel();

});



$(window).resize(function(){
	var mh = 3000;
	var mw = 3000;
	var topSpace = 0;
	if (window.innerHeight-topSpace < mh)
	{
		mh = window.innerHeight-topSpace;
	}
	if (window.innerWidth < mw)
	{
		$('#widget').width('100%').height(mh).split({orientation:'vertical', limit:200, position:'20%', minheight:'600px'});
	}
	else
	{
		$('#widget').width(mw).height(mh).split({orientation:'vertical', limit:200, position:'20%', minheight:'600px'});
	}
	windowSizeCheck();
});
	
// Do something after page has loaded
window.onload = function(){
	windowSizeCheck();
	hideInfoPanel();
};


window.onresize = windowSizeCheck;

function windowSizeCheck(){
    //AW 2020/01/26: Added a check to see if info panel is hidden or not
    var infoPanelNowClass = document.getElementById("infoPanel").className;
    //console.log(infoPanelNowClass);
    if ( (window.innerHeight < document.getElementById("infoPanel").clientHeight + 40)
        || infoPanelNowClass == "infoPanel infoPanelHide") {
		hideInfoPanel();
	} else {
		showInfoPanel();
	}
	if ( window.innerHeight < document.getElementById("sliderPanel").clientHeight + 266 ) {
		hideSubviewPanel();
	} else {
		showSubviewPanel();
	}
	if ( window.innerHeight < document.getElementById("sliderPanel").clientHeight + 40 ) {
		hideSliderPanel();
	} else {
		showSliderPanel();
	}
	if ( window.innerHeight < document.getElementById("posviewPanel1").clientHeight + 64) {
		hidePosviewPanel();
	} else {
		showPosviewPanel();
	}
	if ( window.innerHeight < document.getElementById("posviewPanel1").clientHeight + 100) {
		hidePosview2Panel();
	} else {
		showPosview2Panel();
	}
}

// Hide/show Slider panel
function checkSliderPanel(){
	var nowClass = document.getElementById("sliderPanel").className;
	if ( nowClass == "sliderPanel sliderPanelShow") {
		hideSliderPanel();
	} else {
		showSliderPanel();
	}
};
// Hide
function hideSliderPanel() {
		document.getElementById("sliderPanel").className="sliderPanel sliderPanelHide";
		document.getElementById("sliderPanel").style.top="-" + ( document.getElementById("sliderPanel").clientHeight - 35 ) + "px";
		document.getElementById("btnShrinkSliderpanel").style.backgroundPosition="left top";
}
// Show
function showSliderPanel() {
		document.getElementById("sliderPanel").className="sliderPanel sliderPanelShow";
		document.getElementById("sliderPanel").style.top="6px";
		document.getElementById("btnShrinkSliderpanel").style.backgroundPosition="left bottom";
}

// Hide/show subview panel
function checkSubviewPanel(){
	var nowClass = document.getElementById("subviewPanel").className;
	if ( nowClass == "subviewPanel subviewPanelShow") {
		hideSubviewPanel();
	} else {
		showSubviewPanel();
	}
};
// Hide
function hideSubviewPanel() {
		document.getElementById("subviewPanel").className="subviewPanel subviewPanelHide";
		document.getElementById("btnShrinkSubviewpanel").style.backgroundPosition="left top";
}
// Show
function showSubviewPanel() {
		document.getElementById("subviewPanel").className="subviewPanel subviewPanelShow";
		document.getElementById("btnShrinkSubviewpanel").style.backgroundPosition="left bottom";
}

// Hide/show info panel
function checkInfoPanel(){
	var nowClass = document.getElementById("infoPanel").className;
	if ( nowClass == "infoPanel infoPanelShow") {
		hideInfoPanel();
	} else {
		showInfoPanel();
    }
};
// Hide
function hideInfoPanel() {
		document.getElementById("infoPanel").className="infoPanel infoPanelHide";
		document.getElementById("infoPanel").style.top="-" + ( document.getElementById("infoPanel").clientHeight - 23 ) + "px";
        document.getElementById("btnShrinkInfoPanel").style.backgroundPosition="left top";
}
// Show
function showInfoPanel() {
		document.getElementById("infoPanel").className="infoPanel infoPanelShow";
		document.getElementById("infoPanel").style.top="6px";
		document.getElementById("btnShrinkInfoPanel").style.backgroundPosition="left bottom";
}

// Hide
function hidePosviewPanel() {
		document.getElementById("posviewPanel").style.top="-" + ( document.getElementById("posviewPanel").clientHeight - 24 ) + "px";
}
// Show
function showPosviewPanel() {
		document.getElementById("posviewPanel").style.top="";
}

// Hide/show Posview panel
function checkPosviewPanel(){
	if ( document.getElementById("posviewPanel2").className == "posviewPanel posviewPanelShow") {
		hidePosview2Panel();
	} else {
		showPosview2Panel();
	}
};
// Hide
function hidePosview2Panel() {
		document.getElementById("posviewPanel2").className="posviewPanel posviewPanelHide";
		document.getElementById("posviewPanel2").style.height="24px";
		//document.getElementById("posDis").style.marginBottom="2px";
		document.getElementById("btnShrinkPosviewpanel").style.backgroundPosition="left top";
}
// Show
function showPosview2Panel() {
		document.getElementById("posviewPanel2").className="posviewPanel posviewPanelShow";
		document.getElementById("posviewPanel2").style.height="";
		//document.getElementById("posDis").style.marginBottom="";
		document.getElementById("btnShrinkPosviewpanel").style.backgroundPosition="left bottom";
}	
