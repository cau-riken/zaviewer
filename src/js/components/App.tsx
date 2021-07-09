import * as React from "react";


import { createBrowserHistory } from 'history';

import SplitPane from 'react-split-pane';


import RegionTreePanel from './RegionTreePanel.js';
import ViewerComposed from './ViewerComposed.js';
import { DrawerHandle, CollapseDirection } from './Drawer';
import ZAVConfig from '../ZAVConfig.js';

import RegionsManager, { IRegionsStatus, IRegionsPayload, } from '../RegionsManager';

import Utils from '../Utils.js';
import axios from 'axios';

import "./App.scss";

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
}

/** Main component of the ZAViewer */
const App = (props: AppProps) => {

  const [config, setConfig] = React.useState(undefined);
  const [isRegPanelExpanded, setIsRegPanelExpanded] = React.useState(false);
  const [splitSize, setSplitSize] = React.useState(defaultSplitSize);

  const [regionsStatus, setRegionsStatus] = React.useState<IRegionsStatus | undefined>(undefined);

  React.useEffect(() => {

    //retrieve config asynchronously...
    ZAVConfig.getConfig(props.configId, props.dataSrc, (newConfig) => {
      setConfig(newConfig);

      //load regions related data
      const treeDataUrl =
        newConfig.treeUrlPath
          ? newConfig.hasBackend
            ? Utils.makePath(newConfig.PUBLISH_PATH, newConfig.treeUrlPath, "regionTreeGroup_" + newConfig.paramId + ".json")
            : Utils.makePath(newConfig.treeUrlPath, newConfig.fallbackTreeUrl)
          : newConfig.fallbackTreeUrl


      axios({
        method: newConfig.hasBackend ? "POST" : "GET",
        url: treeDataUrl,
      })

        .then(response => {
          const payload: IRegionsPayload = response.data;

          //retrieve region data asynchronously...
          RegionsManager.init(payload, (regionsStatus) => {
            //... and update state after region data change
            setRegionsStatus(regionsStatus);
          });

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
            <div id="zav_logoContainer" draggable="false">
              <a id="bm_logo" href="https://dataportal.brainminds.jp/"  >
                <img src="./assets/img/brain-minds_borderlogo.svg" height={32} />
              </a>
              <img id="zav_logo" src="./assets/img/logo.png" height={23} />
            </div>
          </div>
          {
            RegionsManager.isReady()
              ? <RegionTreePanel regionsStatus={regionsStatus} />
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
