
var ERROR = -10;// Communication error
var TIMEOUT = -11;// Communication timeout error
var ABORT = -12;// Communication interrupted error
var STATUS = -13;// Communication status error

var ERROR_NORMAL = -100;// Unknown error
var ERROR_PKEY_CHANGED = -102;// Deletion error(primary key changed)
var ERROR_UNSELECTED = -103;// Not selected error

// 1000～Normal Message
var MESSAGE_ADD = 1000;//Addition finished
var MESSAGE_UPDATE_CONFIRM = 1001;//Update confirmation
var MESSAGE_UPDATE = 1002;//Update finished
var MESSAGE_DELETE_CONFIRM = 1003;//Deletion confirmation
var MESSAGE_DELETE = 1004;//Deletion finished

// -10000～:Server Error
var ERROR_OTHER = -10010;// Unknown error
var ERROR_PATH_FORMAT = -10011;// Format error(file path)
var ERROR_NUMBER_FORMAT = -10012;// Format error(number)
var ERROR_ROW_EXISTS = -10013;// Key duplication
var ERROR_REQUIRED = -10014;// Required item absent
var ERROR_ROW_NOT_EXISTS = -10015;// Specified row does not exist
var ERROR_KEY_NOT_EXISTS = -10016;// Specified external key does not exist
var ERROR_UNKNOWN_PROTOCOL = -10017;// Unknow specified image retrieval protocol (IIP or IIIF)


var tableName;// Table name

var pkeyList = {};// Primary keys of selected rows

// At start-up
$(function(){
	// Get table name
	tableName = $('input[name="tableName"]').val();
	
	if($("#editTable").length){
		// Set field names to the input items
		$.each($("#editTable").find("input").not(":button, :submit, :reset, :hidden"),function(){
			//Clear input value
			this.value = "";
			if(this.name.lastIndexOf("f_",0) === 0){//f_...:fields
				if($("#columnName .t_"+this.name.substring(2)).length > 0){
					$(this).parent().prev()[0].innerHTML = $("#columnName .t_"+this.name.substring(2))[0].innerHTML;
					if($("#columnName .t_"+this.name.substring(2)).hasClass("keyColumn")){
						$(this).parent().prev().addClass("key");
					}else if($("#columnName .t_"+this.name.substring(2)).hasClass("uniqColumn")){
						$(this).parent().prev().addClass("uniq");
					}
				}
			}
		});
	}
	
	// Invalidate BS key
  $(document).keydown(function(e){
		if ((e.which && e.which === 8) || (e.keyCode && e.keyCode === 8)) {
			//return false;
		}
	});
	$('input[readonly]').on('keydown', function(e) {
		if ((e.which && e.which === 8) || (e.keyCode && e.keyCode === 8)) {
			$(this).val("");
			return false;
		}
	});
	
	if($("td>hr").length){
		$("td>hr").parent().attr("colspan",$("td>hr").parent().parent().prev().children().length);
	}
		
	//Register events
	$("#addBtn").click(clickAddButton);
	$("#updBtn").click(clickUpdateButton);
	$("#delBtn").click(clickDeleteButton);
	
	// Dialog
	$(".dialogClose").click(function(){$(this).parents(".dialogArea").hide();});
	$(".dialogClose").children().click(function(){return false;});
	$(".findKey").click(showFindKeyDialog);
	
	
	// If table name defined
	if(tableName != undefined){
		findTable();
	}
});

// Event to select a row
function clickRow(){
	// Cancel selected status
	$("#dataTable .selected").removeClass("selected");
	pkeyList = {};
	
	// Delete message
	$("#submitMessage").empty();
	
	$(this).addClass("selected");
	if($("#editTable").length){
		$("#btnArea").find("input:button").prop("disabled", false);
		$.each(this.children,function(){
			var value = this.innerHTML;
			$.each(this.classList, function(){
				if(this.lastIndexOf("t_",0) === 0){
					var key = this.substring(2);
					var field = $('input[name="f_'+ key +'"]');
					// Convert to 0 or 1 if it is a checkbox
					if(field.attr("type") == "checkbox"){
						if(value != 1){
							value = 0;
						}
						field.prop("checked",(value == 1));
					}
					// Set the value
					field.val(value);
					if($('input[name="f_'+ key +'"]').parent().prev().hasClass("key")){
						pkeyList[key] = value;// Keep original values in an array
					}
				}
			});
		});
	}
}

