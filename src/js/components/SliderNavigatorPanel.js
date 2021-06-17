import React from 'react';

import _ from 'underscore';

import {
    ProgressBar,
    Switch
} from "@blueprintjs/core";

import ParamAdjusterLabel from './ParamAdjusterLabel.js';

import ViewerManager from '../ViewerManager.js';

import "./SliderNavigatorPanel.scss";

class LayerSlider extends React.Component {
    constructor(props) {
        super(props);

        this.handleOpacityChange = this.handleOpacityChange.bind(this);
        this.handleCheckedChange = this.handleCheckedChange.bind(this);
    }
    render() {
        const { layerid, name, opacity, enabled, isTracer, contrast, contrastEnabled, gamma, gammaEnabled, enhanceSignal, dilation, loading } = this.props;

        return (
            <div
                style={{ width: 196, marginLeft: 10 }}
            >

                <div>
                    {name}
                    <div className="zav-thinProgressBar">
                        {loading && enabled ? <ProgressBar className="zav-thinProgressBar"/> : null }
                    </div>
                </div>
                <div className="zav-AdjusterItem">
                    <span title="toggle layer's visibility">
                        <Switch
                            checked={enabled}
                            onChange={this.handleCheckedChange.bind(this, layerid, opacity)}
                            inline
                        />
                    </span>
                    <ParamAdjusterLabel
                        icon="eye-open"
                        label="Opacity"
                        min={0}
                        max={100}
                        stepSize={1}
                        onChange={this.handleOpacityChange.bind(this, layerid, enabled)}
                        value={opacity}
                        labelRenderer={(value) => <span>{value}<span style={{ fontSize: 8 }}>&nbsp;%</span></span>}
                        enabled={enabled}
                    />
                </div>

                {isTracer
                    ?
                    <div className="zav-AdjusterItem" style={{marginLeft: 6}}>
                        <span title="toggle Tracer mask enhancer">
                            <Switch
                                checked={enhanceSignal}
                                onChange={this.handleEnhanceCheck.bind(this, layerid)}
                                inline
                                disabled={!enabled}
                            />
                        </span>

                        <ParamAdjusterLabel
                            icon="heatmap"
                            noAdjust={true}
                            value={dilation}
                            enabled={enabled && enhanceSignal}
                        />

                    </div>

                    :
                    <React.Fragment>
                        <div className="zav-AdjusterItem" style={{marginLeft: 6}}>
                            <span title="toggle layer's contrast correction">
                                <Switch
                                    checked={contrastEnabled}
                                    onChange={this.handleContrastCheck.bind(this, layerid, contrast)}
                                    inline
                                    disabled={!enabled}
                                />
                            </span>

                            <ParamAdjusterLabel
                                icon="contrast"
                                label="Contrast"
                                min={0}
                                max={4.5}
                                stepSize={0.01}
                                onChange={this.handleContrastChange.bind(this, layerid, contrastEnabled)}
                                value={contrast}
                                enabled={enabled && contrastEnabled}
                            />
                        </div>

                        <div className="zav-AdjusterItem" style={{marginLeft: 6}}>
                            <span title="toggle layer's gamma correction">
                                <Switch
                                    checked={gammaEnabled}
                                    onChange={this.handleGammaCheck.bind(this, layerid, gamma)}
                                    inline
                                    disabled={!enabled}
                                />
                            </span>

                            <ParamAdjusterLabel
                                icon={<span className="bp3-icon" style={{ display: "inline-block", width: 16, marginRight: 10, texAlign: "right" }}>𝛄</span>}
                                label="Gamma"
                                min={0}
                                max={4.5}
                                stepSize={0.01}
                                onChange={this.handleGammaChange.bind(this, layerid, gammaEnabled)}
                                value={gamma}
                                enabled={enabled && gammaEnabled}
                            />
                        </div>

                    </React.Fragment>
                }

            </div>

        );
    }

    handleOpacityChange(layerid, enabled, value) {
        ViewerManager.changeLayerOpacity(layerid, enabled, value);
    }
    handleCheckedChange(layerid, opacity, event) {
        ViewerManager.changeLayerOpacity(layerid, event.target.checked, opacity);
    }

    handleContrastChange(layerid, enabled, value) {
        ViewerManager.changeLayerContrast(layerid, enabled, Math.round(value * 100) / 100);
    }
    handleContrastCheck(layerid, contrast, event) {
        ViewerManager.changeLayerContrast(layerid, event.target.checked, contrast);
    }

    handleGammaChange(layerid, enabled, value) {
        ViewerManager.changeLayerGamma(layerid, enabled, Math.round(value * 100) / 100);
    }
    handleGammaCheck(layerid, gamma, event) {
        ViewerManager.changeLayerGamma(layerid, event.target.checked, gamma);
    }

    handleEnhanceCheck(layerid, event) {
        ViewerManager.changeLayerEnhancer(layerid, event.target.checked);
    }

}

class SliderNavigatorPanel extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {

        const layerSliders = [];
        if (this.props.displaySettings) {
            _.each(this.props.displaySettings, function (value, layerid) {
                var params = _.extend(value, { layerid: layerid });
                layerSliders.push(<LayerSlider key={"slid_" + layerid}  {...params} />);
                layerSliders.push(<div key={"sepslid_" + layerid} style={{ borderBottom: "dotted 1px #8a8a8a", margin: "3px 0" }} />);
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