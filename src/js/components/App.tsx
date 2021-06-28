import * as React from "react";


import { createBrowserHistory } from 'history';

import SplitPane from 'react-split-pane';


import RegionTreePanel from './RegionTreePanel.js';
import ViewerComposed from './ViewerComposed.js';
import { DrawerHandle } from './Drawer.js';
import ZAVConfig from '../ZAVConfig.js';

import RegionsManager, { IRegionsStatus, IRegionsPayload, } from '../RegionsManager';

import Utils from '../Utils.js';
import axios from 'axios';

import "./App.scss";


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
  const [isRegionPanelExpanded, setIsRegionPanelExpanded] = React.useState(false);
  const [splitSize, setSplitSize] = React.useState(defaultSplitSize);

  const [regionsStatus, setRegionsStatus] = React.useState<IRegionsStatus|undefined>(undefined);

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


    this.history = createBrowserHistory();
  }

  return (
    <div
      className="App"
      <div className="App">
        <SplitPane
          split="vertical"
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
                collapseDirection={DrawerHandle.LEFT}
                isExpanded={isRegionPanelExpanded}
                onClick={() => setIsRegionPanelExpanded(!isRegionPanelExpanded)}
              />
              : null
          }

          <div style={{ position: "absolute", left: 13, width: "calc( 100% - 13px )", height: "100%" }}>
            <ViewerComposed
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
