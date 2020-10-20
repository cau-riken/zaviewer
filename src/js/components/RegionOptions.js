import React from 'react';

import {
    Button,
    ButtonGroup,
    Icon,
    Popover,
    PopoverInteractionKind,
    Position,
    Slider,
    Switch,
} from "@blueprintjs/core";

import ParamAdjusterLabel from './ParamAdjusterLabel.js';

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
                        labelRenderer={(value) => <span>{value}<span style={{ fontSize: 8 }}>&nbsp;%</span></span>}
                        enabled={this.props.displayAreas}
                    />
                </div>
                <span title="toggle display of regions' border">
                    <Switch
                        checked={this.props.displayBorders}
                        onChange={this.handleBorderChange}
                        inline
                        label="borders"
                    />
                </span>
                {
                    this.props.editModeOn
                        ?
                        <React.Fragment>
                            <div style={{ borderBottom: "dotted 1px #8a8a8a", margin: "3px 0" }} />
                            <div style={{ backgroundColor: "#f4f4f4", margin: 3, padding: 4, borderRadius: 2, color: "black" }}>
                                <div style={{ margin: 3 }}>
                                    {"Region Editing"}

                                </div>
                                <div style={{ margin: 3, height: 30, display: 'flex', flexDirection: 'row', justifyContent: "space-between" }}>
                                    <Button
                                        icon="annotation"
                                        disabled={this.props.editRegionId}
                                        title="Select a region to edit"
                                        outlined={true}
                                        onClick={(e) => ViewerManager.startEditingClickedRegion()}
                                    />
                                    <div style={{ padding: 3 }}>
                                        {this.props.editRegionId
                                            ? <span><span style={{ display: "inline-block", width: 20, height: 12, backgroundColor: this.props.editRegionColor }}>{" "}</span>{" " + this.props.editRegionId}</span>
                                            : null
                                        }
                                    </div>
                                    <Button
                                        icon="document-share"
                                        disabled={!this.props.editRegionId}
                                        title="Stop editing current region"
                                        outlined={true}
                                        onClick={(e) => ViewerManager.stopEditingRegion()}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: "space-evenly" }}>
                                    <Button
                                        icon="draw"
                                        title="tool to extend region"
                                        outlined={true}
                                        active={this.props.editingTool == 'pen'}
                                        onClick={(e) => ViewerManager.changeEditingTool('pen')}
                                    />
                                    <Button
                                        icon="eraser"
                                        title="tool to reduce region"
                                        outlined={true}
                                        active={this.props.editingTool == 'eraser'}
                                        onClick={(e) => ViewerManager.changeEditingTool('eraser')}
                                    />

                                    <Popover
                                        interactionKind={PopoverInteractionKind.HOVER}
                                        position={Position.LEFT}
                                        popoverClassName="bp3-popover-content-sizing"
                                        lazy
                                    >
                                        <Button icon="ring" title="Change tool's width" outlined={true} />

                                        <Slider
                                            min={10}
                                            max={200}
                                            stepSize={1}
                                            value={this.props.editingToolRadius}
                                            showTrackFill={true}
                                            labelStepSize={50}
                                            labelRenderer={(value) => value}
                                            vertical={true}
                                            onChange={(radius) => ViewerManager.changeEditingRadius(radius)}
                                        />
                                    </Popover>

                                    <Button
                                        icon="switch"
                                        disabled={!this.props.editRegionId}
                                        title="Simplify current region"
                                        outlined={true}
                                        onClick={(e) => ViewerManager.simplifyEditedRegion()}
                                    />

                                </div>
                            </div>
                        </React.Fragment>

                        :
                        null
                }
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