// The movement of loader
function animateLoader(jqObj){
	jqObj.animate(
		{zIndex:1},{
		duration:2500,
		step:function (now) {
			$(this).css({transform:"rotate(" + now * 720 + "deg)"})
		},
		complete:function(){
			$(this).css({zIndex:0})
			if($(this).is(":visible")){
				animateLoader($(this));
			}else{
				$(this).css({transform:""})
			}
		}
	});
}


//Search the table
function findTable(){
	// Show loader
	if($("#tableLoader").length){
		$("#tableLoader").show();
		animateLoader($("#tableLoader").children("img"));
	}
	
	// Disable button
	$("#btnArea").find("input:button").prop("disabled", true);
	
	var json ={mode:"findAll"};
	send(tableName, json, onloadFindTable, errorFindTable);
}

//Table searching succeeded(callback)
function onloadFindTable(xhr){
	//alert(xhr.responseText);
	// Hide loader
	$("#tableLoader").hide();
	
	// Enable ADD button
	$("#addBtn").prop("disabled", false);
	
	var dataList = JSON.parse(xhr.responseText);
	showTable(dataList)
}
//Table searching error(callback)
function errorFindTable(status){
	showErrorMessage(status);
	
	// Hide loader
	$("#tableLoader").hide();
}

// Show table data on the screen
function  showTable(dataList){
	// Delete the added row
	$("#dataTable tr.row").remove();
		
	$.each(dataList,function(){
		//Duplicate the table
		var tr = $("#columnName").clone();
		tr.attr("id","");
		tr.addClass("row");
		tr.on("click", clickRow);
		// Write data
		$.each(this,function(key, value) {
			var td = tr.children(".t_" + key);
			td.html(value);
		});
		tr.appendTo("#dataTable");
	});
}



// ADD button click
function clickAddButton(){
	// Clear the message
	$("#submitMessage").empty();
	
	// Insert a row
	insertRow()
}

// Insert a row
function insertRow(){	
	var isError = false;
	var rowData = {};
	// Loop through the input values
	$.each($("#editTable").find("input").not(":button, :submit, :reset, :hidden"),function(){
		var value = this.value;
		if(this.name.lastIndexOf("f_",0) === 0){
			// Convert to 0 or 1 if it is a checkbox
			if($(this).attr("type") == "checkbox"){
				if($(this).prop("checked")){
					value = 1;
				}else{
					value = 0;
				}
			}
			// Error if is is a key but absent
			if(value == "" && ($(this).parent().prev().hasClass("key") || $(this).parent().prev().hasClass("uniq"))){
				//$(this).after("<div class='error'>Required item.</div>");
				var key = this.name.substring(2);
				//$("#submitMessage").append("<div class='error'>"+ getErrorMessage(ERROR_REQUIRED, key) +"</div>");
				showErrorMessage(ERROR_REQUIRED, key);
				isError = true;
			}else if($(this).attr("type") == "number" && !$(this).hasClass("nocheck")){
				if(value == "" || 
						($(this)[0].min != "" && $(this)[0].min > Number(value)) || 
						($(this)[0].max != "" && $(this)[0].max < Number(value))){
					var key = this.name.substring(2);
					//$("#submitMessage").append("<div class='error'>"+ getErrorMessage(ERROR_NUMBER_FORMAT, key) +"</div>");
					showErrorMessage(ERROR_NUMBER_FORMAT, key);
					isError = true;
				}
			}
		}
		if(!isError){
			rowData[this.name.substring(2)] = value;// Assign input values to array
		}
	});
	
	if(!isError){
		var jsonData = {mode:"insert",data: rowData};
		send(tableName, jsonData, onloadInsertRow, errorInsertRow);
	}
}

// Row insertion succeeded(callback)
function onloadInsertRow(xhr){
	// console.log(xhr.responseText);
	try{
		var dataList = JSON.parse(xhr.responseText);
		// Error
		if(dataList["error"] != null){
			showErrorMessageList(dataList["error"])
			//$("#submitMessage").append("<div class='error'>"+dataList["error"]+"</div>");
		}else{
			showTable(dataList);
			//Show the message
			$("#submitMessage").append("<div>"+ getMessage(MESSAGE_ADD) +"</div>");
		}
	}catch(e){
		$("#submitMessage").append("<div class='error'>"+ e +":" +xhr.responseText+"</div>");	
	}
}
// Row insertion error(callback)
function errorInsertRow(status){
	//$("#submitMessage").append("<div class='error'>"+ getErrorMessage(status) +"</div>");	
	showErrorMessage(status);
}



