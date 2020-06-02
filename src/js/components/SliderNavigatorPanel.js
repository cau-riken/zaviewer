import React from 'react';

import {
    AnchorButton,
    Icon,
    Slider,
    Switch
} from "@blueprintjs/core";

import ViewerManager from '../ViewerManager.js'

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
            <div
                style={{ width: 196, marginLeft: 10 }}
            >
                <div title="toggle layer's visibility">
                    <Switch
                        checked={enabled}
                        onChange={this.handleCheckedChange.bind(this, layerid, opacity)}
                        label={name}
                    />
                </div>

                <div title="adjust layer's opacity">
                    <Slider
                        className="zav-Slider zav-OpacitySlider"
                        min={0}
                        max={100}
                        stepSize={1}
                        labelStepSize={100}
                        onChange={this.handleOpacityChange.bind(this, layerid, enabled)}
                        value={opacity}
                        showTrackFill={false}
                        labelRenderer={(value) => value + "%"}
                        disabled={!enabled}
                    />
                </div>
            </div>

        );
    }

    handleOpacityChange(layerid, enabled, value) {
        ViewerManager.changeLayerOpacity(layerid, enabled, value);
    }

    handleCheckedChange(layerid, opacity, event) {
        ViewerManager.changeLayerOpacity(layerid, event.target.checked, opacity);
    }

    handleClickName(layerid) {
        //FIXME showInfoText & addClass("selected") to layer label
    }

}

class SliderNavigatorPanel extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {

        const layerSliders = [];
        if (this.props.displaySettings) {
            $.each(this.props.displaySettings, function (layerid, value) {
                var params = { layerid: layerid, name: value.name, opacity: value.opacity, enabled: value.enabled };
                layerSliders.push(<LayerSlider key={"slid_" + layerid}  {...params} />);
                layerSliders.push(<div key={"sepslid_" + layerid} style={{ borderBottom: "dotted 1px #8a8a8a", marginBottom: 3 }} />);
            });
        }
        layerSliders.reverse();

        return (
            <React.Fragment>
                {layerSliders.slice(1)}
            </React.Fragment>

        );
    }

}

export default SliderNavigatorPanel;