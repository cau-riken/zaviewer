
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




function subviewsInit() {

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


