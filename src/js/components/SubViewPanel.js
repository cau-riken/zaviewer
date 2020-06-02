import React from 'react';

import {
    Slider
} from "@blueprintjs/core";


import ViewerManager from '../ViewerManager.js'
import ExpandablePanel from './ExpandablePanel.js';

import Utils from '../Utils.js';

class SubViewPanel extends React.Component {

    constructor(props) {
        super(props);
        this.subviewStatus = {
            sagittalVerticalLineId: 'sagittal_vertical_line',
            currentSlice: 0,
            sagittalHolderPaper: undefined,
            sagittalHolderPaperSet: undefined,
            sagittalRect: undefined,

        };

        this.onGoToSlice = this.onGoToSlice.bind(this);
    }


    componentDidUpdate(prevProps) {
        if (this.props.config) {
            if (!prevProps.config) {
                this.addSagittalSelectSection();
            }
            this.updateSubVLine(this.props.coronalChosenSlice);
        }
    }

    render() {
        const currentSlice = this.props.coronalChosenSlice;
        const maxSliceNum = this.props.config ? this.props.config.coronalSlideCount - 1 : 1000;
        const sliceStep = this.props.config ? this.props.config.coronalSliceStep : 1;
        if (this.props.config) {
            this.config = this.props.config;
        }

        return (
            <React.Fragment>
                <div>
                    <div className="zav-SubViewSlider">
                        <Slider
                            className="zav-Slider"
                            min={0}
                            max={maxSliceNum}
                            stepSize={1}
                            labelStepSize={maxSliceNum}
                            onChange={this.onGoToSlice}
                            value={currentSlice}
                            showTrackFill={false}
                            labelRenderer={(value) => value * sliceStep}
                        />
                    </div>
                </ div>
                <div id="sagittal_holder" className="sagittalHolder" >
                    <img id="sagittal_image" alt="Sagittal view" width="200" height="200" />
                </div>
            </React.Fragment>

        );
    }

    onGoToSlice(sliceNum) {
        ViewerManager.goToSlice(ViewerManager.CORONAL, sliceNum);
    }


    addSagittalSelectSection() {
        const that = this;
        // Mapping global min, max of x,y,z to Sagittal subview
        var minX = this.config.yMinGlobal; // X of Sagittal is global Y
        var maxX = this.config.yMaxGlobal;
        var sagittalImgFg;
        var img = document.getElementById("sagittal_image");
        img.style.display = "none";
        //boundary
        this.subviewStatus.sagittalHolderPaper = Raphael("sagittal_holder", this.config.subviewSize + 20, this.config.subviewSize + 20);
        this.subviewStatus.sagittalHolderPaperSet = this.subviewStatus.sagittalHolderPaper.set();
        //relative to the surrounding area
        this.subviewStatus.sagittalImg = this.subviewStatus.sagittalHolderPaper.image(img.src, 10, 10, this.config.subviewSize, this.config.subviewSize,
            () => {
                //console.log("sagittalOnerror");
                that.subviewStatus.sagittalImg.node.href.baseVal = "./assets/img/no_image.jpg";
            }
        );
        if (this.config.subviewFolderName) {
            this.subviewStatus.sagittalImg.node.href.baseVal = Utils.makePath(this.config.PUBLISH_PATH, this.config.subviewFolderName, "/subview.jpg");
        } else {
            this.subviewStatus.sagittalImg.node.href.baseVal = "./assets/img/null.png";
        }
        this.subviewStatus.sagittalHolderPaper.image("./assets/img/yz.png", 110, 110, 100, 100);
        sagittalImgFg = this.subviewStatus.sagittalHolderPaper.image("./assets/img/null.png", 10, 10, this.config.subviewSize, this.config.subviewSize);
        this.subviewStatus.sagittalRect = this.subviewStatus.sagittalHolderPaper.rect(10, 10, this.config.subviewSize, this.config.subviewSize);

        //		if (selectedSubview == SAGITTAL) {
        //			document.getElementById("sagittal_label").className="sagittalLabel btnOn";	// Select SAGITTAL button (First access)
        //		}

        var startX = 10 + minX;
        var endX = this.config.subviewSize + 10 + 1.5;
        var verticalLine = this.subviewStatus.sagittalHolderPaper.path("M" + startX + ",10L" + startX + "," + endX).attr({
            stroke: this.config.colorCoronal,
            "stroke-width": 2.0,	// Vertical line of SAGITTAL subview (CORONAL cross)
            opacity: 1.0
        });
        verticalLine.id = this.subviewStatus.sagittalVerticalLineId;

        this.subviewStatus.sagittalHolderPaperSet.push(verticalLine);
        if (this.config.coronalSlideCount <= 1) { verticalLine.attr('stroke-width', 0) }

        var transferX = this.config.global_Y - startX;
        verticalLine.transform("T" + transferX + ",0");

        //set up the line
        //add event handling:
        if (sagittalImgFg) {
            sagittalImgFg.mousedown(function (event) {
                //find x,y click position
                var bnds = event.target.getBoundingClientRect();
                var fx = (event.clientX - bnds.left) / bnds.width * that.subviewStatus.sagittalImg.attrs.width;
                startX = fx;
                that.updateSubVview(fx, true);
            });

            var dragMove = function (dx, dy, x, y, e) {
                var fx = startX + dx;
                that.updateSubVview(fx, false);
            };
            var dragStart = function (x, y) {
            }
            var dragEnd = function () {
                ViewerManager.goToSlice(ViewerManager.CORONAL, that.subviewStatus.targetCoronalChosenSlice);
            };
            sagittalImgFg.drag(dragMove, dragStart, dragEnd);
        }
    }

