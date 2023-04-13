import React from 'react';

import {
    Icon,
    Slider,
    Switch,
} from "@blueprintjs/core";


import ZAVConfig from '../ZAVConfig.js'
import ViewerManager from '../ViewerManager.js'

import Utils from '../Utils.js';

import "./SubViewPanel.scss";


class AxisArrow extends React.Component {

    render() {
        const arrowHead = { width: 3, length: 8 }
        const fontSize = 12;

        const { pX, pY, arrowlen, axisLabel } = this.props;
        let arrowPath, arrowLabel;
        if (this.props.horizontal) {
            arrowPath = <path
                d={`M${pX},${pY} l${arrowlen},0 M${pX},${pY} l${arrowHead.length},-${arrowHead.width} M${pX},${pY} l${arrowHead.length},${arrowHead.width}`}
                stroke="silver"
                strokeWidth={1}
            />;
            arrowLabel = <text x={pX - 3} y={pY} textAnchor="end" stroke="silver">{axisLabel}</text>;
        } else {
            arrowPath = <path
                d={`M${pX},${pY} l0,${arrowlen} M${pX},${pY} l-${arrowHead.width},${arrowHead.length} M${pX},${pY} l${arrowHead.width},${arrowHead.length}`}
                stroke="silver"
                strokeWidth={1}
            />;
            arrowLabel = <text x={pX} y={pY - 3} textAnchor="middle" stroke="silver">{axisLabel}</text>;
        }

        return (
            <React.Fragment>
                {arrowPath}
                {arrowLabel}
            </React.Fragment>
        );
    }
}

class SubViewOrthoPlanBar extends React.Component {

    constructor(props) {
        super(props);
        this.getPlaneSlicePercentOffset = this.getPlaneSlicePercentOffset.bind(this);
    }

    render() {
        const markerLineWidth = 1;
        const dragMargin = 3;

        if (this.props.vertical) {
            const orthoVertical = ZAVConfig.getPlaneOrthoVertical(this.props.viewPlane);
            if (this.props.config.hasPlane(orthoVertical)) {
                const orthoVSlicePct = this.getPlaneSlicePercentOffset(orthoVertical);

                const hRange = this.props.config.getSubviewHRange(this.props.viewPlane);
                let hOffset;
                if (this.props.config.hasMultiPlanes) {
                    //in multi-plane mode, origin of horizontal axis is at the right
                    hOffset = this.props.scale * (this.props.config.subviewSize - (hRange.min + hRange.len * orthoVSlicePct));
                } else {
                    //in single plane mode, origin of horizontal axis is at the left  
                    hOffset = this.props.scale * (hRange.min + hRange.len * orthoVSlicePct);
                }
                const verticalLine =
                    <line
                        x1={hOffset} y1="0"
                        x2={hOffset} y2={this.props.size}
                        stroke={ZAVConfig.getPlaneColor(orthoVertical)} strokeWidth={markerLineWidth}
                    />;
                return verticalLine;
            }
        } else {
            const orthoHorizontal = ZAVConfig.getPlaneOrthoHorizontal(this.props.viewPlane);
            if (this.props.config.hasPlane(orthoHorizontal)) {
                const orthoHSlicePct = this.getPlaneSlicePercentOffset(orthoHorizontal);

                const vRange = this.props.config.getSubviewVRange(this.props.viewPlane);
                //note: origin of vertical axis is at the bottom

                const vOffset = this.props.scale * (this.props.config.subviewSize - (vRange.min + vRange.len * orthoHSlicePct));
                const horizontalLine =
                    <line
                        x1="0" y1={vOffset}
                        x2={this.props.size} y2={vOffset}
                        stroke={ZAVConfig.getPlaneColor(orthoHorizontal)} strokeWidth={markerLineWidth}
                    />;
                return horizontalLine;
            }
        }
        return null;
    }

    getPlaneSlicePercentOffset(plane) {
        return ViewerManager.getPlaneChosenSlice(plane) / (ViewerManager.getPlaneSlideCount(plane) - 1);
    }

}

