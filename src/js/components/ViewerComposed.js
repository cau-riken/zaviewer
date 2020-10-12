import React from 'react';

import {
    Icon,
    Popover,
    PopoverInteractionKind,
    Position,

} from "@blueprintjs/core";

import Drawer from './Drawer.js';

import OSDMain from './OSDMain.js';
import MeasureInfoPanel from './MeasureInfoPanel.js';
import SubViewPanel from './SubViewPanel.js';
import SliderNavigatorPanel from './SliderNavigatorPanel.js';
import RegionOptions from './RegionOptions.js';
import QuickActionButtons from './QuickActionButtons.js';

import ViewerManager from '../ViewerManager.js'
import RegionsManager from '../RegionsManager.js'
import ZAVConfig from '../ZAVConfig.js';


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

        if (this.props.config && !this.initialized) {
            ViewerManager.init(
                this.props.config,
                (osdstatus) => { this.setState(state => ({ ...osdstatus })); },
                this.props.history
            );
            this.initialized = true;
        }


        const datasetInfo = this.props.config && this.props.config.fmTracerSignalImgUrl
            ?
            <Popover
                interactionKind={PopoverInteractionKind.CLICK_TARGET_ONLY}
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
                            <div>Dataset ID : <b>{this.props.config.dataset_info.id}</b></div>
                            <div>Injection Region : <b>{this.props.config.dataset_info.region}</b></div>
                            <div>Lab : <b>{this.props.config.dataset_info.lab}</b></div>
                            <div>Channel : <b>{this.props.config.dataset_info.channel}</b></div>
                        </React.Fragment>
                        :
                        null
                    }
                    <img
                        src={this.props.config.fmTracerSignalImgUrl}
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


                    <TitledCard header={"Distance measurement"}>
                        <MeasureInfoPanel
                            posCount={this.state.position ? this.state.position[0].c : 0}
                            pos={this.state.pos} markedPos={this.state.markedPos}
                            markedPosColors={this.state.markedPosColors}
                        />
                    </TitledCard>

                    <TitledCard header={"Layers control"}>
                        <SliderNavigatorPanel
                            hasDelineation={this.props.config && this.props.config.hasDelineation}
                            displaySettings={this.state.layerDisplaySettings} />
                    </TitledCard>

                    {
                        this.props.config && this.props.config.hasDelineation ?
                            <TitledCard header={"Atlas regions"}>
                                <RegionOptions
                                    showRegions={this.state.showRegions}
                                    regionsOpacity={this.state.regionsOpacity}
                                    displayAreas={this.state.displayAreas}
                                    displayBorders={this.state.displayBorders}
                                    editModeOn={this.state.editModeOn}
                                    editingActive={this.state.editingActive}
                                    editRegionId={this.state.editRegionId}
                                    editRegionColor={this.state.editRegionColor}
                                    editingTool={this.state.editingTool}
                                    editingToolRadius={this.state.editingToolRadius}
                                />
                            </TitledCard>
                            : null
                    }

                    <TitledCard header={"Slices navigation" + subviewTitleSuffix}>
                        <SubViewPanel
                            activePlane={this.state.activePlane}
                            chosenSlice={this.state.chosenSlice}
                            config={this.props.config}
                        />
                    </TitledCard>

                </Drawer>

            </div>
        );
    }

    onToolbarExpandCollapse(isExpanded) {
        this.setState(state => ({ isToolbarExpanded: isExpanded }));
    }

}

export default ViewerComposed;
