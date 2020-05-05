<?php

$id = "";
if(isset($_POST['id'])){
	$id = $_POST['id'];
}else{
	echo json_encode(array("error"=>"notfound"));
	return;
}

// create data dir
if(!file_exists("./data/")){
	mkdir("./data/", 0755);
}
$pdo;
try{
	//open sqlite
	$pdo = new PDO('sqlite:./data/sqlite.db');
	$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
	$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
	exit('Connection failed：'.$e->getMessage());
}

// search
$sql = "SELECT ft.publish_id, ft.display_name, ft.extension FROM content ct ";
$sql .= " INNER JOIN file_table ft ON ";
$sql .= " EXISTS(SELECT 1 FROM image_group_list igl WHERE ct.image_group = igl.group_id AND ft.upload_id = igl.upload_id) OR ";
$sql .= " EXISTS(SELECT 1 FROM content_image ci WHERE ct.view_id = ci.view_id AND ft.upload_id = ci.upload_id) ";
$sql .= " WHERE ct.view_publish_id = :id AND ft.path_type = 0 ";
$stmt = $pdo->prepare($sql);
$stmt->bindParam(":id", $id, PDO::PARAM_STR);
$stmt->execute();
$res = $stmt->fetchAll();
if(count($res) == 0){
	echo json_encode(array("error"=>"image_group was not found."));
	return;
}

echo json_encode($res);
return;

?>