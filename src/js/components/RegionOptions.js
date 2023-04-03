import React from 'react';

import {
    Switch,
} from "@blueprintjs/core";

import ParamAdjusterLabel from './ParamAdjusterLabel.js';
import BorderSettings from './BorderSettings';

import ViewerManager from '../ViewerManager.js'


class RegionOptions extends React.Component {

    constructor(props) {
        super(props);
        this.handleClickHideShow = this.handleClickHideShow.bind(this);
        this.handleOpacityChange = this.handleOpacityChange.bind(this);
        this.handleBorderChange = this.handleBorderChange.bind(this);
        this.handleClickLabelsShow = this.handleClickLabelsShow.bind(this);
    }

    render() {
        return (
            <div
                style={{ width: 196, marginLeft: 10 }}
            >
                <div title="adjust regions' area opacity">
                    <span title="toggle display of regions' area">
                        <Switch
                            checked={this.props.displayAreas}
                            onChange={this.handleClickHideShow}
                            inline
                            label="areas"
                        />
                    </span>
                    <ParamAdjusterLabel
                        icon="eye-open"
                        label="Opacity"
                        min={5}
                        max={100}
                        stepSize={1}
                        onChange={this.handleOpacityChange}
                        value={Math.round(this.props.regionsOpacity * 100)}
                        defaultValue={Math.round(this.props.initRegionsOpacity * 100)}
                        labelRenderer={(value) => <span>{value}<span style={{ fontSize: 8 }}>&nbsp;%</span></span>}
                        enabled={this.props.displayAreas}
                    />
                </div>
                <div
                    style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                    <span title="toggle display of regions' border">
                        <Switch
                            checked={this.props.displayBorders}
                            onChange={this.handleBorderChange}
                            inline
                            label="borders"
                        />
                    </span>

                    <span title="click to set regions' custom border">
                        <BorderSettings
                            disabled={!this.props.displayBorders}
                            useCustomBorders={this.props.useCustomBorders}
                            customBorderColor={this.props.customBorderColor}
                            customBorderWidth={this.props.customBorderWidth}
                        />
                    </span>
                </div>
                <div title="toggle display of region labels">
                    <Switch
                        checked={this.props.displayLabels}
                        onChange={this.handleClickLabelsShow}
                        inline
                        label="labels"
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

    handleClickLabelsShow() {
        ViewerManager.toggleLabelDisplay();
    }

}

export default RegionOptions;


