import React from 'react';

import RegionsManager from '../RegionsManager.js'

const TREE_ACTIONSOURCEID = 'TREE'

class RegionItem extends React.Component {

    constructor(props) {
        super(props);
        this.treeItemRef = React.createRef();

        this.state = { isHovered: false };

        this.selectRegionClick = function (event) { this.regionClick(event, false) }.bind(this);
        this.selectRegionAndChildClick = function (event) { this.regionClick(event, true) }.bind(this);
        this.expandCollapseClick = this.expandCollapseClick.bind(this);

        this.regionActionner = RegionsManager.getActionner(TREE_ACTIONSOURCEID);
    }

    render() {
        const region = RegionsManager.getRegion(this.props.regionId);

        const paddedLinks = []

        // children regions
        var subregions = null;
        if (region.children) {
            const subItems = [];
            region.children.forEach((childId, i) => subItems.push(
                <RegionItem
                    key={"ri-" + childId}
                    lastChild={RegionsManager.isLastVisibleChild(childId)}
                    regionsStatus={this.props.regionsStatus}
                    regionId={childId}
                    requestScrollIntoView={this.props.requestScrollIntoView}
                />
            ))
            subregions =
                <ul className="zav-TreeSubItems" data-ishovered={this.state.isHovered}>
                    {subItems}
                </ul>;
        }
        const highlightStatus = RegionsManager.getHighlightStatus(region.abb);
        const isExpanded = RegionsManager.isExpanded(region.abb);

        // ensure visibility of last selected region when selection performed via other component (e.g. Viewer)
        if (RegionsManager.getLastSelected() === region.abb &&
            this.regionActionner.lastActionInitiatedByOther()) {
            setTimeout(() => {
                //20200518 FF76 : Can't directly use this.treeItemRef.current.scrollIntoView(), because can make above components dissappearing... 
                this.props.requestScrollIntoView(this.treeItemRef.current.getBoundingClientRect());
            }, 400);
        }

        return (
            <li
                ref={this.treeItemRef}
                className="zav-TreeItemCont"
                data-isexpanded={isExpanded}
                data-islastchild={this.props.lastChild}
                data-highlight={highlightStatus}
            >
                <div
                    className="zav-TreeItem"
                    data-highlight={highlightStatus}
                    data-isselected={RegionsManager.isSelected(region.abb)}
                    data-exists={1 === region.exists}
                >
                    <span className="zav-TreeItemLink" data-islastchild={this.props.lastChild} />
                    <span
                        className="zav-TreeItemHeader"
                        //append low opacity to specified region color for border 
                        style={{ borderColor: region.color ? region.color + "20" : "#80808024" }}
                        onClick={region.exists ? this.selectRegionClick : null}
                    >
                        <span
                            className="zav-TreeItemHandle"
                            data-haschild={null != subregions}
                            data-isexpanded={isExpanded}
                            onClick={this.expandCollapseClick}
                        >
                            <span className="zav-TreeItemHandleText" />
                        </span>
                        <span
                            className="zav-TreeItemLabel"
                        >
                            <span
                                className="zav-TreeItemLabelBullet"
                                style={{ backgroundColor: region.color ? (region.exists ? region.color : region.color + "30") : "transparent" }}
                                //to trigger visually highlighting of region and its descendants 
                                onMouseEnter={(e) => this.setState(state => ({ isHovered: true }))}
                                onMouseLeave={(e) => this.setState(state => ({ isHovered: false }))}
                                onClick={region.exists ? this.selectRegionAndChildClick : null}
                            />

                            <b>{region.abb}</b> <span>{region.name}</span>
                        </span>
                    </span>
                </div>
                {subregions}
            </li>
        );
    }

    regionClick(event, includeChildren) {
        if (event.ctrlKey) {
            //when Ctrl key is pressed, allow multi-select or toogle of currently selected region 
            if (RegionsManager.isSelected(this.props.regionId)) {
                this.regionActionner.unSelect(this.props.regionId, includeChildren);
            } else {
                this.regionActionner.addToSelection(this.props.regionId, includeChildren);
            }
        } else {
            this.regionActionner.replaceSelected(this.props.regionId, includeChildren);
        }

    }

    expandCollapseClick(event) {
        event.stopPropagation();
        this.regionActionner.toogleExpanded(this.props.regionId);
    }
}

/** Container of the regions display as a treeview */
class RegionTree extends React.Component {

    constructor(props) {
        super(props);
        this.scrollContainerRef = React.createRef();
        this.onRequestScrollIntoView = this.onRequestScrollIntoView.bind(this);
    }
    render() {
        return (
            <div
                ref={this.scrollContainerRef}
                className="zav-Tree"
            >
                <ul className="zav-TreeSubItems">
                    {this.props.regionsStatus ?
                        <RegionItem
                            regionsStatus={this.props.regionsStatus}
                            regionId={RegionsManager.getRoot()}
                            lastChild={true}
                            requestScrollIntoView={this.onRequestScrollIntoView}
                        />
                        :
                        null
                    }
                </ul>
            </div>
        );
    }

    onRequestScrollIntoView(itemRect) {
        const itemHeight = 22;
        const contRect = this.scrollContainerRef.current.getBoundingClientRect();

        /** vertical scroll only if region item is not already in view */
        var desiredScrollY = null;
        if (itemRect.top < contRect.top) {
            var desiredScrollY = this.scrollContainerRef.current.scrollTop + itemRect.top - contRect.top - itemHeight / 2;
            if (desiredScrollY < 0) {
                desiredScrollY = 0;
            }
        } else if (itemRect.bottom > contRect.height) {
            desiredScrollY = this.scrollContainerRef.current.scrollTop + itemRect.bottom - contRect.height + itemHeight / 2;
        }

        if (desiredScrollY) {
            this.scrollContainerRef.current.scrollTo({
                top: desiredScrollY,
                behavior: 'smooth'
            });
        }

    }
}

/** component to receive user's input trigerring region search */
class RegionTreeSearch extends React.Component {

    constructor(props) {
        super(props);
        this.state = { pattern: "" };
        this.onChange = this.onChange.bind(this);

        this.regionActionner = RegionsManager.getActionner(TREE_ACTIONSOURCEID);
    }

    static getDerivedStateFromProps(props, state) {
        if (state.pattern &&
            !RegionsManager.hasHighlighting() &&
            RegionsManager.lastActionInitiatedByOther(TREE_ACTIONSOURCEID)) {
            return { pattern: "" };
        } else {
            return state;
        }
    }

    render() {
        return (
            <div style={{ borderBottom: "solid 2px #80808042", padding: 1, background: "#333" }}>
                <input
                    placeholder=" Region search "
                    type="text"
                    value={this.state.pattern}
                    onChange={this.onChange}
                />
            </div>
        );
    }

    onChange(event) {
        const pattern = event.target.value;
        this.setState({ pattern: pattern });
        this.regionActionner.higlightByName(pattern);
    }

}

class RegionTreePanel extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div style={{ height: "100%", width: "100%" }}>

                <div style={{ height: "100%", width: "100%", overflow: "hidden", backgroundColor: "#e1e1e1" }}>
                    <RegionTreeSearch regionsStatus={this.props.regionsStatus} />
                    <RegionTree regionsStatus={this.props.regionsStatus} />
                </div>
            </div>
        );
    }

}


export default RegionTreePanel;
