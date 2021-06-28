export interface ImageConfig {
    imageBaseUrl: string,
    snapshotsFolder: string,
    thumbnailsFolder: string,
};

export interface Config extends ImageConfig {
    imageWidth: number,
    imageHeight: number,
    delineationImage: string,
};


export interface CorticalRegion {
    region: string,
    description: string,
};

export interface CorticalGroup {
    group: string,
    description: string,
    regions?: CorticalRegion[]
};

export interface CorticalRegionsPayload {
    cortical_groups: CorticalGroup[]
};


export enum LayerPosition {
    Bottom = "b",
    Middle = "m",
    Top = "t",
    Track = "z",
};

export const LayerPositionLabels: { [key in LayerPosition]: string } = {
    [LayerPosition.Top]: 'Top layer',
    [LayerPosition.Middle]: 'Middle layer',
    [LayerPosition.Bottom]: 'Bottom layer',
    [LayerPosition.Track]: 'All layers Log',
};


export interface Layers {
    b: string,
    m: string,
    t: string,
    z: string,
};

export interface TracerInfo {
    tracerNum: number,
    tracer: string,
    direction: string,
    fluorescense: string,
    injSite: string,
    method: string,
    comment: string,
};

export interface DatasetBaseInfo {
    marmosetID: string,
    rikenID: string,
    labID: string,
    lab: string,
    injRegion: string,
};

export interface DatasetInfo extends DatasetBaseInfo {
    layers: Layers,
    tracers: TracerInfo[],
    injSide: string,
    injFlatPos: string,
    noZAV?: boolean,
    channel: string,
    summary: string,
    knownIssues: string,
    age: number,
    sex: string,
    bodyWeight: number,
    birthDate: number,
    injectionDate: number,
    survivalDays: number,
    TCStartDate: number,
    TCLostSection: string,
    TCComment: string,
    Backlit: string,
    Nissl: string,
    BDA: string,
    cre: string,
    otherNFT: string,
    snapshot: string,
    snapshotUrl: string,
    thumbnail: string,
    thumbnailUrl: string,
};

export interface SingleDatasetInfo extends DatasetInfo, ImageConfig {
};

export interface ConfigNDatasetPayload {
    config: Config,
    datasets: DatasetInfo[]
};

