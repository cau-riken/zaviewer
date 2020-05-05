<?php
require_once './constants.php';
require_once './sqlManager.php';

define("TABLE_NAME", "image_group");
define("ORDER_FIELD", "group_id"); // search order

$pdo->exec(
"CREATE TABLE IF NOT EXISTS image_group(
		group_id INTEGER NOT NULL PRIMARY KEY,
		group_name TEXT,
		description TEXT
	);"
);

$pdo->exec(
"CREATE TABLE IF NOT EXISTS image_group_list(
		upload_id TEXT NOT NULL,
		group_id INTEGER NOT NULL,
		PRIMARY KEY (upload_id, group_id)
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
	case "copy":
		
		break;
}

function findAll(){
	global $pdo;
	$sql = "SELECT ig.*, ";
	$sql .= " (SELECT COUNT(*) FROM image_group_list igl WHERE ig.group_id = igl.group_id) as count ";
	$sql .= " FROM image_group ig ";
	if(ORDER_FIELD != null){
		$sql .= " ORDER BY ".ORDER_FIELD;
	}
	$sql .= ";";
	
	$stmt = $pdo->prepare($sql);
	$stmt->execute();
	$res = $stmt->fetchAll();
	return json_encode($res);
}

function insertRow($dataAry){
	global $pdo;
	$errAry = fieldCheck($dataAry);
	
	// key exists error
	if(count($errAry) == 0){
		$tmpKey = array("group_id" => $dataAry["group_id"]);
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
	// group_id
	if (!preg_match("/^\d+$/", $data["group_id"])) {
		$errAry["group_id"] = ERROR_NUMBER_FORMAT;//"should be a value bigger than 0."
	}
	return $errAry;
}

?>