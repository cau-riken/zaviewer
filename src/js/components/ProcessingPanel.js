import React from 'react';

import {
    AnchorButton,
    HTMLSelect,
    NumericInput
} from "@blueprintjs/core";

import ViewerManager from '../ViewerManager.js'

class ProcessingPanel extends React.Component {

    constructor(props) {
        super(props);
        this.state = { selectedProcIndex: 0 };
        this.handleSelectProcessing = this.handleSelectProcessing.bind(this);
        this.handleStartProcessing = this.handleStartProcessing.bind(this);
    }

    render() {
        return (
            <React.Fragment>
                <div>
                    <div>
                        <AnchorButton
                            title={(ViewerManager.isZoomEnabled() ? "de-" : "") + "activate zooming"}
                            small
                            icon="zoom-in"
                            intent={ViewerManager.isZoomEnabled() ? "primary" : "none"}
                            onClick={() => ViewerManager.setZoomEnabled(!ViewerManager.isZoomEnabled())}
                        />
                        <div style={{ width: 160, display: "inline-block", marginLeft: 24 }} >
                            <NumericInput
                                fill={true}
                                leftIcon="percentage"
                                disabled={!ViewerManager.isZoomEnabled()}
                                value={ViewerManager.getZoomFactor()}
                                min={0.001} max={145}
                                minorStepSize={0.1} majorStepSize={10}
                                onValueChange={
                                    (valueAsNumber, valueAsString) =>
                                        ViewerManager.setZoomFactor(valueAsNumber)
                                }
                            />
                        </div>
                    </div>
                    <div>
                        <AnchorButton
                            title={(ViewerManager.isSelectClipModeOn() ? "de-" : "") + "activate clip selection for processing"}
                            small
                            icon="select"
                            intent={ViewerManager.isSelectClipModeOn() ? "primary" : "none"}
                            onClick={() => ViewerManager.setSelectClip(!ViewerManager.isSelectClipModeOn())}
                        />
                    </div>
                    <div>
                        <AnchorButton
                            title={"perform processing on selected clip"}
                            small
                            icon="derive-column"
                            disabled={!ViewerManager.isClipSelected()}
                            onClick={this.handleStartProcessing}
                        />
                        {
                            ViewerManager.hasProcessors()
                                ?
                                <div style={{ width: 160, display: "inline-block", marginLeft: 24 }} >

                                    <HTMLSelect
                                        fill={true}
                                        onChange={this.handleSelectProcessing}
                                    >
                                        {ViewerManager.getProcessors().map(
                                            (p, index) => <option key={'proc-' + index} value={index}>{p.name}</option>
                                        )}
                                    </HTMLSelect>

                                </div>
                                : null
                        }
                    </div>
                </div>
            </React.Fragment>
        );
    };

    handleSelectProcessing(event) {
        const selectedProcIndex = parseInt(event.currentTarget.value);
        this.setState({ selectedProcIndex: selectedProcIndex });
    };

    handleStartProcessing() {
        ViewerManager.performProcessing(this.state.selectedProcIndex);
    };
}

export default ProcessingPanel;