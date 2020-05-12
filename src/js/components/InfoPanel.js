
import React from 'react';

import ExpandablePanel from './ExpandablePanel.js'


class InfoPanel extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <ExpandablePanel header={
                <div id="infoPanelButton">
                    <span>{this.props.infoTextName}</span>
                </div>
            }>
                <div id="infoPanelText">
                    {this.props.infoText}
                    <br />
                </div>
            </ExpandablePanel>
        );
    }

}

export default InfoPanel;


