import React from 'react';

import Drawer from './Drawer.js';

import OSDMain from './OSDMain.js';
import PositionInfoPanel from './PositionInfoPanel.js';
import MeasureInfoPanel from './MeasureInfoPanel.js';
import SubViewPanel from './SubViewPanel.js';
import SliderNavigatorPanel from './SliderNavigatorPanel.js';
import RegionOptions from './RegionOptions.js';

import QuickActionButtons from './QuickActionButtons.js';

import ViewerManager from '../ViewerManager.js'

class TitledCard extends React.Component {

    render() {
        return (
            <div className="zav-TitledCard">
                <h5>{this.props.header}</h5>
                {this.props.children}
            </div>
        );
    }
}

class ViewerComposed extends React.Component {

    constructor(props) {
        super(props);
        this.initialized = false;
        this.state = { showRegions: undefined, pos: undefined };
    }

    render() {

        if (this.props.config && !this.initialized) {
            ViewerManager.init(this.props.config, (osdstatus) => {
                this.setState(state => ({ ...osdstatus }));
            });
            console.info('Initializing OSD');
            this.initialized = true;
        }

        return (
            <div style={{ height: "100%" }}>
                <OSDMain />

                <Drawer
                    id="ZAV-rightPanel"
                    width={222}
                    quickactions={
                        <QuickActionButtons
                            hasDelineation={this.props.config && this.props.config.hasDelineation}
                            showRegions={this.state.showRegions}
                            coronalChosenSlice={this.state.coronalChosenSlice}
                            config={this.props.config} />
                    }>
                    <TitledCard header={(this.props.config ? this.props.config.paramId + " — " : "") + "Global view"}>
                        <div className="navigatorParentClass">
                            <div id={ViewerManager.NAVIGATOR_ID} className="navigatorChildClass"></div>
                        </div>
                    </TitledCard>

                    <TitledCard header={"3D location"}>
                        <PositionInfoPanel livePosition={this.state.livePosition} />
                    </TitledCard>

                    <TitledCard header={"Distance measurement"}>
                        <MeasureInfoPanel
                            posCount={this.state.position ? this.state.position[0].c : 0}
                            pos={this.state.pos} markedPos={this.state.markedPos}
                            markedPosColors={this.state.markedPosColors}
                            showRegions={this.state.showRegions}
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
                                />
                            </TitledCard>
                            : null
                    }

                    <TitledCard header={"Slices navigation — Sagittal view"}>
                        <SubViewPanel
                            coronalChosenSlice={this.state.coronalChosenSlice}
                            config={this.props.config}
                            type="sagittal"
                        />
                    </TitledCard>

                </Drawer>

            </div>
        );
    }
}

export default ViewerComposed;
