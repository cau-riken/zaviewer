import React from 'react';
import ReactDOM from 'react-dom';
import classNames from "classnames";

import {
    Classes,
    Collapse,
    HotkeyConfig,
    HotkeysTarget2,
    Icon,
    Overlay,
    Position,
} from "@blueprintjs/core";

import {
    Popover2InteractionKind,
    Popover2,
} from "@blueprintjs/popover2";


import Drawer from './Drawer';

import OSDMain from './OSDMain.js';
import MeasureInfoPanel from './MeasureInfoPanel.js';
import ProcessingPanel from './ProcessingPanel.js';
import SubViewPanel from './SubViewPanel.js';
import SliderNavigatorPanel from './SliderNavigatorPanel.js';
import RegionOptions from './RegionOptions.js';
import ROIOptions from './ROIOptions.js';
import RegionEditPanel from './RegionEditPanel.js';
import QuickActionButtons from './QuickActionButtons.js';

import ViewerManager from '../ViewerManager.js'
import RegionsManager from '../RegionsManager'
import RoiInfo from "../RoiInfo";
import ZAVConfig from '../ZAVConfig.js';

import MetadataView from "./MetadataView";

import { TourContext } from './GuidedTour';

import "./ViewerComposed.scss";

const VolumeView = React.lazy(() => import('./VolumeView'));

class TitledCard extends React.Component {

    constructor(props) {
        super(props);
        this.state = { isOpen: true, isCollapsible: props.collapsed || Boolean(props.isCollapsible), isOpen: !Boolean(props.collapsed) };
    }

    render() {
        return (
            <div className={"zav-TitledCard" + (this.props.className ? ' ' + this.props.className : '')} >
                <div className={"zav-TitledCardHead"} >
                    {this.state.isCollapsible
                        ?
                        <div
                            className="zav-TitledCardHeadExpColButton"
                            onClick={() => this.setState(state => ({ isOpen: !this.state.isOpen }))}
                        >
                            <Icon
                                icon={(this.state.isOpen ? 'chevron-up' : 'chevron-down')}
                                size={12}
                            />
                        </div>
                        :
                        null
                    }
                    <div
                        style={(this.state.isCollapsible ? {} : { gridColumn: "1/3" })}
                        className="zav-TitledCardTitle">{this.props.header}</div>
                </div>
                <Collapse isOpen={this.state.isOpen}>
                    {this.props.children}
                </Collapse>
            </div>
        );
    }
}


class BrandingMark extends React.Component {

    constructor(props) {
        super(props);
        this.el = document.createElement('div');
    }
    componentDidMount() {
        this.placeHolder = document.getElementById('zav_BrandingPlaceHolder');
        this.placeHolder && this.placeHolder.appendChild(this.el);
    }
    componentWillUnmount() {
        this.placeHolder && this.placeHolder.removeChild(this.el);
    }
    render() {

        return (
            this.placeHolder ?
                ReactDOM.createPortal(
                    <div style={{ color: '#E1E1E1', verticalAlign: 'middle', fontSize: '10px' }}>
                        {this.props.brandingInfo && this.props.brandingInfo.short && <span>{this.props.brandingInfo.short}{' '}</span>}
                        {this.props.brandingInfo && this.props.brandingInfo.descr &&

                            <Popover2
                                content={
                                    <div
                                        style={{ maxWidth: '50vw', maxHeight: '50vh', overflowY: 'auto', padding: 10, fontSize: '12px' }}>
                                        <p><br />{this.props.brandingInfo.descr.split('\n').map((l, i) => <p key={i}>{l}</p>)}</p>
                                    </div>
                                }
                                position={Position.RIGHT_BOTTOM}
                                interactionKind={Popover2InteractionKind.HOVER}
                            >
                                <span
                                    style={{ color: '#E1E1E1', backgroundColor: '#515151', borderRadius: 2, padding: '0 2px', }}
                                //title="more info here!"
                                ><Icon icon='more' size={12} /></span>
                            </Popover2>


                        }
                    </div>,
                    this.el,
                )
                :
                null
        );
    }
}



//props.containerRef: React.RefObject<HTMLDivElement>,

class ViewerComposed extends React.Component {

    static contextType = TourContext;

    hotkeys = //HotkeyConfig[] 
        [
            {
                combo: "ctrl + left",
                global: true,
                label: "Go to the previous slice",
                onKeyDown: () => ViewerManager.shiftToSlice(-1),
            },
            {
                combo: "meta + left",
                global: true,
                label: "Go to the previous slice",
                onKeyDown: () => ViewerManager.shiftToSlice(-1),
            },
            {
                combo: "ctrl + right",
                global: true,
                label: "Go to the next slice",
                onKeyDown: () => ViewerManager.shiftToSlice(1),
            },
            {
                combo: "meta + right",
                global: true,
                label: "Go to the next slice",
                onKeyDown: () => ViewerManager.shiftToSlice(1),
            },
        ];

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

