import React from 'react';

import ExpPanel from './ExpPanel.js';

class MeasureInfoPanel extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        var distance = "";
        var posx = ["-", "-"];
        var posy = ["-", "-"];
        const markedPos = this.props.markedPos;
        for (var i = 0; i < this.props.posCount; i++) {
            posx[i] = (markedPos[i].x + ".00").replace(/(\.\d{2}).*$/, "$1");
            posy[i] = (markedPos[i].y + ".00").replace(/(\.\d{2}).*$/, "$1");
        }
        if (this.props.posCount === 2) {
            distance = (Math.sqrt(Math.pow((markedPos[0].x - markedPos[1].x), 2) + Math.pow((markedPos[0].y - markedPos[1].y), 2)) + ".00").replace(/(\.\d{2}).*$/, "$1");
        }

        return (

            <ExpPanel
                header={<div id="posDis">Distance:<span id="posdistance">{distance}</span>(mm)</div>}
            >
                <div className="posTbl">
                    <div><div>P1</div>&nbsp;(<div id="pos1x">{posx[0]}</div>,&nbsp;<div id="pos1y">{posy[0]}</div>)</div>
                    <div><div>P2</div>&nbsp;(<div id="pos2x">{posx[1]}</div>,&nbsp;<div id="pos2y">{posy[1]}</div>)</div>
                </div>
            </ExpPanel>
        );
    }
}

export default MeasureInfoPanel;