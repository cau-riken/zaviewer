import React from 'react';

import ViewerManager from '../ViewerManager.js'

import "./OSDMain.scss";

class OSDMain extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div style={{ position: "relative", height: "100%", width: "100%" }}>
                <div
                    id={ViewerManager.LOADERWIDGET_ID}
                    style={{
                        position: "absolute", zIndex: 200,
                        bottom: 15, left: 0,
                        width: 350, height: 15,
                        display: "none",
                    }}>
                    <div className="zav-loader-widget" />
                </div>
                <div id={ViewerManager.VIEWER_ID} className="openseadragon"></div>
            </div>
        );
    }

}

export default OSDMain;