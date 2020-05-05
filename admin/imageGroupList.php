<?php
require_once './constants.php';
require_once './sqlManager.php';

define("TABLE_NAME", "image_group_list");
define("ORDER_FIELD", "group_id, upload_id"); // search order

// create table
$pdo->exec(
"CREATE TABLE IF NOT EXISTS image_group_list(
		upload_id TEXT NOT NULL,
		group_id INTEGER NOT NULL,
		PRIMARY KEY (upload_id, group_id)
	);"
);

$request = json_decode(file_get_contents('php://input'), true);
//var_dump($request);
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
		$tmpKey = array("upload_id" => $dataAry["upload_id"], "group_id" =>  $dataAry["group_id"]);
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
	$errAry = fieldCheck($dataAry);		
	if(checkError($errAry)){
		echo update($dataAry, $keyAry);
	}
}

function deleteRow($keyAry){
	echo delete($keyAry);
}

function fieldCheck($data){
	global $pdo;
	$errAry = array();
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
	// group_id
	if (!preg_match("/^\d+$/", $data["group_id"])) {
		$errAry["group_id"] = ERROR_NUMBER_FORMAT;//"should be a value bigger than 0."
	}
	return $errAry;
}

?>