export interface IRegionsPayload {
    regions: IRegion[],
    groupings: { g116: IGroupingDef }
};

export interface IGroupingDef {
    grouping: string,
    name: string,
    groups: IGroupDef[]
};

export interface IGroupDef {
    id: string,
    name: string,
    members: string[]
};

export interface IGroupings {
    g116: string,
}

interface IIndexedGroups {
    name: string,
    groups: Map<string, string>,
};

interface IRegionData {
    regionById: Map<string, IRegion>,
    root: string,
    groupsById: Map<string, IIndexedGroups>,
    lineage: {}
};

export interface IRegion {
    id: number,
    abb: string,            // region's abbreviation. MUST be unique as it is actually used as region identifier.
    parent: string | null,  // abbreviation of the parent region, null for the unique root region.
    name: string,           // long name of the region.
    exists: number,         // indicates if the region is identified in at least one slice (value 1, 0 otherwise)
    color: string,          // RGB hex value of the color associated to the region 
    children?: string[],    // [optional] list of abbreviation of sub-regions
    groups?: IGroupings,    //
    slices?: number[],      //FIXME Useless (not referenced, only support single axis, and slice's regions loaded from SVG)
    centerSlice?: number,     //on single axis mode 
    centerSlices?: {
        a: number;
        c: number;
        s: number;
    },      //on multi-plane mode, center slice numbers are indexed by axis shortnames
    trail?: string[],
    nameupper?: string,
    abbupper?: string,
};

export interface IRegionsStatus {

    /** currently selected regions */
    selected: Set<string>,
    /** last selected regions (since multi-select is allowed) */
    lastSelected: string | undefined,

    /** true when higlighting is currently on (e.g. searching for regions using a text pattern) */
    isHighlightingOn: boolean,
    /** true when higlighting won't be reset unless explicitely unlocked */
    highlightingLocked: boolean,

    /** true when automatic higlighting of regions found in current slice is on */
    autoHighlightingOn: boolean,

    /** list of regions present in current slice */
    currentSliceRegions: string[],

    /** grouping scheme name which is currently highlighted */
    highlightedGrouping: string | undefined,

    /** currently highlighted regions (i.e. result of text search) */
    highlighted: Set<string>,
    /** parents region of highlighted regions, necessary to display tree */
    filtered: Set<string>,

    /** expanded status of regions tree items */
    expanded: Map<string, boolean>,

    /** source of the last modification  */
    lastActionSource: string,

    loadedRegions: boolean,

};

export type ICallbackWhenChanged = (status: IRegionsStatus) => void;

/** Class in charge of managing regions */
class RegionsManager {

    static status: IRegionsStatus;
    private static regionsData: IRegionData
    private static listeners: ICallbackWhenChanged[];
    private static isHighlightingOn: boolean;
    private static highlightingLocked: boolean;


    /**
     * Retrieve region data associated to a configuration 
     * @param {string} config - 
     * @param {function} callbackWhenChanged - function asynchronously invoked to signal that the region data have changed
     */

    static init(data: IRegionsPayload, callbackWhenChanged: ICallbackWhenChanged, initSelectedRegion: string[] | undefined) {


        this.addListeners(callbackWhenChanged);

        this.status = {
            selected: new Set<string>(),
            lastSelected: undefined,
            isHighlightingOn: false,
            highlightingLocked: false,
            autoHighlightingOn: false,
            currentSliceRegions: [],
            highlightedGrouping: undefined,
            highlighted: new Set<string>(),
            filtered: new Set<string>(),
            expanded: new Map<string, boolean>(),
            lastActionSource: 'init',
            loadedRegions: false,
        }

        this.prepareData(data, initSelectedRegion);
    }

    /** @private */


