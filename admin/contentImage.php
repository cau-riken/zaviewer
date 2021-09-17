<?php
require_once './constants.php';
require_once './sqlManager.php';

define("TABLE_NAME", "content_image");
define("ORDER_FIELD", "view_id, sort_no"); // search order

$pdo->exec(
"CREATE TABLE IF NOT EXISTS content_image(
		view_id TEXT NOT NULL,
		upload_id TEXT NOT NULL,
		initial_opacity INTEGER,
		sort_no INTEGER,
		protocol TEXT DEFAULT 'IIIF',
		initial_contrast DECIMAL(5.2) DEFAULT 1.00,
		initial_gamma DECIMAL(5.2) DEFAULT 1.00,
		PRIMARY KEY (view_id, upload_id)
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
	$errAry = fieldCheck($dataAry);
	// key exists error
	if(count($errAry) == 0){
		$tmpKey = array("view_id" => $dataAry["view_id"], "upload_id" =>  $dataAry["upload_id"]);
		if(countRows($tmpKey) > 0){
			$errAry["null"] = ERROR_ROW_EXISTS;
		}
	}
	
	if(checkError($errAry)){
		setSortNo($dataAry,array("view_id" => $dataAry["view_id"]));
		echo insert($dataAry);
	}
}

function updateRow($dataAry, $keyAry){
	global $pdo;
	$errAry = fieldCheck($dataAry);		
	if(checkError($errAry)){
		setSortNo($dataAry, $keyAry);
		echo update($dataAry, $keyAry);
	}
}

function deleteRow($keyAry){
	echo delete($keyAry);
}

function setSortNo(&$data, $key){
	global $pdo;
	if($data["sort_no"] == null){
		$sql = "SELECT MAX(sort_no) FROM " . TABLE_NAME . " WHERE sort_no";
		if($key != null){
			$sql .= " AND view_id = '".$key["view_id"]."' AND upload_id <> '".$key["upload_id"]."'";
		}
		if($res = $pdo->query($sql)){
			 $data["sort_no"] = intval($res->fetchColumn()) + 1;
		}
	}	
}

function fieldCheck($data){
	global $pdo;
	$errAry = array();
	// initial_opacity
	if (!preg_match("/^(\d|[1-9]\d|100)(\.0+)?$/", $data["initial_opacity"])) {
		$errAry["initial_opacity"] = ERROR_NUMBER_FORMAT;//" should be a value between 0 and 100."
	}
	//view_id
	if($data["view_id"] == null){
		$errAry["view_id"] = ERROR_REQUIRED;
	}else{
		if(!preg_match("/^[a-zA-Z0-9\_\-]+$/", $data["view_id"])) {
			$errAry["view_id"] = ERROR_PATH_FORMAT;
		}else{
			// contentTable not found error
			if($res = $pdo->query("SELECT COUNT(*) FROM content WHERE view_id = '".$data["view_id"]."';")){
				if($res->fetchColumn() == 0){
					$errAry["view_id"] = ERROR_KEY_NOT_EXISTS;
				}
			}
		}
	}
	// upload_id
	if($data["upload_id"] == null){
		$errAry["upload_id"] = ERROR_REQUIRED;
	}else{
		if(!preg_match("/^[a-zA-Z0-9\_\-]+$/", $data["upload_id"])) {
			$errAry["upload_id"] = ERROR_PATH_FORMAT;
		}else{
			// fileTable not found error
			if($res = $pdo->query("SELECT COUNT(*) FROM file_table WHERE upload_id = '".$data["upload_id"]."';")){
				if($res->fetchColumn() == 0){
					$errAry["upload_id"] = ERROR_KEY_NOT_EXISTS;
				}
			}
		}
	}

	//image retrieval protocol 
	if($data["protocol"] != null && $data["protocol"] != "IIP" && $data["protocol"] != "IIIF" ){
		$errAry["protocol"] = ERROR_UNKNOWN_PROTOCOL;
	}

	// initial_contrast
	if (!preg_match("/^\d+(\.\d{0,2})?$/", $data["initial_contrast"])) {
		$errAry["initial_contrast"] = ERROR_NUMBER_FORMAT;//"should be a value between 0.00 and 5.00."
	}

	// initial_gamma
	if (!preg_match("/^\d+(\.\d{0,2})?$/", $data["initial_gamma"])) {
		$errAry["initial_gamma"] = ERROR_NUMBER_FORMAT;//"should be a value between 0.00 and 5.00."
	}

	return $errAry;
}

?>