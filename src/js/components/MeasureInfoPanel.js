import React from 'react';


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
            <React.Fragment>
                <div className="distMeasure">
                    <div
                        className="posDis"
                        style={this.props.posCount > 1 ? { color: "#fff" } : {}}
                    >Distance:<span className="posdistance">{distance}</span>&nbsp;(mm)</div>
                    <div className="posPoints">
                        <div style={this.props.posCount > 0 ? { color: this.props.markedPosColors[0] } : {}}>
                            <span>P1</span>&nbsp;(<span>{posx[0]}</span>,&nbsp;<span>{posy[0]}</span>)
                        </div>
                        <div style={this.props.posCount > 1 ? { color: this.props.markedPosColors[1] } : {}}>
                            <span>P2</span>&nbsp;(<span>{posx[1]}</span>,&nbsp;<span>{posy[1]}</span>)
                            </div>
                    </div>
                </div>
            </React.Fragment>

        );
    }
}

export default MeasureInfoPanel;