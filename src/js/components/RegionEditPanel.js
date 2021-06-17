import React from 'react';

import {
    Alignment,
    Button,
    ButtonGroup,
    Menu,
    MenuDivider,
    MenuItem,
    Slider,
    Switch,
} from "@blueprintjs/core";

import {
    Classes,
    Popover2,
    Popover2InteractionKind,
    PopperPlacements
} from "@blueprintjs/popover2";

import { HuePicker } from 'react-color';

import RegionsManager from '../RegionsManager.js'
import ViewerManager from '../ViewerManager.js'

import "./RegionEditPanel.scss";

const REGIONEDITOR_ACTIONSOURCEID = 'REGEDIT';


class ColorBullet extends React.Component {
    render() {
        return (
            <span
                className="zav-colorbullet"
                style={{ backgroundColor: this.props.color }}
                onClick={this.props.onClick} />
        );
    }
}

class RegionGrid extends React.Component {

    constructor(props) {
        super(props);
        this.regionActionner = RegionsManager.getActionner(REGIONEDITOR_ACTIONSOURCEID);
    }

    render() {
        const regionsInfo = Array.from(ViewerManager.getCurrentSliceRegions().values());
        return (
            <div>
                <div
                    style={{
                        display: "grid", gridTemplateColumns: "auto 20px", gap: "3px 6px", alignItems: "center",
                        maxHeight: "50vh", overflowY: "scroll", margin: "0 -10px", padding: "5px 10px",
                    }}
                >
                    {
                        regionsInfo.map(ri =>
                            <React.Fragment
                                key={"frg-" + ri.pathId}
                            >
                                <div
                                    key={"lbl-" + ri.pathId}
                                    className="zav-regiongrid-item zav-regiongrid-label"
                                    onClick={this.onSelectClick.bind(this, ri)}
                                    onDoubleClick={this.onCenterClick.bind(this, ri)}
                                >{ri.pathId}</div>
                                <div
                                    key={"clr-" + ri.pathId}
                                    className="zav-regiongrid-item zav-regiongrid-color"
                                    onClick={this.onStartEditClick.bind(this, ri)}
                                >
                                    <ColorBullet
                                        color={ri.fill}
                                    />
                                </div>
                            </React.Fragment>
                        )
                    }

                </div>
                <div style={{ textAlign: "right", fontSize: "small", margin: "6px 0 -10px 0", border: "solid 1px #eaeaea", borderRadius: 5, padding: "2px 6px" }}
                >{"Nb regions: " + regionsInfo.length}</div>
            </div>
        );
    }

    onSelectClick(regionInfo) {
        this.regionActionner.replaceSelected(regionInfo.abbrev);
        ViewerManager.setLastSelectedPath(regionInfo.pathId)
    }

    onCenterClick(regionInfo) {
        ViewerManager.centerOnRegions([regionInfo.abbrev]);
    }

    onStartEditClick(regionInfo) {
        this.regionActionner.replaceSelected(regionInfo.abbrev);
        ViewerManager.startEditRegionPath([regionInfo.pathId]);
    }

}

