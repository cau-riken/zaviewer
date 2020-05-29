import React from 'react';

class PositionInfoPanel extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        var posX, posY, posZ;
        if (this.props.livePosition) {
            posX = this.props.livePosition[0].toFixed(2);
            posY = this.props.livePosition[1].toFixed(2);
            posZ = this.props.livePosition[2].toFixed(2);
        } else {
            posX = posY = posZ = "-";
        }
        return (
            <div className="posviewPanel posTbl">
                <div>
                    <div className="posLabel"> x ( - Left, + Right)</div>
                    <div>:</div>
                    <div className="posValue">{posX}</div>
                </div>
                <div>
                    <div className="posLabel">y ( - Posterior, + Anterior)</div>
                    <div>:</div>
                    <div className="posValue">{posY}</div>
                </div>
                <div>
                    <div className="posLabel">z ( - Inferior, + Superior)</div>
                    <div>:</div>
                    <div className="posValue">{posZ}</div>
                </div>
            </div>
        );
    }
}

export default PositionInfoPanel;