            //Apply simple theming according to config
            if (this.props.config && this.props.config.branding && this.props.config.branding.theme) {
                const App = document.getElementsByClassName('App');
                App.item(0).className = App.item(0).className + (this.props.config.branding.theme === 'light' ? ' theme-light' : '');
            }
        }

        const datasetDetails =
            this.props.config && this.props.config.dataset_info
                ?
                <div
                    className="zav-QuickDatasetInfoButton"
                >
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
                        interactionKind={Popover2InteractionKind.HOVER}
                    >
                        <div
                            title="display dataset informations"
                            className="zav-TitledCardButton"
                        >
                            <Icon
                                icon="info-sign"
                                color='#FFF'
                            />
                        </div>
                    </Popover2>
                </div>
                :
                null
            ;

        const globalHeaderText = (this.props.config && this.props.config.datasetId ? this.props.config.datasetId + " — " : "") + "Global view";
        const globalDatasetVersion = (this.props.config && this.props.config.datasetVersion) ? <a href={this.props.config.datasetVersion.uri} target="_blank">{this.props.config.datasetVersion.label}</a> : null;

        const globalHeader = <>
            <Popover2
                interactionKind={Popover2InteractionKind.HOVER}
                content={this.context.tourMenu}
                position={Position.LEFT}
            >
                <div
                    title="Help and guided tours!"
                    className="zav-TitledCardButton"
                >
                    <Icon
                        icon="help"
                        color='#FFF'
                    />
                </div>
            </Popover2>

            {globalHeaderText}
            {datasetDetails}
        </>;

        const region = this.state.hoveredRegion ? RegionsManager.getRegion(this.state.hoveredRegion) : null;
        const regionName = region ? region.name : "";

        const subviewTitleSuffix = (this.props.config && !this.props.config.hasMultiPlanes)
            ? (" — " + ZAVConfig.getPlaneLabel(ZAVConfig.getPreferredSubviewForPlane(this.state.activePlane)) + " view")
            : ""
            ;

        const currentTourStep = this.context.stepContext?.currentStep;
        const tourSpecificInit = {
            controlPanelExpanded: ['mainImagePanel', 'collapsedControlPanel', 'expandedRegionPanel'].includes(currentTourStep)
                ? false :
                ['expandedControlPanel', 'navigatorPanel'].includes(currentTourStep)
                    ? true
                    : undefined

        };
        if (['_init_'].includes(currentTourStep)) {
            ViewerManager.goHome(true);
        } else if (currentTourStep === 'navigatorPanel') {
            ViewerManager.setZoomFactor(50);
        }

        //url of repo from where source images can be retrieved
        const ginRepoBaseUrl= (this.props.config && this.props.config.dataset_info) ? this.props.config.dataset_info.ginRepoBaseUrl : null;
        const layerFolderMap= ginRepoBaseUrl ? this.props.config.dataset_info.layerFolderMap : null;

        return (<HotkeysTarget2 hotkeys={this.hotkeys}>

            <div style={{ height: "100%" }}>

                <BrandingMark brandingInfo={this.props.config && this.props.config.branding} />

                <div className="zav-StatusBar">
                    <div className={"zav-StatusBarContent" + ((this.state.hoveredRegion || this.state.hoveredROI) ? " hasStatus" : "") + (this.state.hoveredROI ? " isROI" : "")}>
                        {
                            this.state.hoveredRegion
                                ? <React.Fragment>
                                    <span><b>{this.state.hoveredRegion}</b>{" "}{regionName}{" "}{this.state.hoveredRegionSide}</span>
                                    {!this.props.config.hasDelineation || this.state.showRegions
                                        ? null
                                        : <span className="zav-StatusBarHint">[Shift]+Click on the image to reveal the border</span>
                                    }
                                </React.Fragment>
                                : (this.state.hoveredROI
                                    ? <span><b>{this.state.hoveredROI}</b>{" "}{this.state.hoveredROILabel}</span>
                                    : null)
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

                    forceExpanded={tourSpecificInit.controlPanelExpanded || this.state.initExpanded}

                    onExpandCollapse={this.onToolbarExpandCollapse.bind(this)}
                    quickactions={
                        <QuickActionButtons
                            hasDelineation={this.props.config && this.props.config.hasDelineation}
                            displaySettings={this.state.layerDisplaySettings}
                            showRegions={this.state.showRegions}
                            activePlane={this.state.activePlane}
                            chosenSlice={this.state.chosenSlice}
                            config={this.props.config}
                            tourMenu={this.context.tourMenu}
                        />
                    }>
                    <TitledCard
                        className="zav-controlPanel_Navigator"
                        header={globalHeader}
                    >
                        <div className="navigatorParentClass">
                            <div id={ViewerManager.NAVIGATOR_ID} className="navigatorChildClass"></div>
                            <div className="zav-DatasetVersion">{globalDatasetVersion}</div>
                        </div>
                    </TitledCard>

                    {
                        this.props.config && (this.props.config.getTotalSlidesCount() > 1) ?
                            <TitledCard
                                className="zav-controlPanel_SliceNav"
                                header={
                                    this.props.config.volumeUrl ?

                                    <div style={{width: '100%', display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Popover2
                                            interactionKind={Popover2InteractionKind.CLICK}
                                            content={
                                                <div
                                                    style={{ width: '70vw', maxWidth: 850, height: '90vh', overflowY: 'auto' }}>
                                                    <React.Suspense fallback={<div>Loading...</div>}>
                                                        <VolumeView
                                                            url={this.props.config.volumeUrl}
                                                        />
                                                    </React.Suspense>
                                                </div>}
                                            position={Position.LEFT}
                                        >
                                            <div
                                                title="display 3D volume"
                                                className="zav-TitledCardButton"
                                            >
                                                <Icon
                                                    icon="cube"
                                                    color='#FFF'
                                                />
                                            </div>
                                        </Popover2>
                                        <span>{"Slices navigation" + subviewTitleSuffix}</span>
                                    </div>
                                    :
                                    <span>{"Slices navigation" + subviewTitleSuffix}</span>
                                }>
                                <SubViewPanel
                                    activePlane={this.state.activePlane}
                                    chosenSlice={this.state.chosenSlice}
                                    config={this.props.config}
                                />
                            </TitledCard>
                            : null
                    }

                    <TitledCard
                        className="zav-controlPanel_Layers"
                        header={"Layers control"}
                        isCollapsible={true}
                    >
                        <SliderNavigatorPanel
                            hasDelineation={this.props.config && this.props.config.hasDelineation}
                            displaySettings={this.state.layerDisplaySettings} 
                            ginRepoBaseUrl={ginRepoBaseUrl}
                            layerFolderMap={layerFolderMap}
                            chosenSlice={ginRepoBaseUrl ? this.state.chosenSlice : -1}
                        />
                    </TitledCard>

                    {
                        ViewerManager.hasProcessingsModule() ?
                            <TitledCard header={"Processing"}
                                isCollapsible={true}
                            >
                                <ProcessingPanel
                                    posCount={this.state.position ? this.state.position[0].c : 0}
                                    pos={this.state.pos}
                                />
                            </TitledCard>
                            : null
                    }

                    {
                        this.props.config && this.props.config.hasDelineation ?
                            <TitledCard
                                className="zav-controlPanel_Regions"
                                header={"Atlas regions"}
                                isCollapsible={true}
                            >
                                <RegionOptions
                                    currentAtlas={this.props.config.currentAtlas}
                                    atlases={this.props.config.atlases}
                                    resetRegionsTree={this.props.resetRegionsTree}
                                    showRegions={this.state.showRegions}
                                    regionsOpacity={this.state.regionsOpacity}
                                    initRegionsOpacity={this.state.initRegionsOpacity}
                                    displayAreas={this.state.displayAreas}
                                    displayBorders={this.state.displayBorders}
                                    hasRegionLabels={this.state.hasRegionLabels}
                                    displayLabels={this.state.displayLabels}
                                    useCustomBorders={this.state.useCustomBorders}
                                    customBorderColor={this.state.customBorderColor}
                                    customBorderWidth={this.state.customBorderWidth}
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
                        this.props.config && RoiInfo.hasROI ?
                            <TitledCard
                                className="zav-controlPanel_ROIs"
                                header={"ROIs"}
                                isCollapsible={true}
                            >
                                <ROIOptions
                                    sliceHasROI={this.state.hasROIs}
                                    displayROIs={this.state.displayROIs}
                                />
                            </TitledCard>
                            : null
                    }

                    {
                        this.props.config && this.props.config.matrix ?
                            <TitledCard
                                className="zav-controlPanel_Distance"
                                header={"Distance measurement"}
                                isCollapsible={true}
                                collapsed={true}
                            >
                                <MeasureInfoPanel
                                    posCount={this.state.position ? this.state.position[0].c : 0}
                                    pos={this.state.pos} markedPos={this.state.markedPos}
                                    markedPosColors={this.state.markedPosColors}
                                />
                            </TitledCard>
                            : null
                    }

                </Drawer>

            </div>

        </HotkeysTarget2>);
    }

    onToolbarExpandCollapse(isExpanded) {
        this.setState(state => ({ isToolbarExpanded: isExpanded }));
    }

}

export default ViewerComposed;
