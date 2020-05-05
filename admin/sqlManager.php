<?php
require_once './constants.php';
$pdo;

// create data folder
if(!file_exists("./data/")){
	mkdir("./data/", 0755);
}
try{
	//open sqlite
	$pdo = new PDO('sqlite:./data/sqlite.db');
	$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
	$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
	exit('Connection failed：'.$e->getMessage());
}

if (!function_exists("findAll")) {
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
		return json_encode($res);
	}
}

function find($keyAry){
	global $pdo;
	$keyField = array();
	foreach($keyAry as $key => $value){
		$keyField[] = $key . " = :k_" . $key;
	}
	if(count($keyField) > 0){
		$sql = "SELECT * FROM " . TABLE_NAME . " WHERE " . implode(" AND ",$keyField) . ";";
		$stmt = $pdo->prepare($sql);
		foreach($keyAry as $key => $value){
			$stmt->bindParam(':k_'.$key, $keyAry[$key], getParamType($key));
		}
		$stmt->execute();
		$res = $stmt->fetchAll();
		return json_encode($res);
	}
}

function insert($data){
	global $pdo;
	
	$field = array();
	foreach($data as $key => $value){
		$field[] = $key;
	}
	if(count($field) > 0){
		$sql = "INSERT INTO ".TABLE_NAME."(" . implode(",",$field) . ") VALUES (:" . implode(",:",$field) . ");";
		$stmt = $pdo->prepare($sql);
		foreach($data as $key => $value){
			$stmt->bindParam(':'.$key, $data[$key], getParamType($key));
		}
		$stmt->execute();
		
		return findAll();
	}else{
		return json_encode(array("error" => array("null" => ERROR_OTHER)));
	}
}

function update($dataAry, $keyAry){
	global $pdo;
	// key is exists
	if(countRows($keyAry) == 0){
		return json_encode(array("error" => array("null" => ERROR_ROW_NOT_EXISTS)));
	}
	// after key is exists
	$tmpKey = array();
	$isChanged = false;
	foreach($keyAry as $key => $value){
		$tmpKey += array($key => $dataAry[$key]);
		if($value != $dataAry[$key]){
			$isChanged = true;
		}
	}
	if($isChanged){// 
		if(countRows($tmpKey) > 0){
			return json_encode(array("error" => array("null" => ERROR_ROW_EXISTS)));
		}
	}
	
	$field = array();
	foreach($dataAry as $key => $value){
		$field[] = $key . "= :" . $key;
	}
	$keyField = array();
	foreach($keyAry as $key => $value){
		$keyField[] = $key . "= :k_" . $key;
	}
	if(count($field) > 0 && count($keyField) > 0){
		$sql = "UPDATE ".TABLE_NAME." SET " . implode(",",$field) . " WHERE " . implode(" AND ",$keyField) . ";";
		$stmt = $pdo->prepare($sql);
		foreach($dataAry as $key => $value){
			$stmt->bindParam(':'.$key, $dataAry[$key], getParamType($key));
		}
		foreach($keyAry as $key => $value){
			$stmt->bindParam(':k_'.$key, $keyAry[$key], getParamType($key));
		}
		$stmt->execute();
	
		return findAll();
	}else{
		return json_encode(array("error" => array("null" => ERROR_OTHER)));
	}
}

function delete($keyAry){
	global $pdo;
	// key dose not exists
	if(countRows($keyAry) == 0){
		return json_encode(array("error" => array("null" => ERROR_ROW_NOT_EXISTS)));
	}
	
	$keyField = array();
	foreach($keyAry as $key => $value){
		$keyField[] = $key . "= :k_" . $key;
	}
	if(count($keyField) > 0){
		$sql = "DELETE FROM ".TABLE_NAME." WHERE " . implode(" AND ",$keyField) . ";";
		$stmt = $pdo->prepare($sql);
		foreach($keyAry as $key => $value){
			$stmt->bindParam(':k_'.$key, $keyAry[$key], getParamType($key));
		}
		$stmt->execute();
		
		return findAll();
	}else{
		return json_encode(array("error" => array("null" => ERROR_OTHER)));
	}
}

function countRows($keyAry){
	global $pdo;
	$keyField = array();
	foreach($keyAry as $key => $value){
		$keyField[] = $key . "= :k_" . $key;
	}
	$sql = "SELECT COUNT(*) FROM ".TABLE_NAME;
	if(count($keyField) > 0){
		$sql .= " WHERE " . implode(" AND ",$keyField) . ";";
		$stmt = $pdo->prepare($sql);	
		foreach($keyAry as $key => $value){
			$stmt->bindParam(':k_'.$key, $keyAry[$key], getParamType($key));
		}
	}else{
		$stmt = $pdo->prepare($sql);
	}
	$stmt->execute();
	return $stmt->fetchColumn();
}

function getParamType($fieldId){
	switch($fieldId){
		case "initial_opacity":
		case "sort_no":
			return PDO::PARAM_INT;
		default:
			return PDO::PARAM_STR;
	}
}

function checkError($errAry){
	if(count($errAry) == 0){
		return true;
	}
	echo json_encode(array("error" => $errAry));
	return false;
}
?>