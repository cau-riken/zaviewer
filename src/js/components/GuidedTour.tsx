import * as React from "react";

import {
    Menu,
    MenuDivider,
    MenuItem,
} from "@blueprintjs/core";

import Joyride, { ACTIONS, EVENTS, STATUS, Step } from 'react-joyride';

import "./GuidedTour.scss";

const OwerviewTourSteps: ExtendedStep[] = [
    {
        stepContext: "_init_",
        target: '.App',
        disableBeacon: true,
        offset: 50,
        title: 'ZAViewer - Zooming Atlas Viewer',
        content:
            <div
                className='zav_guideContent'
            >
                <p>ZAViewer is a web-based 2D high-resolution image viewer that was designed to explore data produced for the marmoset brain in the Brain/MINDS project.</p>
                <p>
                    This viewer allows the user to browse large images of brain slices in the standard orthogonal anatomical views (Axial, Coronal, Sagittal depending on the data provided).
                    <br />
                    Each slice view may contains several raster images layers with atlas regions overlaid on top of them.
                </p>
                <br />
                <p>Click <span className="zav_keyboardkey">Next</span> to follow a quick guided tour of the viewer's main features!</p>
            </div>,
        placement: 'center',
        styles: {
            overlay: {
                backgroundColor: '#44529b',
            },
            tooltip: {
                width: '40vw',
            },
        }

    },

    {
        stepContext: "mainImagePanel",
        target: '#svgDelineationOverlay',
        disableBeacon: true,
        title: 'Deeply zoomable high resolution images',
        content:
            <div
                className='zav_guideContent'
            >
                <p>By default, the zoomable brain image shown in the center uses most of the screen space, with both side panels collapsed on the left and right.</p>
            </div>,
        placement: 'bottom',
        styles: {
            tooltip: {
                minWidth: '500px',
            },
        }
    },

    {
        stepContext: "collapsedControlPanel",
        target: '#ZAV-rightPanel>.zav-Drawer_collapsedCont',
        disableBeacon: true,
        title: 'Quick navigation buttons',
        content:
            <div
                className='zav_guideContent'
            >
                <p>When the right panel is collapsed, a minimal set of buttons allows the user to quickly change the viewed slice along the current axis</p>
            </div>,
        placement: 'left-start',
        styles: {
            tooltip: {
                minWidth: '500px',
            },
        }
    },

    {
        stepContext: "collapsedControlPanel",
        target: '#ZAV-rightPanel>.zav-Drawer_handle',
        disableBeacon: true,
        title: 'Collapsible main control panel',
        content:
            <div
                className='zav_guideContent'
            >
                <p>Clicking on the vertical bar on the right triggers the opening/closing of the detailed control panel...
                </p>
            </div>,
        placement: 'left',
        styles: {
            tooltip: {
                minWidth: '500px',
            },
        }
    },

    {
        stepContext: "expandedControlPanel",
        target: '#ZAV-rightPanel .zav-Drawer_expandedContWrapper',
        disableBeacon: true,
        title: 'Main control panel',
        content:
            <div
                className='zav_guideContent'
            >
                <p>When the right panel is expanded, a wide range of controls are available for managing the visibility of layers and overlays, navigate the slices, change axis, and others...</p>
            </div>,
        placement: 'left',
        styles: {
            tooltip: {
                minWidth: '500px',
            },
        }
    },

    {
        stepContext: "collapsedRegionPanel",
        target: '.primaryViewerPane>.zav-Drawer_handle',
        disableBeacon: true,
        title: 'Collapsible region panel',
        content:
            <div
                className='zav_guideContent'
            >
                <p>Clicking on the vertical bar on the left triggers the opening/closing of the region panel.
                </p>
            </div>,
        placement: 'right',
        styles: {
            tooltip: {
                minWidth: '500px',
            },
        }
    },

    {
        stepContext: "expandedRegionPanel",
        target: '.secondaryRegionTreePane',
        disableBeacon: true,
        title: 'Region panel',
        content:
            <div
                className='zav_guideContent'
            >
                <p>This panel allows to select brain region(s) by navigating in the hierarchical representation of the Atlas brain regions or by performing simple text search of region name.
                </p>
            </div>,
        placement: 'right',
        styles: {
            tooltip: {
                minWidth: '500px',
            },
        }
    },

];


