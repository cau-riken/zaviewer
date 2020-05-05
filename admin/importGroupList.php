<?php
require_once './constants.php';
require_once './sqlManager.php';

define("TABLE_NAME", "file_table"); 
define("ORDER_FIELD", "path_type,upload_id"); // search order

$request = json_decode(file_get_contents('php://input'), true);
$mode = $request["mode"];
if(!empty($request["key"])) {
	$keyAry = $request["key"];
}
switch($mode){
	case "import":
		if($keyAry != NULL){
			echo importRows($keyAry);
		}else{
			return json_encode(array("error" => array("null" => ERROR_OTHER)));
		}
		break;
}

function importRows($keyAry){
	global $pdo;
	
	$sql = "SELECT * FROM image_group_list igl ";
	$sql .= " WHERE igl.group_id = :group_id ";
	$sql .= " AND NOT EXISTS(SELECT 1 FROM content_image ci WHERE ci.view_id = :view_id AND igl.upload_id = ci.upload_id) ";
	$sql .= " ORDER BY igl.upload_id; ";
	$stmt = $pdo->prepare($sql);
	$stmt->bindParam(':group_id', $keyAry["group_id"], getParamType($key));
	$stmt->bindParam(':view_id', $keyAry["view_id"], getParamType($key));
	$stmt->execute();
	$res = $stmt->fetchAll();
	
	if(count($res) > 0){
		$sortNo = getSortNo($keyAry);
		foreach($res as $data){
			$sql = "INSERT INTO content_image (view_id, upload_id, initial_opacity, sort_no) VALUES (:view_id, :upload_id, 0, :sort_no);";
			$stmt = $pdo->prepare($sql);
			$stmt->bindParam(':view_id', $keyAry["view_id"], PDO::PARAM_STR);
			$stmt->bindParam(':upload_id', $data["upload_id"], PDO::PARAM_STR);
			$stmt->bindParam(':sort_no', $sortNo, PDO::PARAM_INT);
			$stmt->execute();
			$sortNo++;
		}
	}
	return json_encode(array("addCount" => count($res)));
}

function getSortNo($key){
	global $pdo;
	$num = 1;
	if($data["sort_no"] == null){
		$sql = "SELECT MAX(sort_no) FROM content_image WHERE sort_no";
		if($key != null){
			$sql .= " AND view_id = '".$key["view_id"]."' ";
		}
		if($res = $pdo->query($sql)){
			$num = intval($res->fetchColumn()) + 1;
		}
	}	
	return $num;
}