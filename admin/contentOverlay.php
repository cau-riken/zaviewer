<?php
require_once './constants.php';
require_once './sqlManager.php';

define("TABLE_NAME", "content_overlay"); 
define("ORDER_FIELD", "view_id, sort_no"); // search order

$pdo->exec(
"CREATE TABLE IF NOT EXISTS content_overlay(
		view_id TEXT NOT NULL,
		svg_file TEXT NOT NULL,
		sort_no INTEGER NOT NULL DEFAULT 0,
		label TEXT NOT NULL,
		is_atlas INTEGER NOT NULL DEFAULT 1,
		tree_view TEXT,
		PRIMARY KEY (view_id, svg_file)	
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
		$tmpKey = array("view_id" => $dataAry["view_id"], "svg_file" => $dataAry["svg_file"]);
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
	$errAry = fieldCheck($dataAry, $keyAry);		
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
			$sql .= " AND view_id = '".$key["view_id"]."' AND svg_file <> '".$key["svg_file"]."'";
		}
		if($res = $pdo->query($sql)){
			 $data["sort_no"] = intval($res->fetchColumn()) + 1;
		}
	}	
}

function fieldCheck($data, $key){
	global $pdo;
	$errAry = array();
	// view_id
	if($data["view_id"] == null){
		$errAry["view_id"] = ERROR_REQUIRED;
	}
	//sort_no
	if($data["sort_no"] == null){
		$errAry["sort_no"] = ERROR_REQUIRED;
	}else{
		if (!preg_match("/^\d+$/", $data["sort_no"])) {
			$errAry["sort_no"] = ERROR_NUMBER_FORMAT;
		}else{
			$sql = "SELECT COUNT(*) FROM content_overlay WHERE sort_no = '" . $data["sort_no"] . "' ";
			$sql .= " AND view_id = '".$data["view_id"]."'"; 
			if($key != null){
				//update: check that sort_no is not used by another overlay entry  for this viewer (different from the one being updated)
				$sql .= " AND svg_file != '".$key["svg_file"]."'";
			} else {
				//insert: just check that sort_no is not already used by any overlay entry for this viewer				
			}

			$sql .= ";";
			if($res = $pdo->query($sql)){
				if($res->fetchColumn() != 0){
					$errAry["sort_no"] = ERROR_ROW_EXISTS;
				}
			}
		}
	}
	//svg_file
	if($data["svg_file"] != null){
		// FileTable not found error
		if($res = $pdo->query("SELECT COUNT(*) FROM file_table WHERE upload_id = '".$data["svg_file"]."';")){
			if($res->fetchColumn() == 0){
				$errAry["svg_file"] = ERROR_KEY_NOT_EXISTS;
			}
		}
	}
	//tree_view
	if($data["tree_view"] != null){
		// FileTable not found error
		if($res = $pdo->query("SELECT COUNT(*) FROM file_table WHERE upload_id = '".$data["tree_view"]."';")){
			if($res->fetchColumn() == 0){
				$errAry["tree_view"] = ERROR_KEY_NOT_EXISTS;
			}
		}
	}
	
	return $errAry;
}

?>
