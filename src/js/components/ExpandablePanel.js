import React from 'react';

//import './ExpPanel.css';


class ExpPanel extends React.Component {

  constructor(props) {
    super(props);
    this.state = { isExpanded: true };

    // This binding is necessary to make `this` work in the callback  
    this.handleClick = this.handleClick.bind(this);
  }



  render() {
    const collapseToBottom = (this.props.collapseToBottom === true || false);

    /*
      componentDidMount() {
    const height = this.divElement.clientHeight;
    this.setState({ height });
  }
    const headerHeight=23;
    const containerStyle= collapseToBottom ? 
    (this.state.isExpanded ? { top: 0 } : { top: -1*(this.state.height-headerHeight) }) :
    (this.state.isExpanded ? { bottom: 0 } : { bottom: -1*(this.state.height-headerHeight) }) ;
    */

    //const containerStyle = this.props.width ? { width: this.props.width + "px" } : {};
    //const containerStyle = {};

    //const containerStyle= this.state.isExpanded ? { height: "auto" } : { height: 0 };
    //
/*
    const containerStyle = collapseToBottom ?
      (this.state.isExpanded ? { bottom: 0 } : { bottom: "calc( -100% )" })
      :
      (this.state.isExpanded ? { top: 0 } : { top: "calc( -100% )" }) ;
              style={containerStyle}
                      data-isexpanded={this.state.isExpanded}
        data-collapseToBottom={collapseToBottom}

*/
    const header = (
      <div className="zav-ExpPanel_header">
        <div className="zav-ExpPanel_headercontent">{this.props.header}</div>
        <div
          className="zav-ExpPanel_handle"
          data-isexpanded={this.state.isExpanded}
          onClick={this.handleClick}
        ></div>
      </div>
    );

    return (
      <div
        className="zav-ExpPanel_container"
        ref={(divElement) => { this.divElement = divElement }}
      >
        {collapseToBottom ? header : null}
        <div 
        className="zav-ExpPanel_content"
        data-isexpanded={this.state.isExpanded}
        >
          {this.props.children}
        </div>
        {collapseToBottom ? null : header}
      </div>
    );
  }

  handleClick() {
    this.setState(state => ({ isExpanded: !state.isExpanded }));
  }

}

export default ExpPanel;