import React from 'react';

import Drawer from './Drawer.js';


import OSDMain from './OSDMain.js';
import PositionInfoPanel from './PositionInfoPanel.js';
import MeasureInfoPanel from './MeasureInfoPanel.js';
import SubViewPanel from './SubViewPanel.js';
import SliderNavigatorPanel from './SliderNavigatorPanel.js';

import QuickActionButtons from './QuickActionButtons.js';

import ViewerManager from '../ViewerManager.js'

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
                    width={222}
                    quickactions={
                        <QuickActionButtons
                            hasDelineation={this.props.config && this.props.config.hasDelineation}
                            showRegions={this.state.showRegions}
                            coronalChosenSlice={this.state.coronalChosenSlice}
                            config={this.props.config} />
                    }>
                    <PositionInfoPanel livePosition={this.state.livePosition} />
                    <MeasureInfoPanel
                        posCount={this.state.position ? this.state.position[0].c : 0}
                        pos={this.state.pos} markedPos={this.state.markedPos}
                        markedPosColors={this.state.markedPosColors}
                    />

                    <SliderNavigatorPanel
                        hasDelineation={this.props.config && this.props.config.hasDelineation}
                        showRegions={this.state.showRegions}
                        displaySettings={this.state.layerDisplaySettings} />

                    <SubViewPanel
                        coronalChosenSlice={this.state.coronalChosenSlice}
                        config={this.props.config}
                        type="sagittal"
                    />
                </Drawer>

            </div>
        );
    }
}

export default ViewerComposed;
