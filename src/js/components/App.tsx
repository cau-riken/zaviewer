import * as React from "react";

import {
  Position,
} from "@blueprintjs/core";

import {
  Popover2InteractionKind,
  Popover2
} from "@blueprintjs/popover2";

import { createBrowserHistory } from 'history';

import SplitPane from 'react-split-pane';

const RegionTreePanel = React.lazy(() => import('./RegionTreePanel.js'));
import ViewerComposed from './ViewerComposed.js';
import { DrawerHandle, CollapseDirection } from './Drawer';
import ZAVConfig from '../ZAVConfig.js';

import RegionsManager, { IRegionsStatus, IRegionsPayload, } from '../RegionsManager';
import ViewerManager from '../ViewerManager.js'

import Utils from '../Utils.js';
import axios from 'axios';

import "./App.scss";
import "./Themes.scss";

import { TourContext } from "./GuidedTour"

import {
  FocusStyleManager,
} from "@blueprintjs/core";

FocusStyleManager.onlyShowFocusOnTabs();


const history = createBrowserHistory();
const defaultSplitSize = 350;

type AppProps = {
  configId?: string,
  dataSrc?: string,
  dataVersionTag?: string,
  initConfig?: {},
}

/** Main component of the ZAViewer */
const App = (props: AppProps) => {

  const needsExtraInit = React.useRef(true);

  const [config, setConfig] = React.useState(undefined);
  //display region panel expanded if any region selection specified
  const [isRegPanelExpanded, setIsRegPanelExpanded] = React.useState(props?.initConfig?.rs);
  const [splitSize, setSplitSize] = React.useState(defaultSplitSize);

  const [regionsStatus, setRegionsStatus] = React.useState<IRegionsStatus | undefined>(undefined);

  React.useEffect(() => {

    //retrieve config asynchronously...
    ZAVConfig.getConfig(props.configId, props.dataSrc, props.dataVersionTag, (newConfig) => {
      setConfig(newConfig);

      //load regions related data
      const treeDataUrl =
        newConfig.treeUrlPath
          ? newConfig.hasBackend
            ? Utils.makePath(newConfig.PUBLISH_PATH, newConfig.treeUrlPath, "regionTreeGroup_" + newConfig.viewerId + ".json" + props.dataVersionTag)
            : Utils.makePath(newConfig.treeUrlPath, newConfig.fallbackTreeUrl)
          : newConfig.fallbackTreeUrl


      axios({
        method: newConfig.hasBackend ? "POST" : "GET",
        url: treeDataUrl,
      })

        .then(response => {
          const payload: IRegionsPayload = response.data;

          //preselected regions (specified on opening URL)
          const preselected = (props?.initConfig?.rs) ? String(props?.initConfig?.rs).split(',') : undefined;

          //retrieve region data asynchronously...
          RegionsManager.init(
            payload,
            (newRegionsStatus) => {
              if (needsExtraInit.current && preselected) {

                //Perform the focus on selected region center only once
                needsExtraInit.current = false;

                //Try to switch to center slice of (last) selected region
                const selectedRegion = RegionsManager.getLastSelected()
                if (selectedRegion) {

                  const centerSlice = RegionsManager.getRegionCenterSlice(selectedRegion, newConfig?.hasMultiPlanes, ViewerManager.getActivePlane());
                  if (typeof centerSlice != 'undefined') {
                    ViewerManager.goToSlice(centerSlice);
                  }
                  //display at least regions' border, and labels
                  if (!ViewerManager.isShowingRegions()) {
                    ViewerManager.setBorderDisplay(true);
                  }
                  ViewerManager.setLabelDisplay(true);
                }
              }

              //... and update state after region data change
              setRegionsStatus(newRegionsStatus);

            },
            preselected
          );

        })
        .catch(error => {
          // handle error
          console.error(error);
        });


    });

  }, [props.configId, props.dataSrc]);


  //
  const currentTourStep = React.useContext(TourContext).stepContext?.currentStep;
  const isRegionPanelExpanded = ['_init_', 'mainImagePanel'].includes(currentTourStep)
    ? false
    : currentTourStep === 'expandedRegionPanel'
      ? true
      : isRegPanelExpanded;

  const containerRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      className="App"
      ref={containerRef}
    >
      <SplitPane
        split="vertical"
        defaultSize={defaultSplitSize}
        size={isRegionPanelExpanded ? splitSize : 0}
        onChange={(size) => {
          if (isRegionPanelExpanded) {
            setSplitSize(size)
          }
        }}
      >
        <div className="secondaryRegionTreePane" style={{ height: "100%", overflow: "hidden" }}>
          <div id="zav_logoPlaceHolder">
            <div id="zav_logoContainer">
              <div>
                <a id="bm_logo" href="https://dataportal.brainminds.jp/" title="Click to go to Brain/MINDS dataportal">
                  <img src="./assets/img/brain-minds_borderlogo.svg" height={32} />
                </a>
              </div>
              <div><img id="zav_logo" src="./assets/img/logo.png" height={23} draggable="false" /></div>
              <div style={{ verticalAlign: 'bottom' }}>
                <div id="zav_BrandingPlaceHolder" style={{ maxWidth: 280, height: 32, overflow: 'clip' }}>
                </div>
              </div>
            </div>
          </div>
          <div id="zav_licensecontainer">
            {config?.extra?.termsOfUse ?
              <div><a href={config?.extra?.termsOfUse} target="_blank">
                <span className="zav_miscLinks">terms of use</span>
              </a></div>
              :
              null
            }
            <Popover2
              interactionKind={Popover2InteractionKind.CLICK}
              hasBackdrop={true}
              position={'bottom-right'}
              content={
                <div style={{ width: '40vw', padding: 20, }}>
                  <h2>Licenses</h2>
                  <p>
                    ZAViewer (this webapp) is licensed under the <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank">Apache License, Version 2.0</a>
                  </p>
                  <br />
                  <p>
                    This software contains code derived from <a href="http://openseadragon.github.io" target="_blank">Openseadragon</a> v2.4.2 released under the New BSD license.
                  </p>
                  {config?.extra?.hasIIPserver ?
                    <p>
                      Brain images are served by <a href="https://iipimage.sourceforge.io/" target="_blank">IIPImage server</a>, licensed under version 3 of the GNU General Public License.
                    </p>
                    :
                    null
                  }
                </div>
              }
            >
              <div><span className="zav_miscLinks">licenses</span></div>
            </Popover2>
          </div>

          {
            RegionsManager.isReady()
              ? <React.Suspense fallback={<div>Loading...</div>} >
                <RegionTreePanel regionsStatus={regionsStatus} hasMultiPlanes={config?.hasMultiPlanes} />
              </React.Suspense>
              : null
          }
        </div>
        <div className="primaryViewerPane" style={{ height: "100%" }}>
          {
            RegionsManager.isReady()
              ? <DrawerHandle
                collapseDirection={CollapseDirection.LEFT}
                isExpanded={isRegionPanelExpanded}
                onClick={() => setIsRegPanelExpanded(!isRegionPanelExpanded)}
              />
              : null
          }

          <div style={{ position: "absolute", left: 13, width: "calc( 100% - 13px )", height: "100%" }}>
            <ViewerComposed
              containerRef={containerRef}
              config={config}
              regionsStatus={regionsStatus}
              history={history}
            />
          </div>
        </div>
      </SplitPane>
    </div >
  );

};

export default App;
