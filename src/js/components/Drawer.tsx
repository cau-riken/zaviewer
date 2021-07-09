import * as React from "react";

import { Icon } from "@blueprintjs/core";

import "./Drawer.scss";

export enum CollapseDirection {
    LEFT = 'left',
    RIGHT = 'right',
};

type DrawerHandleProps = {
    collapseDirection: CollapseDirection,
    isExpanded: boolean,
    onClick: React.MouseEventHandler | undefined,
};

export const DrawerHandle = (props: DrawerHandleProps) => {

    const pointToRight = (props.collapseDirection === CollapseDirection.RIGHT) ? props.isExpanded : !props.isExpanded;
    return (
        <div
            className="zav-Drawer_handle"
            onClick={props.onClick}
        >
            <Icon
                icon={pointToRight ? 'caret-right' : 'caret-right'}
                iconSize={22}
            />
        </div>
    );
}

type DrawerProps = {
    id: string,
    collapseDirection: CollapseDirection,
    initExpanded: boolean,
    forceExpanded?: boolean,
    onClick: React.MouseEventHandler | undefined,
    onExpandCollapse: (isExpanded: boolean) => void,
    quickactions: any,
    children: any,
};

export const Drawer = (props: DrawerProps) => {

    const [isExpanded, setIsExpanded] = React.useState(props.initExpanded);
    const drawerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(
        () => {
            if (!(props.forceExpanded === undefined)) {
                setIsExpanded(props.forceExpanded);
            }
        },
        [props.forceExpanded]
    );

    return (
        <div
            id={props.id}
            ref={drawerRef}
            className="zav-Drawer"
            data-isexpanded={isExpanded}
        >
            <DrawerHandle
                collapseDirection={CollapseDirection.RIGHT}
                isExpanded={isExpanded}
                onClick={() => {
                    setIsExpanded(!isExpanded);
                    props.onExpandCollapse && props.onExpandCollapse(!isExpanded);
                }
                }
            />
            <div className="zav-Drawer_collapsedCont">
                {props.quickactions}
            </div>
            <div className="zav-Drawer_expandedCont">
                <div className="zav-Drawer_expandedContWrapper">
                    {props.children}
                </div>
            </div>
        </div>
    );
}

export default Drawer;