const NavigationTourSteps: ExtendedStep[] = [
    {
        stepContext: "mainImagePanel",
        target: '#svgDelineationOverlay',
        disableBeacon: true,
        title: 'Deeply zoomable high resolution image',
        content:
            <div
                className='zav_guideContent'
            >
                <p>The brain slice images can be deeply zoomed-in to explore their fine details.</p>
                <ul><li>Zoom in and out using the mouse wheel,
                    <br />or zoom gestures on a notebook touchpad,
                    <br />(or <span className="zav_keyboardkey">Shift</span>+<span className="zav_keyboardkey">↑</span> and <span className="zav_keyboardkey">Shift</span>+<span className="zav_keyboardkey">↓</span> on the keyboard)</li>
                    <li>Scroll the image using click and drag gestures,
                        <br />(or keyboard's arrows : <span className="zav_keyboardkey">←</span> <span className="zav_keyboardkey">↑</span> <span className="zav_keyboardkey">→</span> <span className="zav_keyboardkey">↓</span>)</li>
                    <li>Reset to full image view using <span className="zav_keyboardkey">Alt</span>+<span className="zav_keyboardkey">←</span></li>
                </ul>
            </div>,
        placement: 'bottom',
        styles: {
            tooltip: {
                minWidth: '500px',
            },
        }
    },

    {
        stepContext: "collapsedControlPanel",
        target: '.zav-QuickActionPanel .zav-QuickNavButtons',
        disableBeacon: true,
        title: 'Quick navigation buttons',
        content:
            <div
                className='zav_guideContent'
            >
                <p>Change the viewed slice by clicking these buttons to navigate along the active axis.
                </p>
                <p>Current position and zoom factor are preserved when changing slices.
                </p>
            </div>,
        placement: 'left-start',
        styles: {
            tooltip: {
                minWidth: '600px',
            },
        }
    },

    {
        stepContext: "collapsedControlPanel",
        target: '.zav-QuickActionPanel .zav-QuickToogleDelineationButton',
        disableBeacon: true,
        content:
            <div
                className='zav_guideContent'
            >
                <p>This switch allows to toggle Atlas region overlay visibility.</p>
            </div>,
        placement: 'left',
    },

    {
        stepContext: "expandedControlPanel",
        target: '#ZAV-rightPanel .zav-controlPanel_Layers',
        disableBeacon: true,
        title: 'Layers control',
        content:
            <div
                className='zav_guideContent'
            >
                <p>This sub-panel displays the layer stack, with the foreground layer at the top.</p>
                <p><br />Below the layer's name, a visibility switch and an opacity slider allow to control the corresponding layer.
                    <br />Also, contrast and gamma correction can be performed independently for each layers
                </p>
            </div>,
        placement: 'left',
        styles: {
            tooltip: {
                minWidth: '500px',
            },
        }
    },

    {
        stepContext: "expandedControlPanel",
        target: '#ZAV-rightPanel .zav-controlPanel_Regions',
        disableBeacon: true,
        title: 'Atlas regions control',
        content:
            <div
                className='zav_guideContent'
            >
                <p>Use this sub-panel to control Atlas regions which are represented by colored shapes overlayed on top of slice images.</p>
                <p><br />Region areas and borders can be independently hidden thanks to these switches, and areas opacity can be finely adjusted.</p>
            </div>,
        placement: 'left',
        styles: {
            tooltip: {
                minWidth: '500px',
            },
        }
    },

    {
        stepContext: "navigatorPanel",
        target: '#ZAV-rightPanel .zav-controlPanel_Navigator',
        disableBeacon: true,
        title: 'Global view',
        content:
            <div
                className='zav_guideContent'
            >
                <p>This thumbnail displays a global view of the slice image. When zoomed-in, a red bordered rectangle is drawn to figure  which portion of the image is currently displayed on screen.</p>
                <p><br />Dragging the rectangle is another convenient way to scroll the image.</p>
            </div>,
        placement: 'left',
        styles: {
            tooltip: {
                minWidth: '500px',
            },
        }
    },

    {
        stepContext: "expandedControlPanel",
        target: '#ZAV-rightPanel .zav-QuickDatasetInfoButton',
        disableBeacon: true,
        content:
            <div
                className='zav_guideContent'
            >
                <p>Clicking on this icon will display the detailed dataset's information.</p>
            </div>,
        placement: 'left-start',
    },

    {
        stepContext: "expandedControlPanel",
        target: '#ZAV-rightPanel .zav-controlPanel_SliceNav',
        disableBeacon: true,
        title: 'Slice navigation',
        content:
            <div
                className='zav_guideContent'
            >
                <p>This sub-panel helps to locate the currently displayed brain slice within available slice series.</p>
                <p>The active navigation axis (perpendicular to the slice's plane) is indicated, alongside the viewed slice's numeric index and the total number of slices in the current ordered set of slices.
                    <br />Current slice's location is also figured by the position of the slider handle, and by a colored line on top of the brain section thumbnail image.</p>
                <p><br />At any time, there is a single active navigation axis, and if the viewed dataset contains slices along more than 1 axis, several brain section thumbnails are shown, with switches on top of them to change the navigation axis.</p>
                <p>Navigating amongst slices can be done in many ways: clicking on the slider track, dragging the slider handle, clicking on left and right chevron or clicking on thumbnail brain section image.</p>
            </div>,
        placement: 'left',
        styles: {
            tooltip: {
                minWidth: '700px',
            },
        }
    },
    {
        stepContext: "expandedControlPanel",
        target: '#ZAV-rightPanel .zav-controlPanel_Distance',
        disableBeacon: true,
        title: 'Distance measurement',
        content:
            <div
                className='zav_guideContent'
            >
                <p>This tool is provided to measure distance in physical space units between points on the slice image.</p>

                <p><br />Clicking on the button will switch to measurement mode, then:
                </p>
                <ul><li>Mark the first point by clicking on the slice image,</li>
                    <li>Choose a second point by clicking again on the image: the distance is then displayed.</li>
                    <li>Clicking a third time will reset the ruler to make other measurements.</li>
                </ul>
                <p>Measurement mode is deactivated by clicking the button again.</p>

            </div>,
        placement: 'left',
        styles: {
            tooltip: {
                minWidth: '500px',
            },
        }
    },

];

const RegionsTourSteps: ExtendedStep[] = [
    {
        stepContext: "mainImagePanel",
        target: '#svgDelineationOverlay',
        disableBeacon: true,
        title: 'Atlas regions',
        content:
            <div
                className='zav_guideContent'
            >
                <p>Atlas regions overlayed on top of slice image are a great help to locate the viewed portion of the slice.</p>
                <p>
                    <br />The full name of the atlas region located under the mouse cursor is always indicated at the bottom of the screen.
                    <br />Region(s) can be selected by directly clicking on them in the image; then they become outlined by a distinctive blue border.
                </p>
            </div>,
        placement: 'bottom',
        styles: {
            tooltip: {
                minWidth: '700px',
            },
        }
    },

    {
        stepContext: "expandedRegionPanel",
        target: '.secondaryRegionTreePane .zav-Tree',
        disableBeacon: true,
        title: 'Region panel',
        content:
            <div
                className='zav_guideContent'
            >
                <p>And the regions selection is synchronized between the region tree view and the slice image overlay.
                </p>
                <p><br />In the hierarchical representation of the Atlas brain regions, selection is performed by clicking on a region's name.</p>

                <p>To explore the tree, expand/collapse the level below a region by clicking on the +/- square at the left of the region name,
                    <br />(and double-click to fully expand/collapse all levels of the sub-tree).

                </p>
            </div>,
        placement: 'right',
        styles: {
            tooltip: {
                minWidth: '600px',
            },
        }
    },

    {
        stepContext: "expandedRegionPanel",
        target: '.secondaryRegionTreePane .zav-regions_searchinput ',
        disableBeacon: true,
        title: 'Region search',
        content:
            <div
                className='zav_guideContent'
            >
                <p>Quickly find regions by typing their name in this text box.</p>
                <p><br />The tree will be pruned to only display regions whose name contains the text pattern (their name will be displayed in red, and necessary parent regions in grey).
                </p>
            </div>,
        placement: 'right',
        styles: {
            tooltip: {
                minWidth: '500px',
            },
        }
    },

];




interface ExtendedStep extends Step {
    stepContext?: string,
}

type ToursMenuProps = {
    setTourSteps: (tourSteps: ExtendedStep[]) => void,
    setGuidedTourOn: (run: boolean) => void,
};

const ToursMenu = (props: ToursMenuProps) => {

    return (
        <Menu>
            <MenuItem
                icon="taxi"
                text="Overview Guided Tour"
                onClick={() => {
                    props.setTourSteps(OwerviewTourSteps);
                    props.setGuidedTourOn(true);
                }}
            />
            <MenuDivider
                title="Tours by topics..."
            />
            <MenuItem
                text="Navigation"
                icon="compass"
                onClick={() => {
                    props.setTourSteps(NavigationTourSteps);
                    props.setGuidedTourOn(true);
                }}

            />
            <MenuItem
                text="Atlas regions"
                icon="heatmap"
                onClick={() => {
                    props.setTourSteps(RegionsTourSteps);
                    props.setGuidedTourOn(true);
                }}

            />
        </Menu>
    );
};


type StepTransitionCallback = (stepContext: string) => void;

type TourOperatorProps = {
    children?: React.ReactNode,

    tourSteps: ExtendedStep[],
    tourStepIndex: number | undefined,
    guidedTourOn: boolean,
    setTourStepIndex: (index: number) => void,
    setGuidedTourOn: (run: boolean) => void,

    onUpdateStepContext: StepTransitionCallback,
};


export const TourOperator = (props: TourOperatorProps) => {

    return (
        <Joyride
            steps={props.tourSteps}
            stepIndex={props.tourStepIndex}
            run={props.guidedTourOn}
            showProgress={true}
            showSkipButton={true}
            continuous={true}
            spotlightPadding={5}
            styles={{
                options: {
                },
                //change default blend mode since ZAViewer is dark mode themed
                overlay: {
                    backgroundColor: '#1f3fee',
                    mixBlendMode: 'screen',
                },
                spotlight: {
                    //backgroundColor: '#ffffff75',
                    backgroundColor: '#2f2f2f',
                    borderRadius: 0,
                    boxShadow: '#42424296 0px 0px 0px 9999px',
                    mixBlendMode: 'unset',
                    //border: '4px solid rgba(76, 121, 255, 0.94)',
                },
                tooltip: {
                }
            }}

            callback={
                (data) => {
                    const { action, index, status, type, step } = data;
                    //console.log('#', action, index, status, type, step);

                    //update context with next to come step (works only from second steps onwards, since triggered on STEP_AFTER event)
                    if (type === EVENTS.STEP_AFTER) {
                        if (props.onUpdateStepContext) {
                            //have to use info of the step after to update Tour context

                            if (action === ACTIONS.NEXT && props.tourSteps.length > index + 1) {
                                const followingExtStep = props.tourSteps[index + 1] as ExtendedStep;
                                if (followingExtStep.stepContext) {
                                    props.onUpdateStepContext(followingExtStep.stepContext);
                                }

                            } else if (action === ACTIONS.PREV && props.tourSteps.length > index - 1) {
                                const followingExtStep = props.tourSteps[index - 1] as ExtendedStep;
                                if (followingExtStep.stepContext) {
                                    props.onUpdateStepContext(followingExtStep.stepContext);
                                }
                            }
                        }
                    }

                    if ([EVENTS.STEP_AFTER, EVENTS.TARGET_NOT_FOUND].includes(type)) {
                        // Update state to advance the tour
                        props.setTourStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
                    }

                    //Reset tour if:
                    // * it was followed to the end
                    // * skip button was clicked
                    // * And also when close button was click (to prevent restarting at next step)
                    if (
                        [STATUS.FINISHED, STATUS.SKIPPED].includes(status)
                        ||
                        (type === EVENTS.STEP_AFTER && action == ACTIONS.CLOSE)) {
                        //reset from start for next run of the tour
                        props.setTourStepIndex(0);
                        props.setGuidedTourOn(false);
                    }

                }
            }
        />

    )

};


const deepCloneObject = (o: Object) =>
    JSON.parse(JSON.stringify(o));

const EmptyStepContext = Object.freeze({ currentStep: '' });
const EmptyTourContext = Object.freeze({ tourMenu: (undefined as unknown) as JSX.Element, stepContext: EmptyStepContext });
export const TourContext = React.createContext(deepCloneObject(EmptyTourContext));

type GuidedTourProps = {
    children?: React.ReactNode,
};

export const GuidedTour = (props: GuidedTourProps) => {

    const [guidedTourOn, setGuidedTourOn] = React.useState(false);
    const [tourSteps, setTourSteps] = React.useState(OwerviewTourSteps);
    const [tourStepIndex, setTourStepIndex] = React.useState(0);

    const [stepContext, setStepContext] = React.useState(deepCloneObject(EmptyStepContext));

    React.useEffect(
        () => {
            //reset step context when tour ends
            if (!guidedTourOn) {
                setStepContext(deepCloneObject(EmptyStepContext));
            }
        },
        [guidedTourOn]
    );

    const contextValue = {
        tourMenu: <ToursMenu
            setGuidedTourOn={setGuidedTourOn}
            setTourSteps={
                (tourSteps) => {
                    //set first step context
                    setStepContext(
                        {
                            ...deepCloneObject(EmptyStepContext),
                            ...{ currentStep: tourSteps[0]?.stepContext }
                        }
                    );
                    setTourSteps(tourSteps)
                }}
        />,
        stepContext: stepContext
    };

    return (
        <>
            <TourOperator
                tourSteps={tourSteps}
                guidedTourOn={guidedTourOn}
                setGuidedTourOn={setGuidedTourOn}
                tourStepIndex={tourStepIndex}
                setTourStepIndex={setTourStepIndex}
                onUpdateStepContext={
                    followingStep => {
                        setStepContext(
                            Object.assign(stepContext, { currentStep: followingStep })
                        )
                    }
                }
            />
            <TourContext.Provider
                value={contextValue}
            >
                {props.children}
            </TourContext.Provider>
        </>
    );

};




