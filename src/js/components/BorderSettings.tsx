import * as React from 'react';

import { HexColorPicker } from "react-colorful";


import {
    Icon,
    Position,
    Slider,
    Switch,
} from "@blueprintjs/core";

import {
    Popover2InteractionKind,
    Popover2
} from "@blueprintjs/popover2";

import ViewerManager from '../ViewerManager.js'


const BorderSettingsWrapper = (props: {
    useCustomBorders: boolean,
    customBorderColor: string,
    customBorderWidth: number,

    children?: React.ReactNode,
}) => {
    const [width, setWidth] = React.useState(props.customBorderWidth);
    const [color, setColor] = React.useState(props.customBorderColor);

    const disabled = !props.useCustomBorders;
    return (
        <Popover2
            interactionKind={Popover2InteractionKind.CLICK}
            position={Position.BOTTOM_RIGHT}
            hasBackdrop={true}

            onClosed={() => {
                ViewerManager.changeCustomBorderColor(color);
                ViewerManager.changeCustomBorderWidth(width);
            }}

            content={
                <div style={{ padding: 12, backgroundColor: "#eee" }}>

                    <div title="toggle to use custom regions' border">
                        <Switch
                            checked={props.useCustomBorders}
                            onChange={() => ViewerManager.toggleUseCustomBorders()}
                            inline
                            label="Use custom border"
                        />
                    </div>

                    <div style={{
                        padding: 6,
                    }}>

                        <div style={{
                            backgroundColor: "#fff",
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            position: 'relative',
                        }}>

                            <div style={{ padding: 8, margin: 8, background: "linear-gradient(90deg, #000 0 20%, #ddd)" }} >
                                <svg
                                    width="50"
                                    height="36"
                                    viewBox="0 0 13.229166 9.525"
                                >
                                    <path
                                        stroke={color} strokeOpacity="0.5"
                                        strokeWidth={width} strokeLinejoin="round"
                                        fill="#ddd" fillOpacity="0.4"
                                        vectorEffect="non-scaling-stroke"
                                        d="m 2.0388059,6.9547681 c 0.043022,1.052445 3.6346067,-1.6387954 4.7153282,-1.5398474 0.884238,0.08096 2.7097543,2.493049 2.7097543,2.493049 0,0 1.8059626,-1.8745123 1.8081996,-2.7863543 0.0018,-0.724921 -0.291981,-2.8169633 -1.195115,-3.3865738 C 9.1738401,1.1654309 6.9638323,3.0982507 3.2144777,1.7922871 1.7089781,3.2586408 1.9957833,5.9023233 2.0388059,6.9547681 Z"
                                    />
                                </svg>
                            </div>


                            <div style={{ width: '80%' }}>
                                <Slider
                                    className="zav-Slider"
                                    min={1}
                                    max={10}
                                    stepSize={1}
                                    labelValues={[1, 5, 10]}
                                    onChange={setWidth}
                                    value={width}
                                    showTrackFill={false}
                                    disabled={disabled}
                                />
                            </div>


                            <div style={{ padding: "16px 6px" }}>
                                <style>{`
                                #zav_custbordercolorpicker .react-colorful__saturation-pointer,
                                #zav_custbordercolorpicker .react-colorful__hue-pointer,
                                #zav_custbordercolorpicker .react-colorful__alpha-pointer {
                                    width: 14px;
                                    height: 14px;
                                }
                            `}
                                </style>
                                <HexColorPicker
                                    id="zav_custbordercolorpicker"

                                    style={{ width: 120, height: 120 }}
                                    color={color}
                                    onChange={setColor}
                                />
                            </div>


                            {/* veil to prevent interaction with colorpicker */
                                disabled
                                    ?
                                    <div style={{ position: 'absolute', backgroundColor: '#dddddd80', width: '100%', height: '100%', zIndex: 2000 }} />
                                    :
                                    null
                            }

                        </div>
                    </div>

                </div>
            }
        >
            {props.children}
        </Popover2>

    );
};

const BorderSettings = (props: {
    disabled: boolean,
    useCustomBorders: boolean,
    customBorderColor: string,
    customBorderWidth: number,

}) => {
    const icon =
        <Icon icon="edit"
            color={(props.disabled ? "#8f8c8c" : (props.useCustomBorders ? "#16a5fd" : "silver"))}
        />;
    return (
        props.disabled ?
            icon
            :
            <BorderSettingsWrapper
                useCustomBorders={props.useCustomBorders}
                customBorderColor={props.customBorderColor}
                customBorderWidth={props.customBorderWidth}
            >
                {icon}
            </BorderSettingsWrapper>
    );
};

export default BorderSettings;



