


import React from 'react';

import {
    Slider,
    Switch
} from "@blueprintjs/core";

import RegionsManager from '../RegionsManager.js'
import ViewerManager from '../ViewerManager.js'


class RegionOptions extends React.Component {

    constructor(props) {
        super(props);
        this.handleClickHideShow = this.handleClickHideShow.bind(this);
        this.handleOpacityChange = this.handleOpacityChange.bind(this);
    }

    render() {
        return (
            <div
                style={{ width: 196, marginLeft: 10 }}
            >
                <Switch
                    checked={this.props.showRegions}
                    onChange={this.handleClickHideShow}
                    label="display areas"
                />
                <div title="adjust regions' opacity">
                    <Slider
                        className="zav-Slider zav-OpacitySlider"
                        min={0}
                        max={100}
                        stepSize={1}
                        labelStepSize={100}
                        onChange={this.handleOpacityChange}
                        value={Math.round(this.props.regionsOpacity * 100)}
                        showTrackFill={false}
                        labelRenderer={(value) => value + "%"}
                        disabled={!this.props.showRegions}
                    />
                </div>
            </div>
        );
    }

    handleClickHideShow() {
        ViewerManager.changeRegionsVisibility(!this.props.showRegions);
    }

    handleOpacityChange(opacity) {
        ViewerManager.changeRegionsOpacity(opacity / 100);
    }
}

export default RegionOptions;


