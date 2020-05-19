import React from 'react';
import OSDMain from './OSDMain.js';
import PositionInfoPanel from './PositionInfoPanel.js';
import MeasureInfoPanel from './MeasureInfoPanel.js';
import SubViewPanel from './SubViewPanel.js';
import SliderNavigatorPanel from './SliderNavigatorPanel.js';
import InfoPanel from './InfoPanel.js';

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

                <div id="sliderPanel" className="sliderPanel sliderPanelShow">
                    <SliderNavigatorPanel
                        hasDelineation={this.props.config && this.props.config.hasDelineation}
                        showRegions={this.state.showRegions}
                        displaySettings={this.state.layerDisplaySettings} />
                </div>

                <div id="subviewPanel" className="subviewPanel subviewPanelShow">
                    <SubViewPanel
                        coronalChosenSlice={this.state.coronalChosenSlice}
                        config={this.props.config}
                        type="sagittal"
                    />
                </div>

                <div id="posviewPanel">
                    <PositionInfoPanel livePosition={this.state.livePosition} />
                    <MeasureInfoPanel
                        posCount={this.state.position ? this.state.position[0].c : 0}
                        pos={this.state.pos} markedPos={this.state.markedPos}
                        markedPosColors={this.state.markedPosColors}
                    />
                </div>
                <div id="infoPanel">
                    <InfoPanel
                        infoText={this.props.config && this.props.config.infoText}
                        infoTextName={this.props.config && this.props.config.infoTextName} />
                </div>

            </div>
        );
    }
}

export default ViewerComposed;