// UPDATE button click
function clickUpdateButton(){
	if(Object.keys(pkeyList).length == 0){
		// Clear the message
		$("#submitMessage").empty();
		//$("#submitMessage").append("<div class='error'>"+ getErrorMessage(ERROR_UNSELECTED) +"</div>");	
		showErrorMessage(ERROR_UNSELECTED);//Row not selected
		return;
	}
	showDialog(getMessage(MESSAGE_UPDATE_CONFIRM), updateRow, null);
}

// Update a row
function updateRow(){
	// Clear the message
	$("#submitMessage").empty();
	var isError = false;
	var rowData = {};
	// Loop through the input values
	$.each($("#editTable").find("input").not(":button, :submit, :reset, :hidden"),function(){
		var value = this.value;
		if(this.name.lastIndexOf("f_",0) === 0){
			// Convert to 0 or 1 if it is a checkbox
			if($(this).attr("type") == "checkbox"){
				if($(this).prop("checked")){
					value = 1;
				}else{
					value = 0;
				}
			}
			// Error if it is a key but absent
			if(value == "" && ($(this).parent().prev().hasClass("key") || $(this).parent().prev().hasClass("uniq"))){
				var key = this.name.substring(2);
				showErrorMessage(ERROR_REQUIRED, key);
				isError = true;
			}else if($(this)[0].type == "number" && !$(this).hasClass("nocheck")){
				if(value == "" || 
						($(this)[0].min != "" && $(this)[0].min > Number(value)) || 
						($(this)[0].max != "" && $(this)[0].max < Number(value))){
					var key = this.name.substring(2);
					showErrorMessage(ERROR_NUMBER_FORMAT, key);
					isError = true;
				}
			}
		}
		if(!isError){
			rowData[this.name.substring(2)] = value;// Assign input values to array
		}
	});
	
	if(!isError){
		var jsonData = {mode:"update",data: rowData, key: pkeyList};
		send(tableName, jsonData, onloadUpdateRow, errorUpdateRow);
	}
}
//Row update succeeded(callback)
function onloadUpdateRow(xhr){
	try{
		var dataList = JSON.parse(xhr.responseText);
		if(dataList["error"] != null){
			// Error code
			showErrorMessageList(dataList["error"]);
		}else{
			// Initialize the primary key list
			pkeyList = {};
			
			// Enable ADD button
			$("#addBtn").prop("disabled", false);
			// Disable UPDATE button
			$("#updBtn").prop("disabled", true);
			// Disable DELETE button
			$("#delBtn").prop("disabled", true);
			
			showTable(dataList);
			//Show the message
			$("#submitMessage").append("<div>"+ getMessage(MESSAGE_UPDATE) +"</div>");
		}
	}catch(e){
		$("#submitMessage").append("<div class='error'>"+ e +":" +xhr.responseText+"</div>");	
	}
}
//Row update error(callback)
function errorUpdateRow(status){
	//$("#submitMessage").append("<div class='error'>"+ getErrorMessage(status) +"</div>");	
	showErrorMessage(status);
	console.log(status);
}



// DELETE button click
function clickDeleteButton(){	
	if(Object.keys(pkeyList).length == 0){
		// Clear the message
		$("#submitMessage").empty();
		//$("#submitMessage").append("<div class='error'>"+ getErrorMessage(ERROR_UNSELECTED) +"</div>");	
		showErrorMessage(ERROR_UNSELECTED);//Row not selected
		return;
	}
	showDialog(getMessage(MESSAGE_DELETE_CONFIRM), deleteRow, null);
}

