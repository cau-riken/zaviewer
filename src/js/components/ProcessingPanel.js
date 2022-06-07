import React from 'react';

import {
    AnchorButton,
    HTMLSelect,
    NumericInput,
    ProgressBar
} from "@blueprintjs/core";

import ViewerManager from '../ViewerManager.js'

class ProcessingPanel extends React.Component {

    constructor(props) {
        super(props);
        this.handleSelectProcessing = this.handleSelectProcessing.bind(this);
        this.handleStartProcessing = this.handleStartProcessing.bind(this);
        this.handleSaveProcessedImage = this.handleSaveProcessedImage.bind(this);
    }

    render() {
        const selectProcIndex = ViewerManager.getSelectedProcessorIndex();
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
                                asyncControl={true}
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
                        <div style={{ height: 5, margin: "5px 0" }}>
                            {ViewerManager.isProcessingActive() ? <ProgressBar className="zav-thinProgressBar" /> : null}
                        </div>
                        <AnchorButton
                            title={"perform processing on selected clip"}
                            small
                            icon="derive-column"
                            disabled={!ViewerManager.isClipSelected() && ViewerManager.isProcessingActive()}
                            onClick={this.handleStartProcessing}
                        />
                        {
                            ViewerManager.hasProcessors()
                                ?
                                <div style={{ width: 160, display: "inline-block", marginLeft: 24 }} >

                                    <HTMLSelect
                                        fill={true}
                                        onChange={this.handleSelectProcessing}
                                        disabled={ViewerManager.isProcessingActive()}
                                        defaultValue={selectProcIndex}
                                    >
                                        {ViewerManager.getProcessors().map(
                                            (p, index) => <option key={'proc-' + index} value={index}>{p.name}</option>
                                        )}
                                    </HTMLSelect>

                                </div>
                                : null
                        }
                        <AnchorButton
                            title={"save result image"}
                            small
                            icon="floppy-disk"
                            disabled={!ViewerManager.getProcessedImage()}
                            onClick={this.handleSaveProcessedImage}
                        />

                    </div>
                </div>
            </React.Fragment>
        );
    };

    handleSelectProcessing(event) {
        const selectedProcIndex = parseInt(event.currentTarget.value);
        ViewerManager.setSelectedProcessorIndex(selectedProcIndex);
    };

    handleStartProcessing() {
        ViewerManager.performProcessing(ViewerManager.getSelectedProcessorIndex());
    };

    handleSaveProcessedImage() {
        const imageObj = ViewerManager.getProcessedImage();
        if (imageObj) {
            //trigger "download" of processed image
            const link = document.createElement('a');
            link.download = imageObj.name ? imageObj.name + '.png' : 'customprocessing-image.png';
            link.href = imageObj.src;
            link.click();
        }
    };

}

export default ProcessingPanel;