class SubView extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            dragging: false,//true when dragging is on
            bbox: null, //bounding box of subview
        };
        this.svgRef = React.createRef();
        this.getSliceForWidgetPos = this.getSliceForWidgetPos.bind(this);
    }

    render() {
        //bounding box of the subview widget
        const size = this.props.size ? this.props.size : 200;

        //thicker border for active plane (but don't change widget bounding box size when changing border size)
        const border = this.props.activePlane && this.props.activePlane === this.props.viewPlane ? 3 : 1;
        const gap = this.props.activePlane && this.props.activePlane === this.props.viewPlane ? 1 : 3;
        const margin = 2 * border + 2 * gap;

        let horizontalLine, verticalLine, horizontalArrow, verticalArrow, imageUrl;
        const arrowLen = size * 1 / 3 - 6;
        if (this.props.config && this.props.activePlane) {

            // scaling factor when widget size is different from subview image size (image range are proportional to subview image size), 
            const scale = size / this.props.config.subviewSize;

            //line marker for orthogonal plane crossing the subview plane horizontally
            horizontalLine = <SubViewOrthoPlanBar
                vertical={false}
                viewPlane={this.props.viewPlane}
                size={size}
                scale={scale}
                config={this.props.config}
            />
            const vArrow = {
                pX: size - 6,
                pY: size * 2 / 3,
                arrowlen: arrowLen,
                axisLabel: ZAVConfig.getPlaneVerticalAxis(this.props.viewPlane)
            };
            verticalArrow = <AxisArrow horizontal={false} {...vArrow} />;

            //line marker for orthogonal plane crossing the subview plane vertically
            verticalLine = <SubViewOrthoPlanBar
                vertical={true}
                viewPlane={this.props.viewPlane}
                size={size}
                scale={scale}
                config={this.props.config}
            />
            const hArrow = {
                pX: size * 2 / 3,
                pY: size - 6,
                arrowlen: arrowLen,
                axisLabel: ZAVConfig.getPlaneHorizontalAxis(this.props.viewPlane),
            };
            horizontalArrow = <AxisArrow horizontal={true} {...hArrow} />;


            if (this.props.config.subviewFolderName) {
                //in single plane mode, only 1 image for the subview, but one for each slice in multiplane
                //FIXME introduce a specific parameter for this feature
                if (this.props.config.hasMultiPlanes) {
                    imageUrl = Utils.makePath(this.props.config.PUBLISH_PATH, this.props.config.subviewFolderName, ZAVConfig.getPlaneName(this.props.viewPlane), ViewerManager.getPlaneChosenSlice(this.props.viewPlane) + '.jpg');
                } else {
                    imageUrl = Utils.makePath(this.props.config.PUBLISH_PATH, this.props.config.subviewFolderName, "/subview.jpg");
                }
            } else {
                imageUrl = "./assets/img/null.png";
            }

        }


        return (
            <div
                className="subview_holder"
                style={{
                    position: 'relative', height: (size + margin), width: (size + margin),
                    borderColor: ZAVConfig.getPlaneColor(this.props.viewPlane), borderStyle: 'solid', borderWidth: border
                }}
            >
                <img
                    className="subview_image" style={{ position: 'absolute', top: gap, left: gap }}
                    width={size} height={size}
                    src={imageUrl}
                />
                <svg
                    ref={this.svgRef}
                    width={size}
                    style={{
                        position: 'absolute', top: gap, left: gap,
                        cursor: 'crosshair',
                    }}
                    height={size}
                    viewBox={"0 0 " + size + "" + size}
                    xmlns="http://www.w3.org/2000/svg"
                    xmlnsXlink="http://www.w3.org/1999/xlink"
                    onPointerDown={this.onDragStart.bind(this)}
                    onPointerUp={this.onDragEnd.bind(this)}
                    onPointerMove={this.onPointerMove.bind(this)}
                >
                    {horizontalLine}
                    {verticalLine}
                    {horizontalArrow}
                    {verticalArrow}
                </svg>

            </div>
        );
    }

    onDragStart(e) {
        const bbox = this.svgRef.current ? this.svgRef.current.getBoundingClientRect() : null;
        this.setState({
            dragging: true,
            bbox: bbox
        });
        this.setOrthoSlices(e.clientX, e.clientY, bbox);
    }

    onPointerMove(e) {
        if (this.state.dragging && this.state.bbox) {

            //check that left button is still pressed, as an untracked pointerUp might have happened outside the subview
            if ((e.buttons & 1) != 1) {
                this.setState({ dragging: false });
                return;
            }
            this.setOrthoSlices(e.clientX, e.clientY, this.state.bbox);
        }
    }

    onDragEnd(e) {
        if (this.state.dragging) {
            this.setState({ dragging: false });
        }
    }

    setOrthoSlices(clientX, clientY, bnds) {
        if (bnds) {
            const newSlices = {};
            const size = this.props.size ? this.props.size : 200;
            const scale = size / this.props.config.subviewSize;

            const subviewY = (clientY - bnds.top);
            const orthoHorizontal = ZAVConfig.getPlaneOrthoHorizontal(this.props.viewPlane);
            if (this.props.config.hasPlane(orthoHorizontal)) {
                const vRange = this.props.config.getSubviewVRange(this.props.viewPlane);
                const vSliceNum = this.getSliceForWidgetPos(orthoHorizontal, vRange, this.props.config.subviewSize, scale, subviewY);
                newSlices[orthoHorizontal] = vSliceNum;
            }

            const subviewX = (clientX - bnds.left);
            const orthoVertical = ZAVConfig.getPlaneOrthoVertical(this.props.viewPlane);
            if (this.props.config.hasPlane(orthoVertical)) {
                const hRange = this.props.config.getSubviewHRange(this.props.viewPlane);
                const hSliceNum = this.getSliceForWidgetPos(orthoVertical, hRange, this.props.config.subviewSize, scale, subviewX, !this.props.config.hasMultiPlanes);
                newSlices[orthoVertical] = hSliceNum;
            }

            ViewerManager.changeSlices(newSlices);
        }
    }

    getSliceForWidgetPos(plane, range, subviewSize, scale, pos, invertedSliceIndex) {
        const maxSlideNum = ViewerManager.getPlaneSlideCount(plane);
        const percentOffset =
            invertedSliceIndex
                ? (pos / scale - range.min) / range.len
                : (subviewSize - (pos / scale) - range.min) / range.len
            ;

        if (percentOffset <= 0) {
            return 0;
        } else if (percentOffset >= 1) {
            return maxSlideNum;
        } else {
            return Math.round(maxSlideNum * percentOffset);
        }
    }

}