    static prepareData(data: IRegionsPayload, initSelectedRegion: string[] | undefined) {
        const root = data.regions.find(r => null === r.parent);
        this.regionsData = {
            regionById: new Map(data.regions.map(r => [r.abb, r])),

            root: root?.abb,

            groupsById: new Map(Object.entries(data.groupings).map(
                ([k, v], i) => [k, {
                    name: v.name,
                    groups: new Map(v.groups.map(g => [g.id, g.name]))
                }]
            )),
            lineage: {}
        }

        const that = this;
        /** add trail of ancestors to each region */
        const addTrailToRegion = function (regionId: string, trail: string[]) {
            const currRegion = that.regionsData.regionById.get(regionId);
            if (currRegion) {
                currRegion.trail = Array.from(trail);
                if (currRegion.children && currRegion.children.length) {
                    trail.push(regionId);
                    currRegion.children.forEach(childId => addTrailToRegion(childId, trail));
                    trail.pop();
                }
            }
        };


        this.regionsData.regionById.forEach((region) => {
            region.nameupper = region.name.toUpperCase();
            region.abbupper = region.abb.toUpperCase();
        });

        addTrailToRegion(this.regionsData.root, []);

        this.status.loadedRegions = true;

        if (initSelectedRegion) {
            //initial selection of region(s)
            const validRegions = initSelectedRegion.filter((r) => this.regionsData.regionById.has(r));

            const regionsAndLeaves = validRegions.map(r => {
                const region = this.getRegion(r);
                return [
                    r,
                    ...((region?.children && region?.children.length)
                        ?
                        this._getLeafChildrenRegions(r)
                        :
                        []
                    )
                ]
            }).flat().reverse();

            this._replaceAllSelected(this.status.lastActionSource, regionsAndLeaves, true);
            //treeview needs to be expanded to display selection
            regionsAndLeaves.forEach(r => this._expandFromRootTo(r));

        } else {
            /** only first level expanded at startup */
            this._collapseAll();
            this._setExpanded(this.status.lastActionSource, this.regionsData.root, true);
        }

    }

    static setExistingRegions(existingRegions: string[]) {
        if (this.status) {
            //parents of existing regions will be tagged as existing as well
            const existsOrParent = new Set<string>();
            existingRegions.forEach(
                (regionId) => {
                    const regionInfo = this.regionsData.regionById.get(regionId);
                    if (regionInfo) {
                        existsOrParent.add(regionInfo.abb);
                        regionInfo.trail?.forEach(rid =>
                            existsOrParent.add(rid)
                        );
                    }
                }
            );
            //reset all regions 
            this.regionsData.regionById.forEach(
                (regionInfo, regionId) => {
                    if (regionInfo) {
                        regionInfo.exists = existsOrParent.has(regionId) ? 1 : 0;
                    }
                }
            );

            this.signalListeners();
        }
    }


    private static signalListeners() {
        this.status = { ...this.status };
        this.listeners.forEach(listener => listener(this.status));
    }

    static addListeners(callbackWhenChanged: ICallbackWhenChanged) {
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
        return (typeof this.status !== "undefined" && Boolean(this.regionsData));
    }

    static getActionner(actionGroupId: string) {
        return new Actionner(actionGroupId);
    }

    static getLastActionSource() {
        return this.status ? this.status.lastActionSource : null;
    }

    static _setLastActionSource(actionGroupId: string) {
        this.status.lastActionSource = actionGroupId;
    }

    static lastActionInitiatedByOther(actionGroupId: string) {
        return this.getLastActionSource() && this.getLastActionSource() != actionGroupId;
    }

    static getGroupings() {
        return this.regionsData ? this.regionsData.groupsById : undefined;
    }

    static getGrouping(groupingScheme: string,) {
        return this.regionsData && this.regionsData.groupsById.has(groupingScheme) ? this.regionsData.groupsById.get(groupingScheme) : null;
    }


    static getGroupName(groupingScheme: string, groupId: string,) {
        return this.regionsData?.groupsById.get(groupingScheme)?.groups ? this.regionsData?.groupsById?.get(groupingScheme)?.groups?.get(groupId) : undefined;
    }

    static getRoot() {
        return this.regionsData ? this.regionsData.root : undefined;
    }

    static getRegion(regionId: string): IRegion | undefined {
        return this.regionsData ? this.regionsData.regionById.get(regionId) : undefined;
    }

