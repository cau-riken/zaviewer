
import React from 'react';

import _ from 'underscore';
import {
    AnchorButton,
    Icon,
    Popover,
    PopoverInteractionKind,
    Position,
    Slider,
    Switch
} from "@blueprintjs/core";

import ViewerManager from '../ViewerManager.js'

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
            <React.Fragment>
                <div className="zav-ActionContainer"></div>

                {this.props.hasDelineation ?

                    <div
                        className="zav-ActionContainer"
                        title="toggle display of regions"
                    >
                        <Switch
                            checked={this.props.showRegions}
                            onChange={this.handleClickHideShow} />
                    </div>
                    :
                    null
                }

                { this.props.config && (this.props.config.getTotalSlidesCount() > 1) ?
                    <React.Fragment>
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
                            title={"slice #" + (currentSlice + 1) + " of " + (maxSliceNum + 1)}
                        >

                            <Popover
                                interactionKind={PopoverInteractionKind.HOVER}
                                position={Position.LEFT}
                                boundary="window"
                                popoverClassName="bp3-popover-content-sizing"
                                lazy
                            >
                                <AnchorButton icon="multi-select" small />

                                <div>
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
                            </Popover>
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
                    </React.Fragment>
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

            </React.Fragment>
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
