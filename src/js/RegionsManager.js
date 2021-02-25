import Utils from './Utils.js';

import _ from 'underscore';

/** Class in charge of managing regions */
class RegionsManager {

    /**
     * Retreive region data associated to a configuration 
     * @param {string} config - 
     * @param {function} callbackWhenChanged - function asynchronously invoked to signal that the region data have changed
     */
    static init(config, callbackWhenChanged) {


        this.addListeners(callbackWhenChanged);

        this.status = {
            /** currently selected regions */
            selected: new Set(),
            /** last selected regions (since multi-select is allowed) */
            lastSelected: null,

            /** true when higlighting is currently on (e.g. searching for regions using a text pattern) */
            isHighlightingOn: false,
            /** true when higlighting won't be reset unless explicitely unlocked */
            highlightingLocked: false,

            /** true when automatic higlighting of regions found in current slice is on */
            autoHighlightingOn: false,

            /** list of regions present in current slice */
            currentSliceRegions: [],

            /** grouping scheme name which is currently highlighted */
            highlightedGrouping: null,

            /** currently highlighted regions (i.e. result of text search) */
            highlighted: new Set(),
            /** parents region of highlighted regions, necessary to display tree */
            filtered: new Set(),

            /** expanded status of regions tree items */
            expanded: new Map(),

            /** source of the last modification  */
            lastActionSource: '',

        }
        const that = this;

        //load regions related data
        if (config.treeUrlPath) {

            const treeDataUrl =
            config.hasBackend
            ? Utils.makePath(config.PUBLISH_PATH, config.treeUrlPath, "regionTreeGroup_" + config.paramId + ".json")
            : config.fallbackTreeUrl;
            
            $.ajax({
                url: treeDataUrl,
                type: config.hasBackend ? "POST" : "GET",
                async: true,
                dataType: 'json',
                success: function (data) {
                    
                    that.prepareData(data);
                    that.signalListeners();
                },
            });
        }
    }

    /** @private */
    static prepareData(data) {

        this.regionsData = {
            regionById: new Map(data.regions.map(r => [r.abb, r])),

            root: data.regions.find(r => null === r.parent)['abb'],

            groupsById: new Map(Object.entries(data.groupings).map(
                ([k, v], i) => [k, {
                    name: v.name,
                    groups: new Map(v.groups.map(g => [g.id, g.name]))
                }]
            )),
        }
        this.regionsData.lineage = {}

        /** add trail of ancestors to each region */
        const addTrailToRegion = function (regionId, trail) {
            const currRegion = this.regionsData.regionById.get(regionId)
            currRegion.trail = Array.from(trail);
            if (currRegion.children && currRegion.children.length) {
                trail.push(regionId);
                currRegion.children.forEach(childId => addTrailToRegion(childId, trail));
                trail.pop();
            }

        }.bind(this);


        this.regionsData.regionById.forEach((region) => {
            region.nameupper = region.name.toUpperCase();
            region.abbupper = region.abb.toUpperCase();
        });

        addTrailToRegion(this.regionsData.root, []);


        /** only first level expanded at startup */
        this._collapseAll();
        this._setExpanded(this.status.lastActionSource, this.regionsData.root, true);
    }

    /** @private */
    static signalListeners() {
        this.listeners.forEach(listener => listener(this.status));
    }

    static addListeners(callbackWhenChanged) {
        if (!this.listeners) {
            this.listeners = [];
        }

        if (callbackWhenChanged && typeof (callbackWhenChanged) === 'function') {
            try {
                this.listeners.push(callbackWhenChanged);
            } catch (ex) {
            }
        }
    }

    static isReady() {
        return (typeof this.status !== "undefined" && this.regionsData);
    }

    static getActionner(actionGroupId) {
        return new Actionner(actionGroupId);
    }

    static getLastActionSource() {
        return this.status ? this.status.lastActionSource : null;
    }

    static _setLastActionSource(actionGroupId) {
        this.status.lastActionSource = actionGroupId;
    }

    static lastActionInitiatedByOther(actionGroupId) {
        return this.getLastActionSource() && this.getLastActionSource() != actionGroupId;
    }

