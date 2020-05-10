import React from 'react';

import OSDManager from '../OSDManager.js'


class OSDMain extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (    
            <div id={OSDManager.VIEWER_ID} className="openseadragon"></div>
        );
    }

}

export default OSDMain;