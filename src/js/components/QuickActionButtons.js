
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
        /*
        const regionId = RegionsManager.getLastSelected();
        const region = regionId ? RegionsManager.getRegion(regionId) : null;
        */



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

                {this.props.config ?
                    <div
                        className="zav-ActionContainer"
                        style={{ margin: "10px 0" }}
                        title={"slice #" + (this.props.coronalChosenSlice * this.props.config.coronalSliceStep) + " of " + (this.props.config.coronalSliceStep * (this.props.config.coronalSlideCount - 1))}
                    >

                        <Popover
                            interactionKind={PopoverInteractionKind.HOVER}
                            position={Position.LEFT}
                            boundary="window"
                            popoverClassName="bp3-popover-content-sizing"
                            lazy
                        >
                            <AnchorButton icon="multi-select" small/>
                            <Slider
                                className="zav-Slider zav-QActSliceSlider"
                                min={0}
                                max={this.props.config.coronalSlideCount - 1}
                                stepSize={1}
                                onChange={this.onGoToSlice}
                                value={this.props.coronalChosenSlice}
                                showTrackFill={false}
                                labelStepSize={this.props.config.coronalSlideCount - 1}
                                labelRenderer={(value) => value * this.props.config.coronalSliceStep}
                            />
                        </Popover>
                    </div>

                    :
                    null
                }

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
        );
    }

    handleClickHideShow() {
        if (this.props.showRegions) {
            ViewerManager.hideRegions();
        } else {
            ViewerManager.toggleAreaDisplay();
        }
    }

    onShiftToSlice(increment) {
        this.onGoToSlice(this.props.coronalChosenSlice + increment);
    }

    onGoToSlice(sliceNum) {
        ViewerManager.goToSlice(ViewerManager.CORONAL, sliceNum);
    }


}

export default QuickActionButtons;
