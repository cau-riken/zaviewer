import React from 'react';

import _ from 'underscore';

import {
    Icon,
    Popover,
    PopoverInteractionKind,
    Position,
    Slider,
} from "@blueprintjs/core";


import "./ParamAdjusterLabel.scss";

class ParamAdjusterLabel extends React.Component {

    render() {
        const icon =
            _.isString(this.props.icon)
                ?
                <Icon icon={this.props.icon} style={{ marginRight: 10 }} />
                :
                this.props.icon
            ;

        const renderedValue = this.props.labelRenderer
            ?
            this.props.labelRenderer(this.props.value)
            :
            this.props.value
            ;
        const adjLabel =
            <span className="zav-AdjusterLabel" data-disabled={!this.props.enabled}>
                {icon}
                {renderedValue}
            </span>
            ;

        return (
            this.props.enabled && !this.props.noAdjust
                ?
                <Popover
                    interactionKind={PopoverInteractionKind.HOVER}
                    position={Position.BOTTOM_RIGHT}
                    boundary="window"
                    popoverClassName="bp3-popover-content-sizing"
                    lazy
                >
                    {adjLabel}
                    <div>

                        <span>
                            {icon}
                            {this.props.label}
                        </span>
                        <div style={{ padding: 10 }}>
                            <Icon
                                icon="chevron-left"
                                title="go to previous slice"
                                style={{ paddingRight: 10, verticalAlign: "top" }}
                                onClick={this.handleClickDown.bind(this)}
                            />
                            <Slider
                                className="zav-Slider zav-OpacitySlider"
                                min={this.props.min}
                                max={this.props.max}
                                stepSize={this.props.stepSize}
                                labelStepSize={this.props.max}
                                onChange={this.props.onChange}
                                value={this.props.value}
                                showTrackFill={false}
                                labelRenderer={this.props.labelRenderer}
                                disabled={!this.props.enabled}
                            />
                            <Icon
                                icon="chevron-right"
                                title="go to next slice"
                                style={{ paddingLeft: 10, verticalAlign: "top" }}
                                onClick={this.handleClickUp.bind(this)}
                            />
                        </div>

                    </div>
                </Popover>
                :
                <React.Fragment>
                    {adjLabel}
                </React.Fragment>

        );
    }

    handleClickDown(event) {
        const newVal = this.props.value - this.props.stepSize;
        if (newVal >= this.props.min) {
            this.props.onChange(newVal);
        }
    }

    handleClickUp(event) {
        const newVal = this.props.value + this.props.stepSize;
        if (newVal <= this.props.max) {
            this.props.onChange(newVal);
        }
    }
}

export default ParamAdjusterLabel;