    static getGroupings() {
        return this.regionsData ? this.regionsData.groupsById : null;
    }

    static getGrouping(groupingScheme) {
        return this.regionsData && this.regionsData.groupsById.has(groupingScheme) ? this.regionsData.groupsById.get(groupingScheme) : null;
    }


    static getGroupName(groupingScheme, groupId) {
        return this.regionsData && this.regionsData.groupsById.has(groupingScheme) && this.regionsData.groupsById.get(groupingScheme).groups ? this.regionsData.groupsById.get(groupingScheme).groups.get(groupId) : null;
    }

    static getRoot() {
        return this.regionsData ? this.regionsData.root : null;
    }

    static getRegion(regionId) {
        return this.regionsData ? this.regionsData.regionById.get(regionId) : null;
    }

    static isSelected(regionId) {
        return this.status ? this.status.selected.has(regionId) : false;
    }

    static getLastSelected() {
        return this.status ? this.status.lastSelected : null;
    }

    static getSelectedRegions() {
        if (this.status && this.status.selected) {
            return Array.from(this.status.selected.values());
        } else {
            return [];
        }
    }

    static _replaceSelected(actionGroupId, regionId, includeChildren) {
        this.status.selected.clear();
        this._addToSelection(actionGroupId, regionId, includeChildren);
    }

    static _addToSelection(actionGroupId, regionId, includeChildren) {
        this.status.selected.add(regionId);
        this.status.lastSelected = regionId;
        //do not change expand/collapse state while an highlighting is locked
        if (!this.isHighlightingLocked()) {
            if (this.getLastActionSource() != actionGroupId) {
                this._clearHighlighting(actionGroupId);
                this._collapseAll();
            }
            this._expandFromRootTo(regionId);
        }
        this._setLastActionSource(actionGroupId);
        this.signalListeners();
    }

    static _unSelect(actionGroupId, regionId) {
        this.status.selected.delete(regionId);
        this.status.lastSelected = Array.from(this.status.selected).pop();
        this._setLastActionSource(actionGroupId);
        this.signalListeners();
    }

    static _unSelectAll(actionGroupId) {
        this.status.selected.clear();
        this.status.lastSelected = null;
        this._setLastActionSource(actionGroupId);
        this.signalListeners();
    }

    static _setExpanded(actionGroupId, regionId, expanded, silent) {
        this.status.expanded.set(regionId, Boolean(expanded));
        if (!silent) {
            this._setLastActionSource(actionGroupId);
            this.signalListeners();
        }
    }

    static _toogleExpanded(actionGroupId, regionId) {
        this._setExpanded(actionGroupId, regionId, !this.isExpanded(regionId));
    }

    static isExpanded(regionId) {
        return this.status.expanded.get(regionId);
    }

    static _expandFromRootTo(regionId) {
        const region = this.getRegion(regionId);
        if (region) {
            region.trail.forEach(ancestorId => this.status.expanded.set(ancestorId, true));
        }
    }

    static _expandCollapseAllFrom(actionGroupId, regionId, expanded, silent) {
        const childrenRegions = this.getRegion(regionId).children;
        if (childrenRegions) {
            const that = this;
            childrenRegions.forEach(
                childId => that._expandCollapseAllFrom(actionGroupId, childId, expanded, true)
            );
        }
        this._setExpanded(actionGroupId, regionId, expanded, true);
        if (!silent) {
            this._setLastActionSource(actionGroupId);
            this.signalListeners();
        }
    }

    static _collapseAll() {
        if (this.regionsData) {
            this.regionsData.regionById.forEach((region, regionId) => this.status.expanded.set(regionId, false));
        }
    }

    static isLastVisibleChild(regionId) {
        const parent = this.getRegion(this.getRegion(regionId).parent);
        if (this.hasHighlighting()) {
            const followingSiblings = parent.children.slice(parent.children.indexOf(regionId) + 1);
            const nextVisibleSiblingIndex = followingSiblings.findIndex(siblingId => this.isHighlighted(siblingId) || this.isFiltered(siblingId));
            return -1 === nextVisibleSiblingIndex;
        } else {
            return regionId === parent.children[parent.children.length - 1];
        }
    }

