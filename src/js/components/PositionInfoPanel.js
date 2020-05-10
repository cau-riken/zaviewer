import React from 'react';

class PositionInfoPanel extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        var posX, posY, posZ;
        if (this.props.pos) {
            posX = this.props.pos[0].toFixed(2);
            posY = this.props.pos[1].toFixed(2);
            posZ = this.props.pos[2].toFixed(2);
        } else {
            posX = posY = posZ = "-";
        }
        return (
            <div id="posviewPanel1" className="posviewPanel posTbl zav-positionInfoPanel_container">
                <div>
                    <div>x ( - Left, + Right)</div>
                    <div>:</div>
                    <div id="posX">{posX}</div>
                </div>
                <div>
                    <div>y ( - Posterior, + Anterior)</div>
                    <div>:</div>
                    <div id="posY">{posY}</div>
                </div>
                <div>
                    <div>z ( - Inferior, + Superior)</div>
                    <div>:</div>
                    <div id="posZ">{posZ}</div>
                </div>
            </div>
        );
    }
}

export default PositionInfoPanel;