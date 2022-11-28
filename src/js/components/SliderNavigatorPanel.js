import React from 'react';

import {
    AnchorButton,
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
        const {
            layerid, name,
            downloadUrl, chosenSlice,
            opacity, initOpacity, enabled,
            contrast, initContrast, contrastEnabled,
            gamma, initGamma, gammaEnabled,
            isTracer, enhanceSignal, manualEnhancing, dilation,
            loading
        } = this.props;

        return (
            <div
                style={{ width: 216, marginLeft: 10 }}
            >
                <div>
                    <div style={{ position: 'relative' }}>
                        <span>{name}</span>
                        {downloadUrl ?
                            <span
                                style={{ position: 'absolute', top: 2, right: 0 }}
                                title="Download source image"
                            >
                                <AnchorButton
                                    small
                                    icon="download"                                    
                                    href={downloadUrl + 'slice1' + String(chosenSlice).padStart(4, '0') + '.png'}
                                    target="_blank"
                                />
                            </span>
                            :
                            null
                        }
                    </div>

                    <div 
                        className="zav-thinProgressBar" 
                        style={{ width: 186, }}
                    >
                        {loading && enabled ? <ProgressBar className="zav-thinProgressBar" /> : null}
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
                        defaultValue={initOpacity}
                        labelRenderer={(value) => <span>{value}<span style={{ fontSize: 8 }}>&nbsp;%</span></span>}
                        enabled={enabled}
                    />
                </div>

                {isTracer
                    ?
                    <div className="zav-AdjusterItem" style={{ marginLeft: 6 }}>
                        <span title="toggle Tracer mask enhancer">
                            <Switch
                                checked={enhanceSignal}
                                onChange={this.handleEnhanceCheck.bind(this, layerid, manualEnhancing, dilation)}
                                inline
                                disabled={!enabled}
                            />
                        </span>

                        <ParamAdjusterLabel
                            icon="heatmap"
                            label="Tracer enhancing factor"
                            noAdjust={!enhanceSignal || !manualEnhancing}
                            min={0}
                            max={21}
                            stepSize={2}
                            onChange={this.handleDilationChange.bind(this, layerid, enhanceSignal, manualEnhancing)}
                            value={dilation}

                            enabled={enabled && enhanceSignal}
                        />

                        <span title="manually set enhancement factor" style={{ paddingLeft: 4 }}>
                            <Switch
                                checked={manualEnhancing}
                                onChange={this.handleManualEnhanceCheck.bind(this, layerid, enhanceSignal, dilation)}
                                inline
                                disabled={!enabled || !enhanceSignal}
                            />
                        </span>
                    </div>

                    :
                    <React.Fragment>
                        <div className="zav-AdjusterItem" style={{ marginLeft: 6 }}>
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
                                defaultValue={initContrast}
                                enabled={enabled && contrastEnabled}
                            />
                        </div>

                        <div className="zav-AdjusterItem" style={{ marginLeft: 6 }}>
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
                                defaultValue={initGamma}
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

    handleEnhanceCheck(layerid, manualEnhancing, dilation, event) {
        ViewerManager.changeLayerDilation(layerid, event.target.checked, manualEnhancing, dilation);
    }
    handleManualEnhanceCheck(layerid, enabled, dilation, event) {
        ViewerManager.changeLayerDilation(layerid, enabled, event.target.checked, dilation);
    }
    handleDilationChange(layerid, enabled, manualEnhancing, dilation) {
        ViewerManager.changeLayerDilation(layerid, enabled, manualEnhancing, dilation);
    }

}

class SliderNavigatorPanel extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {

        const layerSliders = [];
        if (this.props.displaySettings) {
            Object.entries(this.props.displaySettings).forEach(([layerid, value]) => {

                const params = {
                    ...value,
                    ...{ layerid: layerid },
                    //url to download slice's source image from GIN server
                    ...(this.props.ginRepoBaseUrl && this.props.layerFolderMap && this.props.layerFolderMap[value.name]
                        ? 
                        { downloadUrl: this.props.ginRepoBaseUrl + '/raw/master/' + this.props.layerFolderMap[value.name] + '/',
                          chosenSlice: this.props.chosenSlice } 
                        : 
                        {}
                        )
                    
                };
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
