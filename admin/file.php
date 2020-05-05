<?php
require_once './constants.php';
require_once './sqlManager.php';
define("TABLE_NAME", "file_table");
define("ORDER_FIELD", "path_type,upload_id"); // search ordr

$pdo->exec(
"CREATE TABLE IF NOT EXISTS file_table(
		path_type INTEGER NOT NULL,
		publish_id TEXT NOT NULL PRIMARY KEY,
		upload_id TEXT UNIQUE NOT NULL,
		extension TEXT,
		display_name TEXT,
		description TEXT
	);"
);

$request = json_decode(file_get_contents('php://input'), true);
$mode = $request["mode"];
if(!empty($request["key"])) {
	$keyAry = $request["key"];
}
switch($mode){
	case "findAll":
		if(empty($keyAry)){
			echo findAll();
		}else{
			echo find($keyAry);
		}
		break;
	case "delete":
		deleteRow($keyAry);
		break;
}

function findAll(){
	global $pdo;
	$sql = "SELECT * FROM " . TABLE_NAME;
	if(ORDER_FIELD != null){
		$sql .= " ORDER BY ".ORDER_FIELD;
	}
	$sql .= ";";
	
	$stmt = $pdo->prepare($sql);
	$stmt->execute();
	$res = $stmt->fetchAll();
	
	
	for($i = 0;$i< count($res); $i++){
	
		switch($res[$i]["path_type"]){
			case "0":
				$res[$i]["path_type_name"] = "Main View";
				break;
			case "1":
				$res[$i]["path_type_name"] = "Subview";
				break;
			case "2":
				$res[$i]["path_type_name"] = "SVG";
				break;
			case "3":
				$res[$i]["path_type_name"] = "Tree HTML";
				break;
		}
	}
	
	return json_encode($res);
}

function deleteRow($keyAry){
	echo delete($keyAry);
}

?>