import React from 'react';


class Drawer extends React.Component {
    constructor(props) {
        super(props);
        this.state = { isExpanded: true };
        this.drawerRef = React.createRef();

        this.handleClick = this.handleClick.bind(this);
    }


    render() {

        return (
            <div
                ref={this.drawerRef}
                className="zav-Drawer"
                data-isexpanded={this.state.isExpanded}
            >
                <div
                    className="zav-Drawer_handle"
                    onClick={this.handleClick}
                >
                    <span>{this.state.isExpanded ? "⟫" : "⟪"}</span>
                </div>
                <div className="zav-Drawer_collapsedCont">
                    {this.props.quickactions}
                </div>
                <div className="zav-Drawer_expandedCont">
                    {this.props.children}
                </div>
            </div>
        );
    }

    handleClick() {
        this.setState(state => ({ isExpanded: !state.isExpanded }));
    }

}


export default Drawer;