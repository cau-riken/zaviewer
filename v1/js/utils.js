//Finds y value of given object
function findPosY(obj) {
	var curtop = 0;
	if (obj.offsetParent) {
		do {
			curtop += obj.offsetTop;
		} while (obj = obj.offsetParent);
	//console.log(curtop);	
	return [curtop];
	}
}

function findPosX(obj) {
	var curleft = 0;
	if (obj.offsetParent) {
		do {
			curleft += obj.offsetLeft;
		} while (obj = obj.offsetParent);
	//console.log(curleft);	
	return [curleft];
	}
}