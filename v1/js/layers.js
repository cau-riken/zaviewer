//Stuff for layers
function hideShow() {
    if (G.set) {
        if (G.bHideDelineation == false) {
            G.set.forEach(function (el) {
                el.hide();
                $("#poscanvas").show();
            });

            $("#btnHideShow").html('Show regions');
        } else {
            G.set.forEach(function (el) {
                el.show();
                $("#poscanvas").hide();
            });

            $("#btnHideShow").html('Hide regions');
        }
        G.bHideDelineation = !G.bHideDelineation;
    }
}

function hideDelineation() {
    G.set.forEach(function (el) {
        el.hide();
    });
}

function addLayer(key, name, ext) {
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
        //tileSource:dataRootPath + "/" + layerName + "/coronal/" + G.viewer.currentPage() +".dzi",
        tileSource: G.IIPSERVER_PATH + key + "/" + G.viewer.currentPage() + ext + G.TILE_EXTENSION,// +  TILE_EXTENSION,
        //opacity: ($('#' + key).val()/100),
        opacity: getOpacity(key),
    };

    var addLayerHandler = function (event) {
        G.viewer.world.removeHandler("add-item", addLayerHandler);
        G.layers[key].name = name;
        updateFilters();
    };
    G.viewer.world.addHandler("add-item", addLayerHandler);
    G.viewer.addTiledImage(options);

}
//End of layer stuff
