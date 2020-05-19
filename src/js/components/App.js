import React from 'react';

import SplitterLayout from 'react-splitter-layout';


import RegionTreePanel from './RegionTreePanel.js';
import ViewerComposed from './ViewerComposed.js';
import ZAVConfig from '../ZAVConfig.js';
import RegionsManager from '../RegionsManager.js';

/** Main component of the ZAViewer */
class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = { configId: undefined, config: undefined };
  }

  render() {
    return (
      <div className="App">
        <SplitterLayout primaryIndex={1} secondaryMinSize={5} secondaryInitialSize={350}>
          <div className="secondaryRegionTreePane" style={{ height: "100%", overflow: "hidden" }}>
            <div id="zav_logo"/> 
            <RegionTreePanel regionsStatus={this.state.regionsStatus} />
          </div>
          <div className="primaryViewerPane" style={{ height: "100%" }}>
            <ViewerComposed config={this.state.config} />
          </div>
        </SplitterLayout>
      </div>
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


}

export default App;
