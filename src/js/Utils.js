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

}

export default Utils;