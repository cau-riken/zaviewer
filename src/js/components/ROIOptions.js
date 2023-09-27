import React from 'react';

import {
    Icon,
    Switch,
} from "@blueprintjs/core";

import ViewerManager from '../ViewerManager.js'
import RoiInfos from "../RoiInfo";

import "./ROIOptions.scss";
import { PLANE_ABBREVS } from '../ZAVConfig.js';


class ROIOptions extends React.Component {

    constructor(props) {
        super(props);
        this.state = { hoveredLineNum: null };

        this.activateROILine = this.activateROILine.bind(this);
        this.handleClickROIsShow = this.handleClickROIsShow.bind(this);
        this.jumpToROICenterSlice = this.jumpToROICenterSlice.bind(this);
    }


    render() {

        return (
            <div
                style={{ width: 196, marginLeft: 10 }}
            >
                {RoiInfos.hasROI
                    ?
                    <div>
                        <div title="toggle display of ROIs">
                            <Switch
                                disabled={!this.props.sliceHasROI}
                                checked={this.props.displayROIs}
                                onChange={this.handleClickROIsShow}
                                inline
                                label="ROIs"
                            />
                        </div>
                        <div className='zav-roi-list'>
                            {
                                RoiInfos.getRois().map((r, i) =>
                                    <div
                                        key={i}
                                        className={'zav-roi-list-line' + (this.state.hoveredLineNum == i ? ' zav-roi-line-active' : '')}
                                        onMouseEnter={() => this.activateROILine(i)}
                                        onMouseLeave={() => this.activateROILine(null)}
                                    >
                                        <div className='zav-roi-list-label'>{r.roiLabel}</div>
                                        <div
                                            className='zav-roi-list-button'
                                            onClick={() => this.jumpToROICenterSlice(i)}
                                            title="Go to center of this ROI"
                                        >
                                            <Icon icon={"locate"} size={12} />
                                        </div>
                                    </div>

                                )
                            }
                        </div>

                    </div>
                    :
                    null
                }
            </div>
        );
    }

    activateROILine(roiLineNum) {
        this.setState(prevState => ({ hoveredLineNum: roiLineNum }));
    }

    handleClickROIsShow() {
        ViewerManager.toggleROIDisplay();
    }

    jumpToROICenterSlice(roiLineNum) {
        if (typeof roiLineNum != 'undefined') {
            const roi = RoiInfos.getRois()[roiLineNum];
            if (roi) {

                let sliceNum;
                if (roi.centerSlices) {
                    const activePlane = ViewerManager.getActivePlane();
                    const planeAbbrev = PLANE_ABBREVS[activePlane];
                    sliceNum = roi.centerSlices[planeAbbrev];

                } else {
                    sliceNum = roi.centerSlice;
                }
                if (typeof sliceNum != 'undefined') {
                    ViewerManager.goToSlice(sliceNum, { roiId: roi.roiId });
                }
            }
        }
    }
}

export default ROIOptions;