    static getHighlightStatus(regionId) {
        if (!this.hasHighlighting()) {
            /** no highlighting */
            return "no";
        } else if (this.isHighlighted(regionId)) {
            /** hightlighted (region of interest) */
            return "H";
        } else if (this.isFiltered(regionId)) {
            /** filtered (supporting region)*/
            return "F";
        } else {
            /** hidden */
            return "0";
        }
    }

    static hasHighlighting() {
        return this.isHighlightingOn;
    }

    static isHighlightingLocked() {
        return this.highlightingLocked;
    }

    static _lockHighlighting() {
        this.highlightingLocked = true;
    }

    static _unlockHighlighting() {
        this.highlightingLocked = false;
    }

    static _clearHighlighting(actionGroupId) {
        if (!this.isHighlightingLocked()) {
            this.status.highlighted.clear();
            this.status.filtered.clear();
            this.isHighlightingOn = false;
        }
    }

    static isHighlighted(regionId) {
        return this.status.highlighted.has(regionId);
    }
    static isFiltered(regionId) {
        return this.status.filtered.has(regionId);
    }

    static _higlightByName(actionGroupId, pattern) {
        if (!this.isHighlightingLocked()) {

            this._clearHighlighting(actionGroupId);

            if (pattern) {
                const patternupper = pattern.toUpperCase();

                /** highlight regions that match the pattern */
                this.regionsData.regionById.forEach((region, regionId) => {
                    if (region.nameupper.includes(patternupper) || region.abbupper.includes(patternupper)) {
                        this.status.highlighted.add(region.abb);
                    }
                });
                /** filtered region needed in the tree to display the highlighted ones */
                this.status.highlighted.forEach(highId => {
                    //TODO optimize: iterate from leaf to root, stop as soon as a region is already filtered cos its ancestor are also
                    this.regionsData.regionById.get(highId).trail.forEach(regionId => {
                        if (!this.status.highlighted.has(regionId)) {
                            this.status.filtered.add(regionId);
                        }
                    })

                });

                /** reset all node to expanded */
                this.regionsData.regionById.forEach((region, regionId) => this.status.expanded.set(regionId, true));

                this.isHighlightingOn = true;
            }

            this._setLastActionSource(actionGroupId);
            this.signalListeners();
        }
    }

    static getHighlightingGrouping() {
        return this.status ? this.status.highlightedGrouping : null;
    }

    static _higlightByGrouping(actionGroupId, scheme, active) {
        if (scheme && active) {
            this._unlockHighlighting();
            this.status.highlightedGrouping = scheme;
            const regionInGrouping = [];
            this.regionsData.regionById.forEach((region, regionId) => {
                if (region.groups && region.groups[scheme]) {
                    regionInGrouping.push(region.abb);
                }
            });
            this._higlightRegionSet(actionGroupId, regionInGrouping, true);
        } else {
            this._unlockHighlighting();
            this.status.highlightedGrouping = null;
            this._clearHighlighting(actionGroupId);
            this.signalListeners();
        }
    }

    static isAutoHighlightingOn() {
        return this.status && this.status.autoHighlightingOn;
    }

    static _toggleAutoHighlighting(actionGroupId) {
        this.status.autoHighlightingOn = !this.status.autoHighlightingOn;
        if (this.isAutoHighlightingOn()) {
            this._higlightCurrentSliceRegions(actionGroupId);
        } else {
            this._unlockHighlighting();
            this._clearHighlighting(actionGroupId);
            this.signalListeners();
        }
    }


    static _higlightCurrentSliceRegions(actionGroupId) {
        this._unlockHighlighting();
        this._higlightRegionSet(actionGroupId, this.status.currentSliceRegions);
        this._lockHighlighting();
    }

    static setCurrentSliceRegions(regions) {
        if (this.status) {
            this.status.currentSliceRegions = regions;
            if (this.isAutoHighlightingOn()) {
                this._higlightCurrentSliceRegions()
            }
        }
    }