// Delete a row
function deleteRow(){	
	// Clear the message
	$("#submitMessage").empty();
	
	var isError = false;
	
	if(!isError){
		var jsonData = {mode:"delete",key: pkeyList};
		send(tableName, jsonData, onloadDeleteRow, errorDeleteRow);
	}
}
//Row deletion succeeded(callback)
function onloadDeleteRow(xhr){
	try{
		var dataList = JSON.parse(xhr.responseText);
		if(dataList["error"] != null){
			// Error code
			showErrorMessageList(dataList["error"]);
		}else{
			// Initialize the primary key list
			pkeyList = {};
			
			// Enable ADD button
			$("#addBtn").prop("disabled", false);
			// Disable UPDATE button
			$("#updBtn").prop("disabled", true);
			// Disable DELETE button
			$("#delBtn").prop("disabled", true);
			
			showTable(dataList);
			//Show the message
			$("#submitMessage").append("<div>"+ getMessage(MESSAGE_DELETE) +"</div>");
		}
	}catch(e){
		$("#submitMessage").append("<div class='error'>"+ e +":" +xhr.responseText+"</div>");	
	}
}
//Row deletion error(callback)
function errorDeleteRow(status){
	//$("#submitMessage").append("<div class='error'>"+ getErrorMessage(status) +"</div>");	
	showErrorMessage(status);
	console.log(status);
}


// Show the dialog
function showDialog(message,okCallback,cancelCallback){
	$("#dialogArea .body>span")[0].innerHTML = message;
	$("#dialogArea").show();
	$("#okBtn").unbind("click").click(function(){
		okCallback();
		$(this).parents(".dialogArea").hide();
	});
	$("#cancelBtn").unbind("click").click(function(){
		if(cancelCallback != null){
			cancelCallback();
		}
		$(this).parents(".dialogArea").hide();
	});
}

// Show the dialog to acquire a key
function showFindKeyDialog(){
	var findTableName = $(this).attr("name");
	var skeyList = {};
	var dialogName = "#l_" + findTableName;
	$(dialogName).show();
	
	// Initialize the list box
	$(dialogName +" input[type='text']").val("").addClass($(this).prev().attr("name"));
	
	// OK button click event
	$(dialogName + " input[name='okBtn']").unbind("click").click(function () {
		var fields = $(dialogName + " input[type='text']");
		var fieldsNb = fields.length;
		for (var i = 0; i < fields.length; i++) {
			var field = $(fields[i]);
			if (field.val() != "") {
				if (fieldsNb == 1) {
					//legacy logic, affect value to field whose name was stored in class attribute (see above)
					$("#editTable input[name='" + field.attr("class") + "']").val(field.val());
				} else {
					//use name of dialog box fields to populate main form fields
					var fieldName = field.attr("name").substring(2);
					$("#editTable input[name='" + "f_" + fieldName + "']").val(field.val());
				}
			}
			field.removeClass();
		}
		$(this).parents(".dialogArea").hide();
	});
	
	$(dialogName + " .tableLoader").show();
	animateLoader($(dialogName + " .tableLoader").children("img"));
	
	//Searching condition
	$.each($(".s_" + $(this).prev().attr("name").substring(2)),function() {
		skeyList[this.name] = this.value;
	});
	
		
	var json ={mode:"findAll",key:skeyList};
	send(findTableName, json, onloadFindKeyDialog, errorFindKeyDialog);
	
}
// Table searching dialog succeeded(callback)
function onloadFindKeyDialog(xhr, findTableName){
	var dialogName = "#l_" + findTableName;
	
	// Hide loader
	$(dialogName +" .tableLoader").hide();
	
	var dataList = JSON.parse(xhr.responseText);
	$(dialogName + " tr.row").remove();
	$.each(dataList,function(){
		//Duplicate table
		var tr = $(dialogName + " .dataList tr:first").clone();
		tr.attr("id","");
		tr.addClass("row");
		tr.on("click", clickDialogRow);
		// Write data
		$.each(this,function(key, value) {
			var td = tr.children(".t_" + key);
			td.html(value);
		});
		tr.appendTo(dialogName + " table.dataList");
	});
}
// Table searching dialog error(callback)
function errorFindKeyDialog(status, findTableName){
	showErrorMessage(status);
	// Hide loader
	$("#l_" + findTableName +" .tableLoader").hide();
}
// Select row in the dialog
function clickDialogRow() {
	// Change selection state
	$(this).siblings(".selected").removeClass("selected");
	$(this).addClass("selected");
	var fields = $(this).parents(".dataListDialog").find("input[type='text']");
	for (var i = 0; i < fields.length; i++) {
		var field = $(fields[i]);
		var fieldName = field.attr("name").substring(2);
		field.val($(this).children(".t_" + fieldName)[0].innerHTML);
	}
}

