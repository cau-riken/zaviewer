//import Normalize CSS before any app components to have it at the beginning of generated css bundle
import 'normalize.css';

import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/popover2/lib/css/blueprint-popover2.css";

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import Utils from './Utils.js';

import App from './components/App';
import { GuidedTour } from "./components/GuidedTour";


const DataVersion_PropName = 'data-dataversion';

/** retrieve configuration ID from url query param  
*/
const getConfigParams = () => {
  const params: { configId?: string, dataSrc?: string, initConfig?: {} } = {};
  const url = location.search.substring(1).split('&');

  for (var i = 0; url[i]; i++) {
    const k = url[i].split('=');
    if (k[0] == "id") {
      params.configId = k[1];
    } else if (k[0] == "datasrc") {
      params.dataSrc = k[1];
    }
  }
  if (location.hash) {
    params.initConfig = Utils.getConfigFromLocation(location);
  }
  return params;
}

const parentContainer = document.getElementById('root');
if (parentContainer) {

  //version tag for cache busting
  const dataVersionTag = parentContainer.hasAttribute(DataVersion_PropName)
    ?
    '?ver=' + parentContainer.getAttribute(DataVersion_PropName)
    :
    //by default, no version tag
    ''
    ;

  ReactDOM.render(
    <React.StrictMode>
      <GuidedTour>
        <App
          //configID is undefined when the viewer is used without backend (i.e. shipped within its dataset)
          {...getConfigParams()}
          dataVersionTag={dataVersionTag}
        />
      </GuidedTour>
    </React.StrictMode>,
    parentContainer
  );
}