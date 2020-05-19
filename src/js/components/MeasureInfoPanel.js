import React from 'react';

import ExpandablePanel from './ExpandablePanel.js';

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
            <ExpandablePanel
                header={<div style={this.props.posCount > 1 ? { color: "#fff" } : {}} id="posDis">Distance:<span id="posdistance">{distance}</span>(mm)</div>}
            >
                <div className="posTbl">
                    <div style={this.props.posCount > 0 ? { color: this.props.markedPosColors[0] } : {}}><div>P1</div>&nbsp;(<div id="pos1x">{posx[0]}</div>,&nbsp;<div id="pos1y">{posy[0]}</div>)</div>
                    <div style={this.props.posCount > 1 ? { color: this.props.markedPosColors[1] } : {}}><div>P2</div>&nbsp;(<div id="pos2x">{posx[1]}</div>,&nbsp;<div id="pos2y">{posy[1]}</div>)</div>
                </div>
            </ExpandablePanel>
        );
    }
}

export default MeasureInfoPanel;