export interface IROIsPayload {
    datasetId: string,
    displayRoi: boolean,  //default value to display ROI, (unless user preferences is already set)
    rois: IRoi[],
};

export interface IRoi {

    roiId: string,            //ID of the ROI
    roiLabel: string,         //label of the ROI
    fill: string,             //fill color 
    centerSlice?: number,     //in single axis mode 
    centerSlices?: {          //in multi-plane mode, center slice numbers are indexed by axis shortnames
        a: number;
        c: number;
        s: number;
    },                        

};


export class RoiInfos {

    private static roiById = new Map<string, IRoi>();
    static hasROI = this.roiById.size > 0;

    /**
     * Retrieve region data associated to a configuration 
     * @param {string} config - 
     * @param {function} callbackWhenChanged - function asynchronously invoked to signal that the region data have changed
     */

    static init(data: IROIsPayload) {
        this.roiById = new Map<string, IRoi>(
            data.rois.map(r => [r.roiId, r])
        );
        this.hasROI = this.roiById.size > 0;
    };

    static getRoiById(roiId: string) {
        return this.roiById.get(roiId);
    };

    static getRois() {
        return Array.from(this.roiById.values());
    };

};

export default RoiInfos;

