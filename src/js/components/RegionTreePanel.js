import React from 'react';

import _ from 'underscore';

import {
    AnchorButton,
    FormGroup,
    Icon,
    InputGroup,
    Popover,
    PopoverInteractionKind,
    Position,
    Switch,
    Toaster
} from "@blueprintjs/core";

import RegionsManager from '../RegionsManager'
import ViewerManager from '../ViewerManager.js'

import "./RegionTreePanel.scss";

const TREE_ACTIONSOURCEID = 'TREE'
const RegionDetailToaster = Toaster.create({
    className: "zav-RegionToaster",
    position: Position.TOP,
});

class RegionItemLabel extends React.Component {
    render() {
        const region = this.props.region;
        return (
            <span
                className="zav-TreeItemLabel"
            >
                <span
                    className="zav-TreeItemLabelBullet"
                    data-exists={1 === region.exists}
                    style={{ backgroundColor: this.props.region.color ? (region.exists ? region.color : region.color + "30") : "transparent" }}
                    onMouseEnter={this.props.onBulletMouseEnter ? this.props.onBulletMouseEnter : null}
                    onMouseLeave={this.props.onBulletMouseLeave ? this.props.onBulletMouseLeave : null}
                    onClick={this.props.onBulletClick ? this.props.onBulletClick : null}
                />
                <b>{region.abb}</b> <span>{region.name}</span>
            </span>
        );
    }
}

class RegionItem extends React.Component {

    constructor(props) {
        super(props);
        this.treeItemRef = React.createRef();

        this.state = { isHovered: false };

        this.selectRegionClick = function (event) { this.regionClick(event, false) }.bind(this);
        this.expandCollapseClick = this.expandCollapseClick.bind(this);
        this.expandCollapseDblClick = this.expandCollapseDblClick.bind(this);

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
            this.regionActionner.lastActionInitiatedByOther()
            //prevent scrolling if region is hidden due to filtering 
            && RegionsManager.getHighlightStatus(region.abb) !== "0") {
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
                        onDoubleClick={this.expandCollapseDblClick}
                    >
                        <span
                            className="zav-TreeItemHandle"
                            data-haschild={null != subregions}
                            data-isexpanded={isExpanded}
                            onClick={this.expandCollapseClick}
                        >
                            <span className="zav-TreeItemHandleText" />
                        </span>
                        <RegionItemLabel
                            region={region}
                            //to trigger visually highlighting of region and its descendants 
                            onBulletMouseEnter={(e) => this.setState(state => ({ isHovered: true }))}
                            onBulletMouseLeave={(e) => this.setState(state => ({ isHovered: false }))}
                        />
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

    expandCollapseDblClick(event) {
        event.stopPropagation();
        this.regionActionner.toogleExpandedAllFrom(this.props.regionId);
    }
}

class RegionDetail extends React.Component {
    constructor(props) {
        super(props);
        this.goToSlice = this.goToCenterSlice.bind(this);
        this.showRegions = this.showRegions.bind(this);
    }

