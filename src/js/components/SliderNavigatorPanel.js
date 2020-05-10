import React from 'react';

import ExpPanel from './ExpPanel.js';

import OSDManager from '../OSDManager.js'

class LayerSlider extends React.Component {
    constructor(props) {
        super(props);

        this.handleOpacityChange = this.handleOpacityChange.bind(this);
        this.handleCheckedChange = this.handleCheckedChange.bind(this);
        this.handleClickName = this.handleClickName.bind(this);
    }
    render() {
        const { layerid, name, opacity, enabled } = this.props;

        return (
            <div className="dataset">
                <span id={layerid + "Name"} onChange={this.handleClickName.bind(this, layerid)}>{name}</span>
                <br />
                <div>
                    <div>
                        <input type="checkbox" id={layerid + "Enabled"} className="opcChk" checked={enabled}
                            onChange={this.handleCheckedChange.bind(this, layerid, opacity)} />
                    </div>
                    <div>
                        <input
                            disabled={!enabled}
                            type="range" id={layerid} className="slider" value={opacity}
                            onChange={this.handleOpacityChange.bind(this, layerid, enabled)}
                        />
                    </div>
                    <input
                        disabled={!enabled}
                        type="text" id={layerid + "Opacity"} className="opacity" value={opacity}
                        onChange={this.handleOpacityChange.bind(this, layerid, enabled)} />
                </div>
            </div>
        );
    }

    handleOpacityChange(layerid, enabled, event) {
        OSDManager.changeLayerOpacity(layerid, enabled, event.target.value);
    }

    handleCheckedChange(layerid, opacity, event) {
        OSDManager.changeLayerOpacity(layerid, event.target.checked, opacity);
    }

    handleClickName(layerid) {
        //FIXME showInfoText & addClass("selected") to layer label
    }

}

class SliderNavigatorPanel extends React.Component {

    constructor(props) {
        super(props);
        this.handleClickHideShow = this.handleClickHideShow.bind(this);
    }

    render() {

        const layerSliders = [];
        if (this.props.displaySettings) {
            $.each(this.props.displaySettings, function (layerid, value) {
                var params = { layerid: layerid, name: value.name, opacity: value.opacity, enabled: value.enabled };
                layerSliders.push(<LayerSlider key={"slid_"+layerid}  {...params} />)
            });
        }
        var showRegionButton;
        if (this.props.hasDelineation) {
            showRegionButton= <button id="btnHideShow" onClick={this.handleClickHideShow}>
                    {this.props.showRegions ? "Hide regions" : "Show regions"}</button>;
        }

        return (

            <ExpPanel header={showRegionButton} >
                <div className="navigatorParentClass">
                    <div id={OSDManager.NAVIGATOR_ID} className="navigatorChildClass"></div>
                </div>
                <div className="sliderGroup">
                    <div id="sliderGroup1">
                        {layerSliders}
                    </div>
                </div>
            </ExpPanel>
        );
    }

    handleClickHideShow() {
        OSDManager.showRegions(!this.props.showRegions);
    }
}

export default SliderNavigatorPanel;