class RegionEditPanel extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        const editingTools = {
            pen: { toolid: "pen", icon: "draw", title: "tool to extend region" },
            eraser: { toolid: "eraser", icon: "eraser", title: "tool to reduce region" },
        };
        const activeTool = editingTools[this.props.editingTool];
        const isEditing = this.props.editPathId;

        let pathIdBase = '';
        let pathIdSuffix = '';
        let color = null;

        let displayedPathId = null;
        if (this.props.editPathId) {
            //edit mode: display path being edited
            displayedPathId = this.props.editPathId;
            color = this.props.editPathFillColor;
        } else {
            //not in edit mode: display last selected path 
            displayedPathId = ViewerManager.getLastSelectedPath();
        }

        const regionsInfo = ViewerManager.getCurrentSliceRegions().get(displayedPathId);
        if (displayedPathId && regionsInfo) {
            const sepIndex = displayedPathId.lastIndexOf('-');
            pathIdBase = displayedPathId.substr(0, sepIndex);
            pathIdSuffix = displayedPathId.substr(sepIndex);
            color = regionsInfo ? regionsInfo.fill : "#00000000";
        }

        return (
            <div style={{ backgroundColor: "#f4f4f4", margin: "0 -5px", padding: 3, borderRadius: 2, color: "black" }}>

                <div style={{ margin: 3, height: 30, display: 'flex', flexDirection: 'row', justifyContent: "space-between", alignItems: "center" }}>
                    <span>{"Region Editing"}</span>
                </div>

                <div style={{ margin: 3, height: 30, display: 'flex', flexDirection: 'row', justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <Switch
                            checked={isEditing}
                            alignIndicator={Alignment.RIGHT}
                            disabled={!isEditing && !displayedPathId}
                            onChange={(e) => {
                                if (isEditing) {
                                    ViewerManager.stopEditingRegion();
                                } else {
                                    ViewerManager.startEditingClickedRegion();
                                }
                            }}
                            large={true}
                        />
                    </div>
                    <div>
                        <input
                            id="regionedit-name-abbrev"
                            type="text"
                            className="bp3-input"
                            style={{ width: 110, fontsize: "small", padding: "0 2px", textAlign: "right" }}
                            placeholder="region name"
                            maxLength={18}
                            value={pathIdBase}
                            onChange={this.handleChangeRegionName.bind(this)}
                            disabled={!isEditing}
                        />
                        <input
                            id="regionedit-name-suffix"
                            type="text"
                            className="bp3-input"
                            style={{ width: 34, fontsize: "small", padding: "0 2px", textAlign: "left" }}
                            disabled={true}
                            value={pathIdSuffix}
                        />
                        <Popover2
                            interactionKind={Popover2InteractionKind.HOVER}
                            placement={"left"}
                            popoverClassName={Classes.POPOVER2_CONTENT_SIZING}
                            disabled={!isEditing}
                            content={
                                    <HuePicker
                                        width={200}
                                        color={color}
                                        onChangeComplete={(color, event) => 
                                            ViewerManager.changeEditedRegionFill(color.hex)
                                        }
                                    />
                            }
                        >
                            <ColorBullet
                                color={color}
                            />
                        </Popover2>
                    </div>
                </div>

                <div style={{ margin: 3, height: 30, display: 'flex', flexDirection: 'row', justifyContent: "space-between" }}>
                    <ButtonGroup>

                        <Popover2
                            interactionKind={Popover2InteractionKind.HOVER}
                            placement={"left"}
                            popoverClassName={Classes.POPOVER2_CONTENT_SIZING}
                            lazy
                            content={<RegionGrid />}
                        >
                            <Button
                                icon="property"
                                title="view list of regions"
                                outlined={true}
                            />
                        </Popover2>

                        <Popover2
                            interactionKind={Popover2InteractionKind.HOVER}
                            placement={"bottom-start"}
                            content={
                                <Menu>
                                    <MenuItem
                                        icon="document"
                                        text="Create an empty region container"
                                        onClick={(e) => ViewerManager.createSVGForRegions()}
                                    />
                                    <MenuDivider />
                                    <MenuItem
                                        icon="new-drawing"
                                        text="Create a new region"
                                        onClick={(e) => ViewerManager.createPathForRegion("NEW_REGION", "#F00", "#0F0")}
                                    />
                                </Menu>
                            }
                        >
                            <Button icon="caret-down" />
                        </Popover2>
                    </ButtonGroup>

                    <ButtonGroup>

                        <Button
                            icon={activeTool.icon}
                            title={activeTool.title}
                            outlined={true}
                            active={isEditing}
                        />

                        <Popover2
                            interactionKind={Popover2InteractionKind.HOVER}
                            placement={"bottom-start"}
                            content={
                                <Menu>
                                    {Object.values(editingTools).map(
                                        tool =>
                                            <MenuItem
                                                key={tool.toolid}
                                                icon={tool.icon}
                                                text={tool.title}
                                                onClick={(e) => ViewerManager.changeEditingTool(tool.toolid)}
                                            />)}
                                </Menu>
                            }
                        >
                            <Button icon="caret-down" />
                        </Popover2>
                    </ButtonGroup>

                    <Popover2
                        interactionKind={Popover2InteractionKind.HOVER}
                        placement={"left"}
                        popoverClassName={Classes.POPOVER2_CONTENT_SIZING}
                        lazy
                        content={
                            <div>
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
                            </div>
                        }
                    >
                        <Button icon="ring" title="Change tool's width" outlined={true} />
                    </Popover2>

                    <Button
                        icon="clean"
                        disabled={!isEditing}
                        title="Simplify current region"
                        outlined={true}
                        onClick={(e) => ViewerManager.simplifyEditedRegion()}
                    />

                </div>
            </div>
        );
    }

    handleChangeRegionName(event) {
        ViewerManager.changeEditedRegionName(event.target.value.trim());
        event.preventDefault();
    }

}

export default RegionEditPanel;


