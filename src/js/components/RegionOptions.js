


import React from 'react';

import {
    Switch
} from "@blueprintjs/core";

import RegionsManager from '../RegionsManager.js'
import ViewerManager from '../ViewerManager.js'


class RegionOptions extends React.Component {

    constructor(props) {
        super(props);
        this.handleClickHideShow = this.handleClickHideShow.bind(this);
    }

    render() {
        return (
            <Switch
            checked={this.props.showRegions}
            onChange={this.handleClickHideShow}
            label="display regions"
            />
        );
    }

    handleClickHideShow() {
        ViewerManager.changeRegionsVisibility(!this.props.showRegions);
    }
}

export default RegionOptions;


