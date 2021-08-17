
import React from 'react';

import _ from 'underscore';
import {
    AnchorButton,
    Icon,
    Position,
    Slider,
    Switch
} from "@blueprintjs/core";

import {
    Popover2InteractionKind,
    Popover2
} from "@blueprintjs/popover2";


import ViewerManager from '../ViewerManager.js'

import MetadataView from "./MetadataView";


import "./QuickActionButtons.scss";

class ActionContainer extends React.Component {
    render() {
        return (
            <div
                className="zav-ActionContainer"
            >
                {this.props.children}
            </div>
        );
    }

}

class QuickActionButtons extends React.Component {

    constructor(props) {
        super(props);
        this.handleClickHideShow = this.handleClickHideShow.bind(this);
        this.onShiftToSlice = this.onShiftToSlice.bind(this);
        this.onGoToSlice = this.onGoToSlice.bind(this);
    }

    render() {

        const tracerLayer = _.findWhere(this.props.displaySettings, { isTracer: true });

        const currentSlice = this.props.chosenSlice;
        const maxSliceNum = this.props.config ? ViewerManager.getPlaneSlideCount(this.props.activePlane) - 1 : 1000;
        const sliceStep = this.props.config ? ViewerManager.getPlaneSliceStep(this.props.activePlane) : 1;

        return (
            <>
                <Popover2
                    interactionKind={Popover2InteractionKind.CLICK}
                    content={this.props.tourMenu}
                    position={Position.LEFT_BOTTOM}
                >
                    <div
                        title="Help and guided tours!"
                    >
                        <Icon
                            icon="help"
                            color='#FFF'
                            style={{
                                margin: '18px 0px 20px 0px',
                            }}
                        />
                    </div>
                </Popover2>

                {
                    this.props.config
                        ?
                        <Popover2
                            content={
                                <div
                                    style={{ width: '70vw', maxWidth: 850, height: '90vh', overflowY: 'auto' }}>
                                    <MetadataView
                                        infoDataset={this.props.config.dataset_info}
                                        includeThumbnail={true}
                                    />
                                </div>
                            }
                            position={Position.LEFT}
                            interactionKind={Popover2InteractionKind.CLICK}
                        >
                            <div
                                title="display dataset informations"
                            >
                                <Icon
                                    icon="info-sign"
                                    color='#FFF'
                                    style={{
                                        margin: '6px 0px 10px 0px',
                                    }}
                                />
                            </div>
                        </Popover2>
                        :
                        null
                }


                <div
                    className="zav-QuickActionPanel"
                    style={{
                        height: '100%',
                    }}
                >
                    <div className="zav-ActionContainer"></div>

                    {this.props.hasDelineation ?

                        <div
                            className="zav-ActionContainer zav-QuickToogleDelineationButton"
                            title="toggle display of regions"
                        >
                            <Switch
                                checked={this.props.showRegions}
                                onChange={this.handleClickHideShow} />
                        </div>
                        :
                        null
                    }

                    {this.props.config && (this.props.config.getTotalSlidesCount() > 1) ?
                        <div className="zav-QuickNavButtons">
                            <div className="zav-ActionContainer">
                                <AnchorButton
                                    icon="double-chevron-right"
                                    small
                                    title="go to 10 slices forward"
                                    onClick={this.onShiftToSlice.bind(this, 10)}
                                />
                            </div>
                            <div className="zav-ActionContainer">
                                <AnchorButton
                                    icon="chevron-right"
                                    small
                                    title="go to next slice"
                                    onClick={this.onShiftToSlice.bind(this, 1)}
                                />
                            </div>

                            <div
                                className="zav-ActionContainer"
                                title={"slice #" + (currentSlice) + " of " + (maxSliceNum)}
                                style={{ paddingTop: 14 }}
                            >

                                <Popover2
                                    interactionKind={Popover2InteractionKind.HOVER}
                                    position={Position.LEFT}
                                    boundary="window"
                                    lazy
                                    content={
                                        <div
                                            style={{ padding: '14px 10px 8px 10px' }}
                                        >
                                            <Icon
                                                icon="chevron-left"
                                                title="go to previous slice"
                                                style={{ paddingRight: 10, verticalAlign: "top" }}
                                                onClick={this.onShiftToSlice.bind(this, -1)}
                                            />
                                            <Slider
                                                className="zav-Slider zav-QActSliceSlider"
                                                min={0}
                                                max={maxSliceNum}
                                                stepSize={1}
                                                onChange={this.onGoToSlice}
                                                value={currentSlice}
                                                showTrackFill={false}
                                                labelStepSize={maxSliceNum}
                                                labelRenderer={(value) => value}
                                            />
                                            <Icon
                                                icon="chevron-right"
                                                title="go to next slice"
                                                style={{ paddingLeft: 10, verticalAlign: "top" }}
                                                onClick={this.onShiftToSlice.bind(this, 1)}
                                            />
                                        </div>
                                    }
                                >
                                    <AnchorButton icon="multi-select" small />

                                </Popover2>
                                <div
                                    style={{
                                        color: '#FFF', fontSize: '12px', lineHeight: '13px',
                                        padding: '4px 14px 4px 0',
                                        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                                    }}
                                >
                                    <span>{currentSlice}</span>
                                    <span
                                        style={{
                                            textDecoration: 'overline',
                                            textDecorationColor: '#137cbd'
                                        }}
                                    >{maxSliceNum}</span>
                                </div>

                            </div>

                            <div className="zav-ActionContainer">
                                <AnchorButton
                                    icon="chevron-left"
                                    small
                                    title="go to previous slice"
                                    onClick={this.onShiftToSlice.bind(this, -1)}
                                />
                            </div>
                            <div className="zav-ActionContainer">
                                <AnchorButton
                                    icon="double-chevron-left"
                                    small
                                    title="go to 10 slices backward"
                                    onClick={this.onShiftToSlice.bind(this, -10)}
                                />
                            </div>
                        </div>
                        : null
                    }

                    {
                        tracerLayer
                            ?
                            <div
                                className="zav-ActionContainer"
                                title="toggle tracer mask visibility"
                                style={{ margin: "20px 0 10px 0" }}
                            >
                                <Switch
                                    checked={tracerLayer.enabled}
                                    onChange={this.handleLayerEnabledChange.bind(this, tracerLayer.key, tracerLayer.opacity)}
                                />
                            </div>
                            :
                            null
                    }

                </div>
            </>
        );
    }

    handleClickHideShow() {
        if (this.props.showRegions) {
            ViewerManager.hideRegions();
        } else {
            ViewerManager.toggleAreaDisplay();
        }
    }

    handleLayerEnabledChange(layerid, opacity, event) {
        ViewerManager.changeLayerOpacity(layerid, event.target.checked, opacity);
    }

    onShiftToSlice(increment) {
        ViewerManager.shiftToSlice(increment);
    }

    onGoToSlice(sliceNum) {
        ViewerManager.goToSlice(sliceNum);
    }

}

export default QuickActionButtons;
