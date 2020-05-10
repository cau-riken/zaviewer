
import React from 'react';

import ExpPanel from './ExpPanel.js'


class InfoPanel extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <ExpPanel header={
                <div id="infoPanelButton">
                    <span>{this.props.infoTextName}</span>
                </div>
            }>
                <div id="infoPanelText">
                    {this.props.infoText}
                    <br />
                </div>
            </ExpPanel>
        );
    }

}

export default InfoPanel;


