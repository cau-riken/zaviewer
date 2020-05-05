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
var G = (function () {

    var _subviewSize = 200;
    var _subviewZoomRatio = 200 / _subviewSize;

    return {
        set : undefined,
        paper: undefined,

        //var axialHolderPaper;
        //var axialHolderPaperSet;
        //var axialRect;
        //var coronalHolderPaper;
        //var coronalHolderPaperSet;
        //var coronalRect;
        sagittalHolderPaper: undefined,
        sagittalHolderPaperSet: undefined,
        sagittalRect: undefined,

        inputEvent : false,

        bHideDelineation : false, // true if delineation is hide

        userClickedRegion : false,
        selectedRegionName : "",
        reloaded : false,
        layers : {},
        editLayers : {},
        //var firstLayer;

        //ALEX
        dzWidth : 1000.0, //Jan 31, 2017 edit//1800.0;//8000.0;
        dzHeight : 1000.0, //Jan 31, 2017 edit//1800.0;//8000.0;
        dzDiff : 0,//1290.0;

        //ALEX: NOTE TO NEXTECH, why this seems to work when dzLayerWidth and dzLayerHeight are set to 2000?
        //var dzLayerWidth = 2000;//1800; 
        //var dzLayerHeight = 2000;//1800;
        dzLayerWidth : 1000,
        dzLayerHeight : 1000,

        tileSources :[],

        //var axialImg;
        //var coronalImg;
        sagittalImg: undefined,

        //var axialChosenSlice = 0;
        coronalChosenSlice : 0,
        //var sagittalChosenSlice = 0;

        //var dataset = {}; // key -> object {axial_slide, coronal_slide, sagittal_slide}
        //var datasetIndex = {}; // Save index of "key" in dataset
        subviewFolerName: undefined,
        coronalSlideCount: undefined,
        svgFolerName: undefined,

        //var PUBLISH_PATH = "./data/publish/";
        //var FILE_EXTENSION =  ".dzi";
        IIPSERVER_PATH: undefined,//"/iipsrv/iipsrv.fcgi?IIIF=/data/publish/";
        PUBLISH_PATH: undefined,//"../data/publish/";
        ADMIN_PATH: undefined,
        TILE_EXTENSION : "/info.json", //".ptif/info.json";
        THUMB_EXTENSION : "/full/250,/0/default.jpg", //".ptif/full/250,/0/default.jpg";

        sagittalVerticalLineId : 'sagittal_vertical_line',

        //var AXIAL = 0;
        //var CORONAL = 1;
        //var SAGITTAL = 2;
        coronalFirstIndex: undefined, // the first index of Coronal of selected dataset
        initialSlice : 0,

        //var global_X = 0; // Red
        global_Y : 0, // Green
        //var global_Z = 0; // Blue

        colorCoronal : "#ff4444",		// Coronal Red
        //var colorSagittal = "#3399ff";		// Sagittal Blue

        subviewSize : _subviewSize,
        subviewZoomRatio : _subviewZoomRatio, // 600*600 is real size of subview image
        yMinGlobal : 5 / _subviewZoomRatio,  // 5~585 is range of Y in Axial and X in Sagittal subview image
        yMaxGlobal : 585 / _subviewZoomRatio,

        matrix :[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        coronalSliceStep : 1,
        imageSize : 1000,

        //EDIT by Nextech: Set width and height for openseadragon1 div before creating viewer
        mh : 3000,// max height
        mw : 3000,// max width
        topSpace : 0,

        paramId : "",


        viewer: undefined,
        mousemoveHandler: undefined,

        // range pointer
        position :[{ x: 0, y: 0, c: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
        
        //var pointOverlay = new Array(2);
        pointerdownpos : { x: 0, y: 0 },
        initPosition : false,
        ctx : null,

        tileDrawnHandler: undefined,

        isFullyLoaded : false,
    };
})();
