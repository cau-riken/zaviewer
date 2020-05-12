import React from 'react';

class ExpandablePanel extends React.Component {

  constructor(props) {
    super(props);
    this.state = { isExpanded: true };

    this.handleClick = this.handleClick.bind(this);
  }


  render() {
    const collapseToBottom = (this.props.collapseToBottom === true || false);
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

export default ExpandablePanel;