    updateSubVview(fx, isClick) {
        var newCoronalChosenSlice;
        if (fx <= this.config.yMinGlobal) {
            newCoronalChosenSlice = 0;//redundant
        } else if (fx > this.config.yMaxGlobal) {
            newCoronalChosenSlice = (this.config.coronalSlideCount - 1.0);
        } else {
            var percent = (fx - this.config.yMinGlobal) / (this.config.yMaxGlobal - this.config.yMinGlobal);
            newCoronalChosenSlice = Math.round((this.config.coronalSlideCount - 1.0) * percent);
        }
        if (this.config.coronalSlideCount > 1 && isClick) {
            ViewerManager.goToSlice(ViewerManager.CORONAL, newCoronalChosenSlice);
        }

        this.subviewStatus.targetCoronalChosenSlice = newCoronalChosenSlice;
        $("#sagittal_spinner>input:first-child").val(newCoronalChosenSlice);
        this.updateSubVLine(newCoronalChosenSlice);

        //AW(2010/01/16): Added this code to call a tile-drawn event, which then calls updateFilters
        //FIXME G.viewer.addHandler('tile-drawn', G.tileDrawnHandler);
    }

    updateSubVLine(page) {
        var sagittalVLine = this.subviewStatus.sagittalHolderPaper.getById(this.subviewStatus.sagittalVerticalLineId);
        sagittalVLine.transform("T" + (this.config.yMaxGlobal - this.config.yMinGlobal) * page / (this.config.coronalSlideCount - 1) + ",0");
    }

    updateLinePosBaseSlide(coronalSlide) {
        // Coronal subview's image is changed
        var tmpCoronalSlide = this.config.coronalSlideCount - 1 - coronalSlide;
        //this.updateSubVLine(tmpCoronalSlide);
    }

    ///FIXME
    /*
    //$("#axial_holder").hide();
    //$("#coronal_holder").hide();
    if (that.config.coronalSlideCount == 0) { $("#sagittal_holder").hide(); }
    else if (that.config.coronalSlideCount == 1) {
        $("#sagittal_spinner").hide();
        $("#sagittal_spinner_max").hide();
    } else {
        $("#sagittal_spinner>input").val(that.config.coronalChosenSlice);
        $("#sagittal_spinner>input").attr('maxlength', ((String)(that.config.coronalSlideCount - 1)).length);
        $("#sagittal_spinner_max").html(that.config.coronalSlideCount - 1);
    }
    //$("#sagittal_spinner").hide();
    //$("#sagittal_spinner_max").hide();

    if (response.bright) {
        $("#intensity_slider").val(response.bright);
    }
    if (response.gamma) {
        $("#gamma_slider").val(response.gamma);
    }
    if (response.bright || response.gamma) {
        //	updateFilters();
    }

    if (response.group_id || (response.data && Object.keys(response.data).length > 0)) {
        $("#GroupName").html(response.group_name);
        $("#editbtn").click(showImageList);
    } else {
        $("#editbtn").hide();
    }
    */


}

export default SubViewPanel;