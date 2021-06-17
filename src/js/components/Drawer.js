import React from 'react';

import { Icon } from "@blueprintjs/core";

import "./Drawer.scss";

export const LEFT = 'left';
export const RIGHT = 'right';

export class DrawerHandle extends React.Component {

    static get LEFT() {
        return LEFT;
    }
    static get RIGHT() {
        return RIGHT;
    }

    render() {
        const pointToRight = (this.props.collapseDirection === RIGHT) ? this.props.isExpanded : !this.props.isExpanded;
        return (
            <div
                className="zav-Drawer_handle"
                onClick={this.props.onClick}
            >
                <Icon icon={"caret-" + (pointToRight ? "right" : "left")} iconSize={22} />
            </div>
        );
    }

}

class Drawer extends React.Component {
    constructor(props) {
        super(props);
        this.state = { isExpanded: this.props.initExpanded };
        this.drawerRef = React.createRef();

        this.handleClick = this.handleClick.bind(this);
    }

    render() {
        return (
            <div
                id={this.props.id}
                ref={this.drawerRef}
                className="zav-Drawer"
                data-isexpanded={this.state.isExpanded}
            >
                <DrawerHandle
                    collapseDirection={DrawerHandle.RIGHT}
                    isExpanded={this.state.isExpanded}
                    onClick={this.handleClick}
                />
                <div className="zav-Drawer_collapsedCont">
                    {this.props.quickactions}
                </div>
                <div className="zav-Drawer_expandedCont">
                    <div className="zav-Drawer_expandedContWrapper">
                        {this.props.children}
                    </div>
                </div>
            </div>
        );
    }

    handleClick() {
        this.setState(state => ({ isExpanded: !state.isExpanded }));
        this.props.onExpandCollapse &&  this.props.onExpandCollapse(!this.state.isExpanded);
    }

}

export default Drawer;
