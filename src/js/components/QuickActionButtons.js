
import React from 'react';

import RegionsManager from '../RegionsManager.js'
import ViewerManager from '../ViewerManager.js'

class SmallButton extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div
                className="zav-MiniButton"
                onClick={this.props.onClick}
                title={this.props.title}
            >
                {this.props.children}
            </div>
        );
    }

}

class QuickActionButtons extends React.Component {

    constructor(props) {
        super(props);
        this.handleClickHideShow = this.handleClickHideShow.bind(this);
        this.handleClickGotoSlice = this.handleClickGotoSlice.bind(this);
    }

    render() {
        /*
        const regionId = RegionsManager.getLastSelected();
        const region = regionId ? RegionsManager.getRegion(regionId) : null;
        */
        const smallWidgets = [];
        if (this.props.hasDelineation) {
            smallWidgets.push(
                <SmallButton
                    title="toggle display of regions"
                    onClick={this.handleClickHideShow}
                >
                    {this.props.showRegions ? "⦾" : "⦿"}
                </SmallButton>
            );
        }
        smallWidgets.push(
            <SmallButton
                title="go to 10 slices backward"
                onClick={this.handleClickGotoSlice.bind(this, -10)}
            >
                <span style={{ letterSpacing: -4 }}>⯇⯇</span>
            </SmallButton>
        );
        smallWidgets.push(
            <SmallButton
                title="go to previous slice"
                onClick={this.handleClickGotoSlice.bind(this, -1)}
            >
                ⯇
            </SmallButton>
        );

        smallWidgets.push(
            <div
                title={this.props.config ? ("slice #" + this.props.coronalChosenSlice + " of " + (this.props.config.coronalSlideCount - 1)) : "index of current slice" }
                style={{ margin: "10px 0", width: 22, height: 18, background: "white", fontSize: 8 }}
            >
                {this.props.coronalChosenSlice}
            </div>
        );

        smallWidgets.push(
            <SmallButton
                title="go to next slice"
                onClick={this.handleClickGotoSlice.bind(this, 1)}
            >
                ⯈
            </SmallButton>
        );
        smallWidgets.push(
            <SmallButton
                title="go to 10 slices forward"
                onClick={this.handleClickGotoSlice.bind(this, 10)}
            >
                <span style={{ letterSpacing: -4 }}>⯈⯈</span>
            </SmallButton>
        );
        return (
            <React.Fragment>
                {smallWidgets}
            </React.Fragment>
        );
    }

    handleClickHideShow() {
        ViewerManager.changeRegionsVisibility(!this.props.showRegions);
    }

    handleClickGotoSlice(increment) {
        ViewerManager.goToSlice(ViewerManager.CORONAL, this.props.coronalChosenSlice + increment);
    }

}

export default QuickActionButtons;
