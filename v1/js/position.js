//--------------------------------------------------
// position


function viewPosition() {
    if (G.viewer.currentOverlays[0] == null) { return; }
    if (G.ctx == null) { 
        //FPa 20200504 
        G.ctx = $("#poscanvas")[0].getContext('2d'); 
    }
    G.ctx.clearRect(0, 0, $("#poscanvas")[0].width, $("#poscanvas")[0].height);
    
    var rect = G.viewer.canvas.getBoundingClientRect();
    //var zoom = viewer.viewport.getZoom(true);
    var zoom = G.viewer.viewport.getZoom(true) * (G.viewer.canvas.clientWidth / G.imageSize);
    var x = (G.position[0].x - G.viewer.currentOverlays[0].position.x - rect.left) / zoom;
    var y = (G.position[0].y - G.viewer.currentOverlays[0].position.y - rect.top) / zoom;
    setPoint(x, y);

    // distance line
    if (G.position[0].c == 2) {
        var px1 = Math.round((G.position[1].x * zoom) + G.viewer.currentOverlays[0].position.x + 0.5) - 0.5;
        var py1 = Math.round((G.position[1].y * zoom) + G.viewer.currentOverlays[0].position.y + 0.5) - 0.5;
        var px2 = Math.round((G.position[2].x * zoom) + G.viewer.currentOverlays[0].position.x + 0.5) - 0.5;
        var py2 = Math.round((G.position[2].y * zoom) + G.viewer.currentOverlays[0].position.y + 0.5) - 0.5;
        G.ctx.beginPath();
        G.ctx.strokeStyle = "#888";
        G.ctx.moveTo(px1, py1);
        G.ctx.lineTo(px2, py2);
        G.ctx.stroke();
    }
    // cross
    if (G.position[0].c != 0) {
        G.ctx.beginPath();
        G.ctx.strokeStyle = "#000";
        for (var i = 1; i <= G.position[0].c; i++) {
            var px = Math.round((G.position[i].x * zoom) + G.viewer.currentOverlays[0].position.x + 0.5) + 0.5;
            var py = Math.round((G.position[i].y * zoom) + G.viewer.currentOverlays[0].position.y + 0.5) + 0.5;
            G.ctx.moveTo(px, py - 10);
            G.ctx.lineTo(px, py + 10);
            G.ctx.moveTo(px - 10, py);
            G.ctx.lineTo(px + 10, py);
        }
        G.ctx.stroke();
        G.ctx.beginPath();
        G.ctx.strokeStyle = "#FFF";
        for (var i = 1; i <= G.position[0].c; i++) {
            var px = Math.round((G.position[i].x * zoom) + G.viewer.currentOverlays[0].position.x + 0.5) - 0.5;
            var py = Math.round((G.position[i].y * zoom) + G.viewer.currentOverlays[0].position.y + 0.5) - 0.5;
            G.ctx.moveTo(px, py - 10);
            G.ctx.lineTo(px, py + 10);
            G.ctx.moveTo(px - 10, py);
            G.ctx.lineTo(px + 10, py);
        }
        G.ctx.stroke();
    }
};

function resetPositionview() {
    $("#pos1x").text("-");
    $("#pos1y").text("-");
    $("#pos2x").text("-");
    $("#pos2y").text("-");
    $("#posdistance").text("");
    G.position[0].c = 0;
}

function pointerupHandler(event) {
    if (G.viewer.currentOverlays.length == 0 || $("#poscanvas").is(":hidden")) {
        return;
    }

    if (G.pointerdownpos.x > event.clientX + 5 || G.pointerdownpos.x < event.clientX - 5 ||
        G.pointerdownpos.y > event.clientY + 5 || G.pointerdownpos.y < event.clientY - 5) {
        return;
    }
    if (G.position[0].c == 2) {
        resetPositionview();
        G.viewer.drawer.clear();
        G.viewer.world.draw();
        viewPosition();
        return;
    }
    var rect = G.viewer.canvas.getBoundingClientRect();
    //var zoom = viewer.viewport.getZoom(true);
    var zoom = G.viewer.viewport.getZoom(true) * (G.viewer.canvas.clientWidth / G.imageSize);
    var x = (event.clientX - G.viewer.currentOverlays[0].position.x - rect.left) / zoom;
    var y = (event.clientY - G.viewer.currentOverlays[0].position.y - rect.top) / zoom;
    G.position[0].c++
    G.position[G.position[0].c].x = x;
    G.position[G.position[0].c].y = y;
    setPosition();

    // show canvas
    viewPosition();
};

function claerPosition() {
    G.position[0].c = 2;
    resetPositionview();
    G.viewer.drawer.clear();
    G.viewer.world.draw();
    viewPosition();
    return;
}
function setPosition() {
    var pos = [getPointXY(G.position[1].x, G.position[1].y), getPointXY(G.position[2].x, G.position[2].y)];
    for (var i = 1; i <= 2; i++) {
        if (G.position[0].c >= i) {
            //$("#pos" + i).text("P"+i+": "+(pos[i-1].x+".0").replace(/(\.\d).*$/,"$1") + ", " + (pos[i-1].y+".0").replace(/(\.\d).*$/,"$1"));
            $("#pos" + i + "x").text((pos[i - 1].x + ".00").replace(/(\.\d{2}).*$/, "$1"));
            $("#pos" + i + "y").text((pos[i - 1].y + ".00").replace(/(\.\d{2}).*$/, "$1"));
        } else {
            //$("#pos" + i).text("P"+i+": ");
            $("#pos" + i + "x").text("-");
            $("#pos" + i + "y").text("-");
        }
    }
    if (G.position[0].c == 2) {
        $("#posdistance").text((Math.sqrt(Math.pow((pos[0].x - pos[1].x), 2) + Math.pow((pos[0].y - pos[1].y), 2)) + ".00").replace(/(\.\d{2}).*$/, "$1"));
    }
}

function pointerdownHandler(event) {
    G.pointerdownpos.x = event.clientX;
    G.pointerdownpos.y = event.clientY;
};



function positionInit() {

    G.mousemoveHandler = function (event) {
        if (G.viewer.currentOverlays[0] == null) { return; }
        var rect = G.viewer.canvas.getBoundingClientRect();
        //var zoom = viewer.viewport.getZoom(true);
        var zoom = G.viewer.viewport.getZoom(true) * (G.viewer.canvas.clientWidth / G.imageSize);
        G.position[0].x = event.clientX;
        G.position[0].y = event.clientY;
        var x = (G.position[0].x - G.viewer.currentOverlays[0].position.x - rect.left) / zoom;
        var y = (G.position[0].y - G.viewer.currentOverlays[0].position.y - rect.top) / zoom;
        setPoint(x, y);
    };
}