// Get a normal message
function getMessage(msgId){
	switch (msgId) {
		case MESSAGE_ADD:
			return "Row added.";
			break;
		case MESSAGE_UPDATE_CONFIRM:
			return "Is it OK to update the row?";
			break;
		case MESSAGE_UPDATE:
			return "Row updated.";
			break;
		case MESSAGE_DELETE_CONFIRM:
			return "Is it OK to delete the row?";
			break;
		case MESSAGE_DELETE:
			return "Row deleted.";
			break;
	}
}

// Get an error message
function getErrorMessage(errId, fieldId){
	switch (errId) {
		case ERROR_PATH_FORMAT:// Foramt error(file path)
			return $("#columnName .t_"+fieldId)[0].innerHTML + " should contain only half-width alphanumeric, hyphen or underscore.";
			break;
		case ERROR_NUMBER_FORMAT:// Format error(number)
			if($('input[name="f_'+ fieldId+'"]')[0].max != ""){
				return $("#columnName .t_"+fieldId)[0].innerHTML + " should be a value between " + $('input[name="f_'+ fieldId+'"]')[0].min + " and " + $('input[name="f_'+ fieldId+'"]')[0].max + ".";
			}else{
				return $("#columnName .t_"+fieldId)[0].innerHTML + " should be a value bigger than " + $('input[name="f_'+ fieldId+'"]')[0].min + ".";
			}
			break;
		case ERROR_ROW_EXISTS:// Key duplication error
			if(fieldId && fieldId != "null"){
				return $("#columnName .t_"+fieldId)[0].innerHTML + " has already been registered.";
			}else{
				return "Already registered.";
			}
			break;
		case ERROR_REQUIRED:// Required item absent
			return $("#columnName .t_"+fieldId)[0].innerHTML + " is required.";
			break;
		case ERROR_PKEY_CHANGED:
			return "The key has been changed. Please select again.";
			break;
		case ERROR_ROW_NOT_EXISTS:
			return "The specified row does not exist.";
			break;
		case ERROR_KEY_NOT_EXISTS:
			return  $("#columnName .t_"+fieldId)[0].innerHTML + " does not exist in the relevant table.";
			break;
			
		case ERROR_UNKNOWN_PROTOCOL:
			// Unknow specified image retrieval protocol
			return  $("#columnName .t_"+fieldId)[0].innerHTML + " should be either 'IIP' or 'IIIF' (or null).";
			break;
		case ERROR_UNSELECTED:
			return "No row has been selected.";
			break;
			
		case ERROR_OTHER://Unknow, maybe DB related error
			return "Other server error: " + errId;
			break;
		default:
			return "Other error: " + errId;
	}
}
// Show error list in response
function showErrorMessageList(errAry){
	$.each(errAry,function(key, value){
		$("#submitMessage").append("<div class='error'>"+ getErrorMessage(value, key) +"</div>");	
	});
}
// Show error message in response
function showErrorMessage(errId, fieldId){
	$("#submitMessage").append("<div class='error'>"+ getErrorMessage(errId, fieldId) +"</div>");	
}


//Send Json data asynchronously
function send(table ,json, callback, errorCallbck){
	var xhr = new XMLHttpRequest();
	xhr.open("POST", "./" + table + ".php");
	try{
		xhr.overrideMimeType("text/plain; charset=UTF-8"); 
	}catch(e){
		// IE10 and below not supported
		xhr.abort();
		return false;
	}
	xhr.setRequestHeader("Pragma", "no-cache");
	xhr.setRequestHeader("Cache-Control", "no-cache");
	xhr.setRequestHeader("If-Modified-Since", "Thu, 01 Jun 1970 00:00:00 GMT");
	xhr.onerror = function(){errorCallbck(ERROR, table);}// Error
	xhr.onabort = function(){errorCallbck(ABORT, table);}// Interrupted
	xhr.ontimeout = function(){errorCallbck(TIMEOUT, table);}// Timeout
	xhr.onload = function(){
		if(xhr.status == "200"){
			// Callback
			callback(xhr, table);
		}else{
			errorCallbck(xhr.status + " " + xhr.statusText, table);
		}
	};
	
	// Set to header if json available
	if(json != null){
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify(json));
	}else{
		xhr.send();
	}
	return true;
}