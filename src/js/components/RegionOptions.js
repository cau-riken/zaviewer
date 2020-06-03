


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
        this.handleBorderChange = this.handleBorderChange.bind(this);
    }

    render() {
        return (
            <div
                style={{ width: 196, marginLeft: 10 }}
            >
                <span title="toggle display of regions' area">
                    <Switch
                        checked={this.props.displayAreas}
                        onChange={this.handleClickHideShow}
                        inline
                        label="areas"
                    />
                </span>
                <span title="toggle display of regions' border">
                    <Switch
                        checked={this.props.displayBorders}
                        onChange={this.handleBorderChange}
                        inline
                        label="borders"
                    />
                </span>
                <div title="adjust regions' area opacity">
                    <Slider
                        className="zav-Slider zav-OpacitySlider"
                        min={5}
                        max={100}
                        stepSize={1}
                        labelStepSize={95}
                        onChange={this.handleOpacityChange}
                        value={Math.round(this.props.regionsOpacity * 100)}
                        showTrackFill={false}
                        labelRenderer={(value) => value + "%"}
                        disabled={!this.props.displayAreas}
                    />
                </div>
            </div>
        );
    }

    handleClickHideShow() {
        ViewerManager.toggleAreaDisplay();
    }

    handleOpacityChange(opacity) {
        ViewerManager.changeRegionsOpacity(opacity / 100);
    }

    handleBorderChange() {
        ViewerManager.toggleBorderDisplay();
    }
}

export default RegionOptions;


