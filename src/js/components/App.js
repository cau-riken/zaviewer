import React from 'react';

import SplitterLayout from 'react-splitter-layout';


import RegionTreePanel from './RegionTreePanel.js';
import ViewerComposed from './ViewerComposed.js';
import ZAVConfig from '../ZAVConfig.js';


class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = { configId: undefined, config: undefined };
  }

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

  render() {

    const configId = this.getConfigIdParam();
    if (configId && configId != this.state.configId) {
      //record that configuration is being retrieved
      this.setState(state => ({ configId: configId }));
      //retrieve config asynchrounously...
      ZAVConfig.getConfig(configId, (config) => {
        //... and update state when config has been retrieved
        this.setState(state => ({ configId: configId, config: config }));
      });
    }

    return (
      <div className="App">
        <SplitterLayout primaryIndex={1} secondaryMinSize={5} secondaryInitialSize={350}>
          <div className="secondaryRegionTreePane" style={{height:"100%"}}>
              <RegionTreePanel config={this.state.config}/>
          </div>
          <div className="primaryViewerPane" style={{height:"100%"}}>
              <ViewerComposed config={this.state.config}/>
          </div>
        </SplitterLayout>
      </div>
    );
  }
}

export default App;
