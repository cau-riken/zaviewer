import React from 'react';
import classNames from "classnames";

import {
    Classes,
    Icon,
    Overlay,
    Popover,
    PopoverInteractionKind,
    Position,

} from "@blueprintjs/core";

import Drawer from './Drawer.js';

import OSDMain from './OSDMain.js';
import MeasureInfoPanel from './MeasureInfoPanel.js';
import ProcessingPanel from './ProcessingPanel.js';
import SubViewPanel from './SubViewPanel.js';
import SliderNavigatorPanel from './SliderNavigatorPanel.js';
import RegionOptions from './RegionOptions.js';
import RegionEditPanel from './RegionEditPanel.js';
import QuickActionButtons from './QuickActionButtons.js';

import ViewerManager from '../ViewerManager.js'
import RegionsManager from '../RegionsManager.js'
import ZAVConfig from '../ZAVConfig.js';

import "./ViewerComposed.scss";


class TitledCard extends React.Component {

    render() {
        return (
            <div className="zav-TitledCard">
                <div className="zav-TitledCardTitle">{this.props.header}</div>
                {this.props.children}
            </div>
        );
    }
}

class ViewerComposed extends React.Component {

    constructor(props) {
        super(props);
        this.initialized = false;
        this.state = { showRegions: undefined, pos: undefined, initExpanded: false, isToolbarExpanded: false };
    }

