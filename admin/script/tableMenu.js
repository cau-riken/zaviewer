$(function(){
	var tableNameList = [["contentTable","contentImageTable",["importsGroupList"]],["imageGroupTable","imageGroupListTable"],["fileTable"]];
	var tagStr = "<div id=\"tableMenu\"><div>MENU</div>";
	$.each(tableNameList,function(){
		tagStr += getUlList(this);
	});
	tagStr += "</div>";
	$("body").append(tagStr);
});

function getUlList(target){
	var tagStr = "<ul>";
	$.each(target,function(){
		if(Array.isArray(this)){
			tagStr += getUlList(this);
		}else{
			tagStr += "<li><a href=\"./"+this+".html\">" + this + "</a></li>";
		}
	});
	tagStr += "</ul>";
	return tagStr;
}