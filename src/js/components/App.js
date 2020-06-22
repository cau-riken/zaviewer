import React from 'react';

import { createBrowserHistory } from 'history';

import SplitPane from 'react-split-pane';


import RegionTreePanel from './RegionTreePanel.js';
import ViewerComposed from './ViewerComposed.js';
import { DrawerHandle } from './Drawer.js';
import ZAVConfig from '../ZAVConfig.js';
import RegionsManager from '../RegionsManager.js';

/** Main component of the ZAViewer */
class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = { configId: undefined, config: undefined, isRegionPanelExpanded: false, splitSize: 350 };
    this.handleClick = this.handleClick.bind(this);
    this.onSplitSizeChange = this.onSplitSizeChange.bind(this);

    this.history = createBrowserHistory();
  }

  render() {
    return (
      <div className="App">
        <SplitPane
          split="vertical"
          defaultSize={350}
          size={this.state.isRegionPanelExpanded ? this.state.splitSize : 0}
          onChange={this.onSplitSizeChange}
        >
          <div className="secondaryRegionTreePane" style={{ height: "100%", overflow: "hidden" }}>
            <div id="zav_logoPlaceHolder">
              <div id="zav_logoContainer" draggable="false">
                <a id="bm_logo" href="https://www.brainminds.riken.jp/"  >
                  <img src="./assets/img/brain-minds_borderlogo.svg" height={32} />
                </a>
                <img id="zav_logo" src="./assets/img/logo.png" height={23} />
              </div>
            </div>
            <RegionTreePanel regionsStatus={this.state.regionsStatus} />
          </div>
          <div className="primaryViewerPane" style={{ height: "100%" }}>
            <DrawerHandle
              collapseDirection={DrawerHandle.LEFT}
              isExpanded={this.state.isRegionPanelExpanded}
              onClick={this.handleClick}
            />
            <div style={{ position: "absolute", left: 13, width: "calc( 100% - 13px )", height: "100%" }}>
              <ViewerComposed
                config={this.state.config}
                regionsStatus={this.state.regionsStatus}
                history={this.history}
              />
            </div>
          </div>
        </SplitPane>
      </div >
    );
  }

  componentDidMount() {
    const configId = this.getConfigIdParam();
    if (configId && configId != this.state.configId) {
      //retrieve config asynchronously...
      ZAVConfig.getConfig(configId, (config) => {
        //... and expand state when config has been retrieved
        this.setState(state => ({ configId: configId, config: config }));

        //retrieve region data asynchronously...
        RegionsManager.init(config, (regionsStatus) => {
          //... and update state after region data change
          this.setState(state => ({ regionsStatus: regionsStatus }));
        });

      });
    }
  }

  /** retrieve configuration ID from url query param  
   * @private
  */
  getConfigIdParam() {
    var configId = undefined;
    var i;
    const url = location.search.substring(1).split('&');

    for (i = 0; url[i]; i++) {
      var k = url[i].split('=');
      if (k[0] == "id") {
        configId = k[1];
        break;
      }
    }
    return configId;
  }

  handleClick() {
    this.setState(state => ({ isRegionPanelExpanded: !state.isRegionPanelExpanded }));
  }

  onSplitSizeChange(size) {
    if (this.state.isRegionPanelExpanded) {
      this.setState(state => ({ splitSize: size }))
    }
  }

}

export default App;