    render() {
        const region = RegionsManager.getRegion(this.props.regionId);

        let grouping = null;
        if (region) {
            if (region.groups) {
                const groupingInfo = [];
                //Note: groups id are unique and can be found in several grouping schemes 
                _.chain(region.groups)
                    .pairs()
                    .groupBy(sgPair => sgPair[1])
                    .each((sgPairs, groupid) => {
                        const partOf = sgPairs.map(sgPair => RegionsManager.getGrouping(sgPair[0]).name).join(", ");
                        const firstGrouping = sgPairs[0][0];
                        groupingInfo.push(
                            <div key={groupid} className="zav-RegionDetailGroupings">
                                <div>
                                    <Icon icon="search-around" />
                                    <span style={{ fontStyle: "italic", fontSize: 12, marginLeft: 16 }}>part of </span>
                                    <b>{RegionsManager.getGroupName(firstGrouping, groupid)}</b>
                                </div>
                                {"in grouping" + (sgPairs.length > 1 ? "s" : "") + " :"}
                                <ul>
                                    {sgPairs.map(sgPair => <li>{RegionsManager.getGrouping(sgPair[0]).name}</li>)}
                                </ul>
                            </div>
                        );
                    })
                grouping = groupingInfo.length
                    ?
                    <Popover
                        interactionKind={PopoverInteractionKind.HOVER}
                        popoverClassName="bp3-popover-content-sizing"
                        position={Position.RIGHT}
                        boundary="window"
                    >
                        <Icon icon="search-around" iconSize={12} className="zav-RegionGrpngsTarget" />
                        <div>{groupingInfo}</div>
                    </Popover>
                    :
                    null
                    ;
            }

            const hasCenterSliceInfo = region?.centerSlices || typeof region?.centerSlice != 'undefined';
            const crumbs = []
            region.trail.forEach(rId => {
                crumbs.push(<Icon key={"i-" + rId} style={{ color: "white" }} icon="slash" />);
                crumbs.push(<span key={"s-" + rId} style={{ fontWeight: "bold" }}>{rId}</span>);
            });

            const trail = <div style={{ fontSize: 10 }}>{crumbs}{grouping}</div>;

            return (
                <div className="zav-RegionDetailContent">
                    {trail}
                    <div style={{ marginTop: 8 }}>
                        <RegionItemLabel region={region} />
                    </div>
                    <div
                        style={{ marginTop: 12, marginLeft: 10 }}
                    >
                        {hasCenterSliceInfo
                            ?
                            (<React.Fragment>
                                <div>
                                    <AnchorButton
                                        icon="compass"
                                        minimal
                                        fill
                                        onClick={this.goToCenterSlice.bind(this, false)}
                                    >Go to slice containing region center</AnchorButton>
                                </div>
                                <div>
                                    <AnchorButton
                                        icon="locate"
                                        minimal
                                        fill
                                        onClick={this.goToCenterSlice.bind(this, true)}
                                    >Go to slice and focus on region center</AnchorButton>
                                </div>
                            </React.Fragment>)
                            :
                            (region.exists
                                ?
                                null
                                :
                                <span style={{ fontStyle: "italic" }}>This region has not been identified in this dataset</span>)
                        }
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }

    goToCenterSlice(centerOnRegion) {
        const centerSlice = RegionsManager.getRegionCenterSlice(this.props.regionId, this.props.hasMultiPlanes, ViewerManager.getActivePlane());
        const regionsToCenterOn = centerOnRegion ? [this.props.regionId] : null;
        ViewerManager.goToSlice(centerSlice, regionsToCenterOn);
        if (!ViewerManager.isShowingRegions()) {
            RegionDetailToaster.show({
                message: "Do you want to show Atlas regions?",
                action: {
                    text: "show",
                    icon: "flash",
                    onClick: this.showRegions
                }
            });
        }
    }

    showRegions() {
        ViewerManager.toggleAreaDisplay();
    }

}

/** Container of the regions display as a treeview */
class RegionTree extends React.Component {

    constructor(props) {
        super(props);
        this.scrollContainerRef = React.createRef();

        this.state = { showRegionDetail: false };

        this.onRequestScrollIntoView = this.onRequestScrollIntoView.bind(this);
    }
    render() {
        return (
            <div
                ref={this.scrollContainerRef}
                className="zav-Tree"
                data-hasselectedregion={this.props.regionsStatus && this.props.regionsStatus.lastSelected != null}
            >
                <ul className="zav-TreeSubItems" style={{ marginLeft: -15 }}>
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

    handleInteraction(nextOpenState) {
        this.setState({ showRegionDetail: nextOpenState });
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

        const groupingSwitches = [];
        const that = this;
        if (RegionsManager.getGroupings()) {
            RegionsManager.getGroupings().forEach(
                (grouping, groupingId) => {
                    groupingSwitches.push(
                        <Switch
                            label={<span>List only the regions present in "<span style={{ fontStyle: "italic" }}>{grouping.name}</span>"</span>}
                            key={'switch-' + groupingId}
                            onChange={that.onOnlyGroupingChange.bind(that, groupingId)}
                            checked={RegionsManager.getHighlightingGrouping() === groupingId}
                            disabled={RegionsManager.isAutoHighlightingOn() || (RegionsManager.getHighlightingGrouping() != null && RegionsManager.getHighlightingGrouping() != groupingId)}
                        />
                    );
                }
            );
        }

        return (
            <div className="zav-SearchBox">
                <div style={{ marginLeft: 5, flexGrow: 1 }}>
                    <FormGroup>
                        <InputGroup
                            className="zav-regions_searchinput"
                            placeholder=" Region search "
                            disabled={RegionsManager.isHighlightingLocked()}
                            inline
                            value={this.state.pattern}
                            onChange={this.onPatternChange}
                            rightElement={
                                <AnchorButton
                                    icon="eraser"
                                    minimal
                                    onClick={this.searchPattern.bind(this, "")}
                                    disabled={RegionsManager.isHighlightingLocked()}
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
                            disabled={RegionsManager.getHighlightingGrouping()}
                        />
                        {groupingSwitches}
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

    onOnlyGroupingChange(scheme, event) {
        this.regionActionner.higlightByGrouping(scheme, event.target.checked);
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
            </div>;
        }
        return (
            <div className="zav-TreeStatus">
                <div className="zav-TreeStatusContent">
                    {content}
                </div>
            </div >
        );
    }


}

class RegionDetailPane extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="zav-RegionDetailPane">
                {
                    this.props.regionsStatus && this.props.regionsStatus.lastSelected
                        ?
                        <RegionDetail regionId={this.props.regionsStatus.lastSelected} hasMultiPlanes={this.props.hasMultiPlanes} />
                        : null

                }
            </div >
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
                    <RegionDetailPane regionsStatus={this.props.regionsStatus} hasMultiPlanes={this.props.hasMultiPlanes} />
                    <RegionTreeStatus regionsStatus={this.props.regionsStatus} />
                </div>
            </div>
        );
    }

}


export default RegionTreePanel;