    render() {

        const classes = classNames(
            Classes.CARD,
            Classes.ELEVATION_4
        );

        if (this.props.config && !this.initialized) {
            ViewerManager.init(
                this.props.config,
                (osdstatus) => { this.setState(state => ({ ...osdstatus })); },
                this.props.history
            );
            this.initialized = true;
        }


        const datasetInfo = this.props.config && this.props.config.dataset_info && this.props.config.dataset_info.thumbnailUrl
            ?
            <Popover
                interactionKind={PopoverInteractionKind.CLICK}
                position={Position.BOTTOM_RIGHT}
                disabled={!this.state.isToolbarExpanded}
                boundary="window"
                popoverClassName="bp3-popover-content-sizing"
                lazy
            >
                <div><Icon icon="map" iconSize={14} /></div>
                <div>
                    {this.props.config.dataset_info
                        ?
                        <React.Fragment>
                            <div>Dataset ID : <b>{this.props.config.dataset_info.labID}</b></div>
                            <div>Marmoset ID : <b>{this.props.config.dataset_info.marmosetID}</b></div>
                            <div>Injection Region : <b>{this.props.config.dataset_info.injRegion}</b></div>
                            { this.props.config.dataset_info.lab ? <div>Lab : <b>{this.props.config.dataset_info.lab}</b></div> : null }
                            { this.props.config.dataset_info.channel ? <div>Channel : <b>{this.props.config.dataset_info.channel}</b></div> : null }
                        </React.Fragment>
                        :
                        null
                    }
                    <img
                        src={this.props.config.dataset_info.thumbnailUrl}
                        width={250}
                        onLoad={(event) => console.info("loaded ", event)} />
                </div>
            </Popover>
            :
            null
            ;
        const globalHeaderText = (this.props.config && this.props.config.paramId ? this.props.config.paramId + " — " : "") + "Global view";
        const globalDatasetVersion = (this.props.config && this.props.config.datasetVersion) ? <a href={this.props.config.datasetVersion.uri} target="_blank">{this.props.config.datasetVersion.label}</a> : null;

        const globalHeader = <React.Fragment>{globalHeaderText}{datasetInfo}</React.Fragment>;

        const region = this.state.hoveredRegion ? RegionsManager.getRegion(this.state.hoveredRegion) : null;
        const regionName = region ? region.name : "";

        const subviewTitleSuffix = (this.props.config && !this.props.config.hasMultiPlanes)
            ? (" — " + ZAVConfig.getPlaneLabel(ZAVConfig.getPreferredSubviewForPlane(this.state.activePlane)) + " view")
            : ""
            ;

        return (
            <div style={{ height: "100%" }}>
                <div className="zav-StatusBar">
                    <div className="zav-StatusBarContent">
                        {
                            this.state.hoveredRegion
                                ? <React.Fragment>
                                    <span><b>{this.state.hoveredRegion}</b>{" "}{regionName}{" "}{this.state.hoveredRegionSide}</span>
                                    {this.state.showRegions
                                        ? null
                                        : <span style={{ color: "#dbdbff", fontSize: 9, marginLeft: 10 }}>[Shift]+Click on the image to reveal the border</span>
                                    }
                                </React.Fragment>
                                : null
                        }
                    </div>
                </div>

                <OSDMain />
                <Overlay
                    className={Classes.OVERLAY_SCROLL_CONTAINER}
                    isOpen={this.state.longRunningMessage}
                >
                    <div
                        style={{ left: "calc(50vw - 200px)", margin: "10vh 0", top: 0, width: 400 }}
                        className={classes} >
                        <h3><Icon icon="pulse" />{" Please wait"}</h3>
                        <p>
                            {this.state.longRunningMessage}
                        </p>
                    </div>
                </Overlay>

                <Drawer
                    id="ZAV-rightPanel"
                    initExpanded={this.state.initExpanded}
                    onExpandCollapse={this.onToolbarExpandCollapse.bind(this)}
                    quickactions={
                        <QuickActionButtons
                            hasDelineation={this.props.config && this.props.config.hasDelineation}
                            displaySettings={this.state.layerDisplaySettings}
                            showRegions={this.state.showRegions}
                            activePlane={this.state.activePlane}
                            chosenSlice={this.state.chosenSlice}
                            config={this.props.config} />
                    }>
                    <TitledCard header={globalHeader}>
                        <div className="navigatorParentClass">
                            <div id={ViewerManager.NAVIGATOR_ID} className="navigatorChildClass"></div>
                            <div className="zav-DatasetVersion">{globalDatasetVersion}</div>
                        </div>
                    </TitledCard>

                    {
                        this.props.config && this.props.config.matrix ?
                            <TitledCard header={"Distance measurement"}>
                                <MeasureInfoPanel
                                    posCount={this.state.position ? this.state.position[0].c : 0}
                                    pos={this.state.pos} markedPos={this.state.markedPos}
                                    markedPosColors={this.state.markedPosColors}
                                />
                            </TitledCard>
                            : null
                    }

                    <TitledCard header={"Layers control"}>
                        <SliderNavigatorPanel
                            hasDelineation={this.props.config && this.props.config.hasDelineation}
                            displaySettings={this.state.layerDisplaySettings} />
                    </TitledCard>

                    {
                        ViewerManager.hasProcessingsModule() ?
                            <TitledCard header={"Processing"}>
                                <ProcessingPanel
                                    posCount={this.state.position ? this.state.position[0].c : 0}
                                    pos={this.state.pos}
                                />
                            </TitledCard>
                            : null
                    }

                    {
                        this.props.config && this.props.config.hasDelineation ?
                            <TitledCard header={"Atlas regions"}>
                                <RegionOptions
                                    showRegions={this.state.showRegions}
                                    regionsOpacity={this.state.regionsOpacity}
                                    displayAreas={this.state.displayAreas}
                                    displayBorders={this.state.displayBorders}
                                />
                                {
                                    this.state.editModeOn
                                        ?
                                        <React.Fragment>
                                            <div style={{ borderBottom: "dotted 1px #8a8a8a", margin: "3px 0" }} />
                                            <RegionEditPanel
                                                lastSelectedPath={this.state.lastSelectedPath}
                                                editModeOn={this.state.editModeOn}
                                                editingActive={this.state.editingActive}
                                                editPathId={this.state.editPathId}
                                                editPathFillColor={this.state.editPathFillColor}
                                                editingTool={this.state.editingTool}
                                                editingToolRadius={this.state.editingToolRadius}
                                            />
                                        </React.Fragment>
                                        :
                                        null
                                }
                            </TitledCard>
                            : null
                    }

                    {
                        this.props.config && (this.props.config.getTotalSlidesCount() > 1) ?
                            <TitledCard header={"Slices navigation" + subviewTitleSuffix}>
                                <SubViewPanel
                                    activePlane={this.state.activePlane}
                                    chosenSlice={this.state.chosenSlice}
                                    config={this.props.config}
                                />
                            </TitledCard>
                            : null
                    }

                </Drawer>

            </div>
        );
    }

    onToolbarExpandCollapse(isExpanded) {
        this.setState(state => ({ isToolbarExpanded: isExpanded }));
    }

}

export default ViewerComposed;
