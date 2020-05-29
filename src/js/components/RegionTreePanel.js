import React from 'react';

import {
    AnchorButton,
    FormGroup,
    InputGroup,
    Popover,
    PopoverInteractionKind,
    Position,
    Switch
} from "@blueprintjs/core";

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
                className="zav-TreeItemCont"
                data-isexpanded={isExpanded}
                data-islastchild={this.props.lastChild}
                data-highlight={highlightStatus}
            >
                <div
                    ref={this.treeItemRef}
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
                style={{ position: "absolute", top: (50 + 34), left: 0, bottom: (20 + 4), right: 0 }}
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
            desiredScrollY = this.scrollContainerRef.current.scrollTop + itemRect.top - contRect.top - itemHeight / 2;
            if (desiredScrollY < 0) {
                desiredScrollY = 0;
            }
        } else if (itemRect.bottom > contRect.height) {
            desiredScrollY = this.scrollContainerRef.current.scrollTop + itemRect.bottom - contRect.height + itemHeight / 2;
        }

        var desiredScrollX = null;
        if (itemRect.left < contRect.left) {
            desiredScrollX = this.scrollContainerRef.current.scrollLeft + itemRect.left - contRect.left;
            if (desiredScrollX < 0) {
                desiredScrollX = 0;
            }
        } else if (itemRect.right > contRect.width) {
            desiredScrollX = this.scrollContainerRef.current.scrollLeft + itemRect.left - contRect.left;
        }

        if (desiredScrollY || desiredScrollX) {
            var scrollArg = { behavior: 'smooth' };
            if (desiredScrollY) {
                scrollArg.top = desiredScrollY;
            }
            if (desiredScrollX) {
                scrollArg.left = desiredScrollX;
            }

            this.scrollContainerRef.current.scrollTo(scrollArg);
        }

    }
}

/** component to receive user's input trigerring region search */
class RegionTreeSearch extends React.Component {

    constructor(props) {
        super(props);
        this.state = { pattern: "" };
        this.onPatternChange = this.onPatternChange.bind(this);
        this.searchPattern = this.searchPattern.bind(this);
        this.onOnlySlicesChange = this.onOnlySlicesChange.bind(this);

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
            <div className="zav-SearchBox">
                <div style={{ marginLeft: 5, flexGrow: 1 }}>
                    <FormGroup>
                        <InputGroup

                            placeholder=" Region search "
                            disabled={RegionsManager.isAutoHighlightingOn()}
                            inline
                            value={this.state.pattern}
                            onChange={this.onPatternChange}
                            rightElement={
                                <AnchorButton
                                    icon="eraser"
                                    minimal
                                    onClick={this.searchPattern.bind(this, "")}
                                    disabled={RegionsManager.isAutoHighlightingOn()}
                                />}
                        />
                    </FormGroup>
                </div>
                <Popover
                    interactionKind={PopoverInteractionKind.HOVER}
                    popoverClassName="bp3-popover-content-sizing"
                    position={Position.BOTTOM}
                >
                    <div style={{ marginLeft: 10, marginRight: 5 }}>
                        <AnchorButton icon="cog" />
                    </div>
                    <div>
                        <Switch
                            label="List only the regions present in current slice"
                            onChange={this.onOnlySlicesChange}
                            checked={RegionsManager.isAutoHighlightingOn()}
                        />

                    </div>

                </Popover>
            </div>
        );
    }

    onPatternChange(event) {
        this.searchPattern(event.target.value);
    }

    searchPattern(pattern) {
        this.setState({ pattern: pattern });
        this.regionActionner.higlightByName(pattern);
    }

    onOnlySlicesChange(event) {
        this.regionActionner.toggleAutoHighlighting();
        this.forceUpdate();
    }

}

class RegionTreeStatus extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        var content;
        if (RegionsManager.hasHighlighting()) {
            content = <div
                style={{ color: "#8b0000", fontSize: 12 }}
                title="Number of highlighted regions"
            >
                {"(" + this.props.regionsStatus.highlighted.size + ")"}
            </div>
        }
        return (
            <div className="zav-TreeStatus">
                {content}
            </div>
        );
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
                    <RegionTreeStatus regionsStatus={this.props.regionsStatus} />
                </div>
            </div>
        );
    }

}


export default RegionTreePanel;