    static _higlightRegionSet(actionGroupId, regions, andLock) {
        if (!this.isHighlightingLocked()) {

            this._clearHighlighting(actionGroupId);

            if (regions.length) {

                regions.forEach(highId => {
                    const region = this.regionsData.regionById.get(highId);
                    if (region) {
                        /** add specified regions to highlighted set */
                        this.status.highlighted.add(highId);

                        /** add filtered region needed in the tree to display the highlighted ones */
                        region.trail.forEach(regionId => {
                            if (!this.status.highlighted.has(regionId)) {
                                this.status.filtered.add(regionId);
                            }
                        })
                    }
                }, this);


                /** reset all node to expanded */
                this.regionsData.regionById.forEach((region, regionId) => this.status.expanded.set(regionId, true));

                this.isHighlightingOn = true;
            }

            this._setLastActionSource(actionGroupId);
            if (andLock) {
                this._lockHighlighting();
            }
            this.signalListeners();
        }
    }

}

/** Facade used to alter status of RegionManager while keeping track of the source of the modifications */
class Actionner {

    constructor(actionGroupId) {
        this.actionGroupId = actionGroupId
        this.debouncedHiglightByName = _.debounce(RegionsManager._higlightByName, 300).bind(RegionsManager);

    }

    replaceSelected(regionId, includeChildren) {
        RegionsManager._replaceSelected(this.actionGroupId, regionId, includeChildren);
    }

    addToSelection(regionId, includeChildren) {
        RegionsManager._addToSelection(this.actionGroupId, regionId, includeChildren);
    }

    unSelect(regionId) {
        RegionsManager._unSelect(this.actionGroupId, regionId);
    }
    unSelectAll() {
        RegionsManager._unSelectAll(this.actionGroupId);
    }

    setExpanded(regionId, expanded) {
        if (RegionsManager.isReady()) {
            RegionsManager._setExpanded(this.actionGroupId, regionId, expanded);
        }
    }

    toogleExpanded(regionId) {
        if (RegionsManager.isReady()) {
            RegionsManager._toogleExpanded(this.actionGroupId, regionId);
        }
    }

    toogleExpandedAllFrom(regionId) {
        if (RegionsManager.isReady()) {
            RegionsManager._expandCollapseAllFrom(this.actionGroupId, regionId, !RegionsManager.isExpanded(regionId));
        }
    }

    expandCollapseAllFrom(regionId, expanded) {
        if (RegionsManager.isReady()) {
            RegionsManager._expandCollapseAllFrom(this.actionGroupId, regionId, expanded);
        }
    }

    lockHighlighting() {
        if (RegionsManager.isReady()) {
            RegionsManager._lockHighlighting(this.actionGroupId);
        }
    }

    unlockHighlighting() {
        if (RegionsManager.isReady()) {
            RegionsManager._unlockHighlighting(this.actionGroupId);
        }
    }

    higlightByName(pattern) {
        if (RegionsManager.isReady()) {
            // even though actual process is debounced, change of Actionner must be recorded immediately
            RegionsManager._setLastActionSource(this.actionGroupId);
            this.debouncedHiglightByName(this.actionGroupId, pattern);
        }
    }

    higlightByGrouping(scheme, active) {
        if (RegionsManager.isReady()) {
            RegionsManager._higlightByGrouping(this.actionGroupId, scheme, active);
        }
    }

    toggleAutoHighlighting() {
        if (RegionsManager.isReady()) {
            RegionsManager._toggleAutoHighlighting(this.actionGroupId);
        }
    }

    higlightRegions(regionSet) {
        if (RegionsManager.isReady()) {
            RegionsManager._higlightRegionSet(this.actionGroupId, regionSet);
        }
    }

    /** non-operation, just to reset the actionGroupId who takes the initiative (e.g. get focus) */
    nop() {
        _setLastActionSource(this.actionGroupId);
    }

    lastActionInitiatedByOther() {
        if (RegionsManager.isReady()) {
            return RegionsManager.lastActionInitiatedByOther(this.actionGroupId);
        }
    }


}

export default RegionsManager;