    static getRegionCenterSlice(regionId: string, hasMultiPlanes: boolean = false, activePlane: number = 0): number | undefined {
        const AXIAL = 1;
        const CORONAL = 2;
        const SAGITTAL = 3;

        const region = this.getRegion(regionId);
        let sliceNum = undefined;
        if (hasMultiPlanes) {
            if (activePlane) {
                if (region?.centerSlices) {
                    sliceNum = (activePlane == AXIAL) ?
                        region?.centerSlices?.a
                        : (activePlane == CORONAL) ?
                            region?.centerSlices?.c
                            : (activePlane == SAGITTAL) ?
                                region?.centerSlices?.s
                                : undefined;
                }
            } else {
                //activeplane should be specified 
            }
        } else {
            sliceNum = region?.centerSlice;
        }
        return sliceNum;

    }

    static isSelected(regionId: string | undefined): boolean {
        return regionId && this.status ? this.status.selected.has(regionId) : false;
    }

    static getLastSelected(): string | undefined {
        return this.status ? this.status.lastSelected : undefined;
    }

    static getSelectedRegions(): string[] {
        if (this.status && this.status.selected) {
            return Array.from(this.status.selected.values());
        } else {
            return [];
        }
    }

    static _replaceAllSelected(actionGroupId: string, regionIds: string[], includeChildren: boolean) {
        this.status.selected.clear();
        regionIds.forEach(regionId => {
            this.status.selected.add(regionId);
            this.status.lastSelected = regionId;
        });
        this._setLastActionSource(actionGroupId);
        this.signalListeners();
    }

    static _replaceSelected(actionGroupId: string, regionId: string, includeChildren: boolean) {
        this.status.selected.clear();
        this._addToSelection(actionGroupId, regionId, includeChildren);
    }

