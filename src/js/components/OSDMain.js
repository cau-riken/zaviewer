import React from 'react';

import ViewerManager from '../ViewerManager.js'

import "./OSDMain.scss";

class OSDMain extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div id={ViewerManager.VIEWER_ID} className="openseadragon"></div>
        );
    }

}

export default OSDMain;