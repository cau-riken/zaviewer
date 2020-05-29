import React from 'react';

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
    this.state = { configId: undefined, config: undefined, isTreeExpanded: true, splitSize: 350 };
    this.handleClick = this.handleClick.bind(this);
    this.onSplitSizeChange = this.onSplitSizeChange.bind(this);
  }

  render() {
    return (
      <div className="App">
        <SplitPane
          split="vertical"
          defaultSize={350}
          size={this.state.isTreeExpanded ? this.state.splitSize : 0}
          onChange={this.onSplitSizeChange}
        >
          <div className="secondaryRegionTreePane" style={{ height: "100%", overflow: "hidden" }}>
            <div id="zav_logo" />
            <RegionTreePanel regionsStatus={this.state.regionsStatus} />
          </div>
          <div className="primaryViewerPane" style={{ height: "100%" }}>
            <DrawerHandle
              collapseDirection={DrawerHandle.LEFT}
              isExpanded={this.state.isTreeExpanded}
              onClick={this.handleClick}
            />
            <ViewerComposed
              config={this.state.config}
              regionsStatus={this.state.regionsStatus}
            />
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
    this.setState(state => ({ isTreeExpanded: !state.isTreeExpanded }));
  }

  onSplitSizeChange(size) {
    if (this.state.isTreeExpanded) {
      this.setState(state => ({ splitSize: size }))
    }
  }

}

export default App;