    static _addToSelection(actionGroupId: string, regionId: string, includeChildren: boolean) {
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

    static _unSelect(actionGroupId: string, regionId: string, includeChildren: boolean) {
        this.status.selected.delete(regionId);
        this.status.lastSelected = Array.from(this.status.selected).pop();
        this._setLastActionSource(actionGroupId);
        this.signalListeners();
    }

    static _unSelectAll(actionGroupId: string) {
        this.status.selected.clear();
        this.status.lastSelected = undefined;
        this._setLastActionSource(actionGroupId);
        this.signalListeners();
    }

    static _setExpanded(actionGroupId: string, regionId: string, expanded: boolean, silent?: boolean) {
        this.status.expanded.set(regionId, Boolean(expanded));
        if (!silent) {
            this._setLastActionSource(actionGroupId);
            this.signalListeners();
        }
    }

    static _toogleExpanded(actionGroupId: string, regionId: string) {
        this._setExpanded(actionGroupId, regionId, !this.isExpanded(regionId));
    }

    static isExpanded(regionId: string) {
        return Boolean(this.status.expanded.get(regionId));
    }

    static _expandFromRootTo(regionId: string) {
        const region = this.getRegion(regionId);
        if (region && region.trail) {
            region.trail.forEach(ancestorId => this.status.expanded.set(ancestorId, true));
        }
    }

    static _expandCollapseAllFrom(actionGroupId: string, regionId: string, expanded: boolean, silent?: boolean) {
        const region = this.getRegion(regionId);
        const childrenRegions = region ? region.children : null;
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

    static isLastVisibleChild(regionId: string) {
        const region = this.getRegion(regionId);
        const parent = region?.parent ? this.getRegion(region.parent) : undefined;
        if (this.hasHighlighting()) {
            const followingSiblings = parent?.children?.slice(parent?.children.indexOf(regionId) + 1);
            const nextVisibleSiblingIndex = followingSiblings?.findIndex(siblingId => this.isHighlighted(siblingId) || this.isFiltered(siblingId));
            return -1 === nextVisibleSiblingIndex;
        } else {
            const children = parent?.children;
            return children ? (regionId === children[children.length - 1]) : true;
        }
    }

    static _getLeafChildrenRegions(regionId: string): string[] {
        const region = this.getRegion(regionId);
        if (region?.children && region?.children.length) {
            return region.children.map(childId => this._getLeafChildrenRegions(childId)).flat();
        } else {
            return [regionId];
        }
    }

    static getHighlightStatus(regionId: string | undefined) {
        if (!regionId || !this.hasHighlighting()) {
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

    static _clearHighlighting(actionGroupId: string) {
        if (!this.isHighlightingLocked()) {
            this.status.highlighted.clear();
            this.status.filtered.clear();
            this.isHighlightingOn = false;
        }
    }

    static isHighlighted(regionId: string) {
        return this.status.highlighted.has(regionId);
    }
    static isFiltered(regionId: string) {
        return this.status.filtered.has(regionId);
    }

    static _higlightByName(actionGroupId: string, pattern: string) {
        if (!this.isHighlightingLocked()) {

            this._clearHighlighting(actionGroupId);

            if (pattern) {
                const patternupper = pattern.toUpperCase();

                /** highlight regions that match the pattern */
                this.regionsData.regionById.forEach((region, regionId) => {
                    if ((region.nameupper && region.nameupper.includes(patternupper)) || (region.abbupper && region.abbupper.includes(patternupper))) {
                        this.status.highlighted.add(region.abb);
                    }
                });
                /** filtered region needed in the tree to display the highlighted ones */
                this.status.highlighted.forEach(highId => {
                    //TODO optimize: iterate from leaf to root, stop as soon as a region is already filtered cos its ancestor are also
                    if (this.regionsData && this.regionsData.regionById.has(highId)) {
                        this.regionsData?.regionById?.get(highId)?.trail?.forEach(regionId => {
                            if (!this.status.highlighted.has(regionId)) {
                                this.status.filtered.add(regionId);
                            }
                        })
                    }
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

    static _higlightByGrouping(actionGroupId: string, scheme: string, active: boolean) {
        if (scheme && active) {
            this._unlockHighlighting();
            this.status.highlightedGrouping = scheme;
            const regionInGrouping: string[] = [];
            this.regionsData.regionById.forEach((region, regionId) => {
                if (region.groups && region.groups[scheme]) {
                    regionInGrouping.push(region.abb);
                }
            });
            this._higlightRegionSet(actionGroupId, regionInGrouping, true);
        } else {
            this._unlockHighlighting();
            this.status.highlightedGrouping = undefined;
            this._clearHighlighting(actionGroupId);
            this.signalListeners();
        }
    }

    static isAutoHighlightingOn() {
        return this.status && this.status.autoHighlightingOn;
    }

    static _toggleAutoHighlighting(actionGroupId: string) {
        this.status.autoHighlightingOn = !this.status.autoHighlightingOn;
        if (this.isAutoHighlightingOn()) {
            this._higlightCurrentSliceRegions(actionGroupId);
        } else {
            this._unlockHighlighting();
            this._clearHighlighting(actionGroupId);
            this.signalListeners();
        }
    }


    static _higlightCurrentSliceRegions(actionGroupId: string) {
        this._unlockHighlighting();
        this._higlightRegionSet(actionGroupId, this.status.currentSliceRegions);
        this._lockHighlighting();
    }

    static _setCurrentSliceRegions(actionGroupId: string, regions: string[]) {
        if (this.status) {
            this.status.currentSliceRegions = regions;
            if (this.isAutoHighlightingOn()) {
                this._higlightCurrentSliceRegions(actionGroupId);
            }
        }
    }

    static _higlightRegionSet(actionGroupId: string, regions: string[], andLock?: boolean) {
        if (!this.isHighlightingLocked()) {

            this._clearHighlighting(actionGroupId);

            if (regions.length) {

                regions.forEach(highId => {
                    const region = this.regionsData.regionById.get(highId);
                    if (region) {
                        /** add specified regions to highlighted set */
                        this.status.highlighted.add(highId);

                        /** add filtered region needed in the tree to display the highlighted ones */
                        if (region.trail) {
                            region.trail.forEach(regionId => {
                                if (!this.status.highlighted.has(regionId)) {
                                    this.status.filtered.add(regionId);
                                }
                            });
                        }
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
    actionGroupId: string;
    debouncedHiglightByName: (actionGroupId: string, pattern: string) => void;

    constructor(actionGroupId: string) {
        this.actionGroupId = actionGroupId;
        this.debouncedHiglightByName = debounce(RegionsManager._higlightByName, 300, false).bind(RegionsManager);

    }

    replaceAllSelected(regionIds: string[], includeChildren: boolean = true) {
        RegionsManager._replaceAllSelected(this.actionGroupId, regionIds, includeChildren);
    }

    replaceSelected(regionId: string, includeChildren: boolean) {
        RegionsManager._replaceSelected(this.actionGroupId, regionId, includeChildren);
    }

    addToSelection(regionId: string, includeChildren: boolean) {
        RegionsManager._addToSelection(this.actionGroupId, regionId, includeChildren);
    }

    unSelect(regionId: string, includeChildren: boolean) {
        RegionsManager._unSelect(this.actionGroupId, regionId, includeChildren);
    }
    unSelectAll() {
        RegionsManager._unSelectAll(this.actionGroupId);
    }

    setExpanded(regionId: string, expanded: boolean) {
        if (RegionsManager.isReady()) {
            RegionsManager._setExpanded(this.actionGroupId, regionId, expanded);
        }
    }

    toogleExpanded(regionId: string) {
        if (RegionsManager.isReady()) {
            RegionsManager._toogleExpanded(this.actionGroupId, regionId);
        }
    }

    toogleExpandedAllFrom(regionId: string) {
        if (RegionsManager.isReady()) {
            RegionsManager._expandCollapseAllFrom(this.actionGroupId, regionId, !RegionsManager.isExpanded(regionId));
        }
    }

    expandCollapseAllFrom(regionId: string, expanded: boolean) {
        if (RegionsManager.isReady()) {
            RegionsManager._expandCollapseAllFrom(this.actionGroupId, regionId, expanded);
        }
    }

    lockHighlighting() {
        if (RegionsManager.isReady()) {
            RegionsManager._lockHighlighting();
        }
    }

    unlockHighlighting() {
        if (RegionsManager.isReady()) {
            RegionsManager._unlockHighlighting();
        }
    }

    higlightByName(pattern: string) {
        if (RegionsManager.isReady()) {
            // even though actual process is debounced, change of Actionner must be recorded immediately
            RegionsManager._setLastActionSource(this.actionGroupId);
            this.debouncedHiglightByName(this.actionGroupId, pattern);
        }
    }

    higlightByGrouping(scheme: string, active: boolean) {
        if (RegionsManager.isReady()) {
            RegionsManager._higlightByGrouping(this.actionGroupId, scheme, active);
        }
    }

    toggleAutoHighlighting() {
        if (RegionsManager.isReady()) {
            RegionsManager._toggleAutoHighlighting(this.actionGroupId);
        }
    }

    higlightRegions(regionSet: string[]) {
        if (RegionsManager.isReady()) {
            RegionsManager._higlightRegionSet(this.actionGroupId, regionSet);
        }
    }

    setCurrentSliceRegions(regions: string[]) {
        if (RegionsManager.isReady()) {
            RegionsManager._setCurrentSliceRegions(this.actionGroupId, regions);
        }
    }

    /** non-operation, just to reset the actionGroupId who takes the initiative (e.g. get focus) */
    nop() {
        RegionsManager._setLastActionSource(this.actionGroupId);
    }

    lastActionInitiatedByOther() {
        if (RegionsManager.isReady()) {
            return RegionsManager.lastActionInitiatedByOther(this.actionGroupId);
        } else {
            return null;
        }
    }


}

export default RegionsManager;

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
//Taken from Underscore http://underscorejs.org/#debounce

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func: (...args: any[]) => any, wait: number, immediate: boolean) {
    let timeout: NodeJS.Timeout;
    return function () {
        var context = this, args = arguments;
        var later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=

