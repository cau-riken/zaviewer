import _ from 'underscore';

import { createPath, parsePath } from 'history';
import qs from 'qs';

class Utils {

	//Finds y value of given object
	static findPosY(obj) {
		var curtop = 0;
		if (obj.offsetParent) {
			do {
				curtop += obj.offsetTop;
			} while (obj = obj.offsetParent);
			//console.log(curtop);	
			return [curtop];
		}
	}

	static findPosX(obj) {
		var curleft = 0;
		if (obj.offsetParent) {
			do {
				curleft += obj.offsetLeft;
			} while (obj = obj.offsetParent);
			//console.log(curleft);	
			return [curleft];
		}
	}

	static makePath(...args) {
		return args.reduce((acc, frag) => acc + (acc.endsWith("/") || frag.startsWith("/") ? "" : "/") + frag);
	}

	static getCleanHash(hash) {
		return hash.startsWith("#") ? hash.substring(1) : hash;
	}

	static getConfigFromLocation(location) {
		return qs.parse(this.getCleanHash(location.hash));
	}

	static pushHistoryStep(history, newParams) {
		const currentParams = this.getConfigFromLocation(history.location);
		const updStrParams = qs.stringify(_.extend(currentParams, newParams));
		const updatedPath = createPath(_.extend(_.clone(history.location), { hash: updStrParams }));
		if (updStrParams != this.getCleanHash(history.location.hash)) {
			history.push(updatedPath);
		}
	}

}

export default Utils;