<?php
require_once './constants.php';
require_once './sqlManager.php';

define("TABLE_NAME", "content"); 
define("ORDER_FIELD", "view_id"); // search order

$pdo->exec(
"CREATE TABLE IF NOT EXISTS content(
		view_id TEXT NOT NULL PRIMARY KEY,
		view_publish_id TEXT NOT NULL UNIQUE,
		dataset_id TEXT NOT NULL,
		description TEXT,
		image_group INTEGER,
		subview_image TEXT,
		subview_size INTEGER,
		subview_range_min INTEGER,
		subview_range_max INTEGER,
		init_deliniation INTEGER,
		image_size INTEGER,
		slide_count INTEGER,
		slice_step INTEGER,
		first_slide INTEGER,
		init_gamma INTEGER,
		init_bright INTEGER,
		matrix_data TEXT,
		zaviwer_ver INTEGER
	);"
);

$request = json_decode(file_get_contents('php://input'), true);
$mode = $request["mode"];
if(!empty($request["data"])) {
	$dataAry = $request["data"];
}
if(!empty($request["key"])) {
	$keyAry = $request["key"];
}
switch($mode){
	case "findAll":
		echo findAll();
		break;
	case "insert":
		insertRow($dataAry);
		break;
	case "update":
		updateRow($dataAry, $keyAry);
		break;
	case "delete":
		deleteRow($keyAry);
		break;
}

function insertRow($dataAry){
	global $pdo;
	$errAry = fieldCheck($dataAry, NULL);
	
	// key exists error
	if(count($errAry) == 0){
		$tmpKey = array("view_id" => $dataAry["view_id"]);
		if(countRows($tmpKey) > 0){
			$errAry["null"] = ERROR_ROW_EXISTS;
		}
	}
	
	if(checkError($errAry)){
		echo insert($dataAry);
	}
}

function updateRow($dataAry, $keyAry){
	global $pdo;
	$errAry = fieldCheck($dataAry, $keyAry);		
	if(checkError($errAry)){
		echo update($dataAry, $keyAry);
	}
}

function deleteRow($keyAry){
	echo delete($keyAry);
}

function fieldCheck($data, $key){
	global $pdo;
	$errAry = array();
	// view_id
	if($data["view_id"] == null){
		$errAry["view_id"] = ERROR_REQUIRED;
	}
	// view_publish_id
	if($data["view_publish_id"] == null){
		$errAry["view_publish_id"] = ERROR_REQUIRED;
	}else{
		if(!preg_match("/^[a-zA-Z0-9\_\-]+$/", $data["view_publish_id"])) {
			$errAry["view_publish_id"] = ERROR_PATH_FORMAT;
		}else{
			// after key exists error
			$sql = "SELECT COUNT(*) FROM content WHERE view_publish_id = '" . $data["view_publish_id"] . "' ";
			if($key != null){
				$sql .= " AND view_id != '".$key["view_id"]."'";
			}
			$sql .= ";";
			if($res = $pdo->query($sql)){
				if($res->fetchColumn() != 0){
					$errAry["view_publish_id"] = ERROR_ROW_EXISTS;
				}
			}
		}
	}
	//dataset_id
	if($data["dataset_id"] == null){
		$errAry["dataset_id"] = ERROR_REQUIRED;
		if(!preg_match("/^[a-zA-Z0-9\_\-]+$/", $data["dataset_id"])) {
			$errAry["dataset_id"] = ERROR_PATH_FORMAT;
		}
	}
	
	//image_group
	if($data["image_group"] != null){
		// ImageGroupTable not found error
		if($res = $pdo->query("SELECT COUNT(*) FROM image_group WHERE group_id = '".$data["image_group"]."';")){
			if($res->fetchColumn() == 0){
				$errAry["image_group"] = ERROR_KEY_NOT_EXISTS;
			}
		}
	}
	//subview_image
	if($data["subview_image"] != null){
		// FileTable not found error
		if($res = $pdo->query("SELECT COUNT(*) FROM file_table WHERE upload_id = '".$data["subview_image"]."';")){
			if($res->fetchColumn() == 0){
				$errAry["subview_image"] = ERROR_KEY_NOT_EXISTS;
			}
		}
	}
	//subview_size
	if (!preg_match("/^\d+$/", $data["subview_size"])) {
		$errAry["subview_size"] = ERROR_NUMBER_FORMAT;//"should be a value bigger than 0."
	}
	//subview_range_min
	if (!preg_match("/^\d+$/", $data["subview_range_min"])) {
		$errAry["subview_range_min"] = ERROR_NUMBER_FORMAT;//"should be a value bigger than 0."
	}
	//subview_range_max
	if (!preg_match("/^\d+$/", $data["subview_range_max"])) {
		$errAry["subview_range_max"] = ERROR_NUMBER_FORMAT;//"should be a value bigger than 0."
	}
	//init_deliniation
	if($data["init_deliniation"] != 1) {
		$data["init_deliniation"] = 0;
	}
	// image_size
	if (!preg_match("/^\d+$/", $data["image_size"])) {
		$errAry["image_size"] = ERROR_NUMBER_FORMAT;//"should be a value bigger than 1."
	}
	// slide_count
	if (!preg_match("/^\d+$/", $data["slide_count"])) {
		$errAry["slide_count"] = ERROR_NUMBER_FORMAT;//"should be a value bigger than 1."
	}
	// slice_step
	if (!preg_match("/^\d+$/", $data["slice_step"])) {
		$errAry["slice_step"] = ERROR_NUMBER_FORMAT;//"should be a value bigger than 1."
	}
	//first_slide
	if (!preg_match("/^\d+$/", $data["first_slide"])) {
		$errAry["first_slide"] = ERROR_NUMBER_FORMAT;//"should be a value bigger than 0."
	}
	//init_gamma
	if (!preg_match("/^\d+(\.\d)?$/", $data["init_gamma"])) {
		$errAry["init_gamma"] = ERROR_NUMBER_FORMAT;//"should be a value between 0.0 and 5.0."
	}
	//init_bright
	if (!preg_match("/^(\-|)\d+$/", $data["init_bright"])) {
		$errAry["init_bright"] = ERROR_NUMBER_FORMAT;//"should be a value between -255 and 255."
	}
	//matrix_data
	//zaviwer_ver
	
	return $errAry;
}

?>