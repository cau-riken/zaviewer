import * as React from 'react';

import {
    Button,
} from "@blueprintjs/core";

import * as TracInj from "../common/Types";

import "./MetadataView.scss";

const PropSpacer = () => <span className="tiv_propspacer" />;

const PropLabel = (props: { label: string }) => {
    return (
        <span className="tiv_proplabel" >{props.label}</span>
    );
};

type PropRenderer = {
    label: string,
    value: string | number | JSX.Element,
    format?: string,
};


const PropRenderer = (props: PropRenderer) => {
    return (
        props.value
            ?
            <>
                <span className="tiv_propcell tiv_proplabelcell">
                    <PropLabel label={props.label} />
                </span>
                <span className="tiv_propcell tiv_propvaluecell">
                    {props.value}
                </span>
            </>
            :
            null
    );
};

type MetadataViewProps = {
    infoDataset: TracInj.DatasetInfo,
    includeThumbnail?: boolean,
};


const MetadataView = (props: MetadataViewProps) => {
    const downloadLink = React.useRef(null);
    const infoDataset = props.infoDataset;
    const { layers, thumbnail, thumbnailUrl, snapshot, snapshotUrl, ...metadata } = infoDataset;
    return (
        <div style={{
            padding: 6,

            display: "grid",
            gridTemplateColumns: "2fr 5fr",

            overflowY: "auto",
        }}>
            {infoDataset ?
                <>
                    <div style={{ position: 'absolute', right: 0, width: 50 }}>
                        {/* using hidden anchor here (instead of AnchorButton) just to avoid displaying data url on the status bar... */}
                        <a
                            ref={downloadLink}
                            style={{ display: 'hidden' }}
                            href={'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(metadata))}
                            download={metadata.marmosetID + "_metadata.json"}
                        />
                        <Button
                            icon='import'
                            title="Download metadata"
                            onClick={() => { downloadLink.current.click() }}
                        />
                    </div>
                    <PropRenderer label="Brain/MINDS ID" value={infoDataset.marmosetID} />
                    <PropRenderer label="Group" value={infoDataset.lab} />

                    <PropSpacer />
                    {props.includeThumbnail
                        ?
                        <>
                            <PropRenderer
                                label="Tracer signal thumbnail"
                                value={
                                    <img
                                        src={infoDataset.thumbnailUrl}
                                        width={250}
                                        onLoad={(event) => console.info("loaded ", event)}
                                        style={{
                                            justifySelf: 'right',
                                        }}
                                    />
                                } />
                            <PropSpacer />
                        </>
                        :
                        null
                    }

                    <PropRenderer label="Lab identifier" value={infoDataset.labID} />
                    <PropRenderer label="Region of injection" value={infoDataset.injRegion} />
                    <PropRenderer label="Side of injection" value={infoDataset.injSide} />

                    <PropSpacer />
                    <PropRenderer label="Summary" value={infoDataset.summary} />
                    <PropRenderer label="Known issues" value={infoDataset.knownIssues} />

                    <PropSpacer />
                    <PropRenderer label="Age" value={infoDataset.age} />
                    <PropRenderer label="Sex" value={infoDataset.sex} />
                    <PropRenderer label="Body weight (g)" value={infoDataset.bodyWeight} />
                    <PropRenderer label="Date of birth" value={infoDataset.birthDate} />
                    <PropRenderer label="Injection date" value={infoDataset.injectionDate} />
                    <PropRenderer label="Survival period (day)" value={infoDataset.survivalDays} />

                    <PropSpacer />
                    <span className="tiv_proplabelcell">
                        <PropLabel label={"Dissected brain snapshot"} />
                    </span>
                    <div style={{ padding: 1, gridColumn: "1 / span 2" }}>
                        <img style={{ width: "100%" }} src={infoDataset.snapshotUrl} />
                    </div>
                    <PropSpacer />
                    <span className="tiv_proplabelcell">
                        <PropLabel label={"Tracers:"} />
                    </span>
                    {
                        infoDataset.tracers.map(tracerInfo =>
                            <React.Fragment key={tracerInfo.tracerNum}>
                                {/*<PropRenderer key={tracerInfo.tracerNum+"num"} label="#" value={tracerInfo.tracerNum} />*/}
                                <PropRenderer key={tracerInfo.tracerNum + "tracer"} label="Tracer" value={tracerInfo.tracer} />
                                <PropRenderer key={tracerInfo.tracerNum + "site"} label="Injection Site" value={tracerInfo.injSite} />
                                <PropRenderer key={tracerInfo.tracerNum + "dir"} label="Direction" value={tracerInfo.direction} />
                                <PropRenderer key={tracerInfo.tracerNum + "meth"} label="Method" value={tracerInfo.method} />
                                <PropRenderer key={tracerInfo.tracerNum + "fluo"} label="Fluorescense" value={tracerInfo.fluorescense} />
                                <PropRenderer key={tracerInfo.tracerNum + "com"} label="Comment" value={tracerInfo.comment} />
                                <PropSpacer key={tracerInfo.tracerNum + "spacer"} />
                            </React.Fragment>
                        )
                    }
                </>
                :
                null}
        </div>

    );
};


export default MetadataView;