class SubViewPanel extends React.Component {

    render() {
        const currentSlice = this.props.chosenSlice || 0;
        const maxSliceNum = this.props.config ? ViewerManager.getPlaneSlideCount(this.props.activePlane) - 1 : 1000;
        const sliceStep = this.props.config ? ViewerManager.getPlaneSliceStep(this.props.activePlane) : 1;

        const subviews = [];
        let justifyMode;
        if (this.props.config && this.props.activePlane) {
            this.config = this.props.config;

            if (this.props.config.hasMultiPlanes) {
                const subViewSize = 64;
                const subViewLabelWidth = subViewSize - 22;

                subviews.push(
                    <div
                        key={ZAVConfig.AXIAL}
                    >
                        <Switch
                            className="zav-SubViewSwitch"
                            style={{ width: subViewSize }}
                            checked={ZAVConfig.AXIAL === this.props.activePlane}
                            innerLabel={<span style={{ display: 'inline-block', width: subViewLabelWidth }}>{ZAVConfig.getPlaneLabel(ZAVConfig.AXIAL)}</span>}
                            onChange={this.onChangePlane.bind(this, ZAVConfig.AXIAL)}
                        />
                        <SubView
                            activePlane={this.props.activePlane}
                            viewPlane={ZAVConfig.AXIAL}
                            config={this.props.config}
                            size={subViewSize}
                        />

                    </div>
                );

                subviews.push(
                    <div
                        key={ZAVConfig.CORONAL}
                    >
                        <Switch
                            className="zav-SubViewSwitch"
                            style={{ width: subViewSize }}
                            checked={ZAVConfig.CORONAL === this.props.activePlane}
                            innerLabel={<span style={{ display: 'inline-block', width: subViewLabelWidth }}>{ZAVConfig.getPlaneLabel(ZAVConfig.CORONAL)}</span>}
                            onChange={this.onChangePlane.bind(this, ZAVConfig.CORONAL)}
                        />

                        <SubView
                            activePlane={this.props.activePlane}
                            viewPlane={ZAVConfig.CORONAL}
                            config={this.props.config}
                            size={subViewSize}
                        />
                    </div>
                );

                subviews.push(
                    <div
                        key={ZAVConfig.SAGITTAL}
                    >
                        <Switch
                            className="zav-SubViewSwitch"
                            style={{ width: subViewSize }}
                            checked={ZAVConfig.SAGITTAL === this.props.activePlane}
                            innerLabel={<span style={{ display: 'inline-block', width: subViewLabelWidth }}>{ZAVConfig.getPlaneLabel(ZAVConfig.SAGITTAL)}</span>}
                            onChange={this.onChangePlane.bind(this, ZAVConfig.SAGITTAL)}
                        />
                        <SubView
                            activePlane={this.props.activePlane}
                            viewPlane={ZAVConfig.SAGITTAL}
                            config={this.props.config}
                            size={subViewSize}
                        />
                    </div>
                );
                justifyMode = 'space-between';

            } else {
                const subviewPlane = ZAVConfig.getPreferredSubviewForPlane(this.props.activePlane);
                subviews.push(
                    <SubView
                        key={subviewPlane}
                        activePlane={this.props.activePlane}
                        viewPlane={subviewPlane}
                        config={this.props.config}
                    />
                );
                justifyMode = 'center';
            }
        }

        return (
            <React.Fragment>
                <div>
                    <div className="zav-SubViewSlider">

                        <Icon
                            icon="chevron-left"
                            title="go to previous slice"
                            style={{ marginLeft: -16, verticalAlign: "top" }}
                            onClick={this.onGoToSlice.bind(this, currentSlice - 1)}
                        />

                        <Slider
                            className="zav-Slider zav-SubVSliceSlider"
                            min={0}
                            max={maxSliceNum}
                            stepSize={1}
                            labelStepSize={maxSliceNum}
                            onChange={this.onGoToSlice.bind(this)}
                            value={currentSlice}
                            showTrackFill={false}
                            labelRenderer={(value) => value * sliceStep}
                        />
                        <Icon
                            icon="chevron-right"
                            title="go to next slice"
                            style={{ marginRight: -16, verticalAlign: "top" }}
                            onClick={this.onGoToSlice.bind(this, currentSlice + 1)}
                        />

                    </div>
                </ div>

                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: justifyMode }} >
                    {subviews}
                </div>
            </React.Fragment>

        );
    }

    onGoToSlice(sliceNum) {
        ViewerManager.goToSlice(sliceNum);
    }

    onChangePlane(plane) {
        if (plane !== this.props.activePlane) {
            ViewerManager.activatePlane(plane);
        }
    }

}

export default SubViewPanel;
