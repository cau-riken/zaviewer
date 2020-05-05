<?php

$id = "";
if(isset($_POST['id'])){
	$id = $_POST['id'];
}else{
	echo json_encode(array("error"=>"notfound"));
	return;
}
// create data dirs
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
$sql = "SELECT ct.*, ft1.publish_id as subview_upload_id, ft2.publish_id as svg_upload_id, ft3.publish_id as tree_upload_id FROM content ct ";
$sql .= " LEFT OUTER JOIN file_table ft1 ON ct.subview_image = ft1.upload_id ";
$sql .= " LEFT OUTER JOIN file_table ft2 ON ct.svg_file = ft2.upload_id ";
$sql .= " LEFT OUTER JOIN file_table ft3 ON ct.tree_view = ft3.upload_id ";
$sql .= " WHERE ct.view_publish_id = :id ";
$stmt = $pdo->prepare($sql);
$stmt->bindParam(":id", $id, PDO::PARAM_STR);
$stmt->execute();
$res = $stmt->fetchAll();
if(count($res) == 0){
	echo json_encode(array("error"=>"content was not found."));
	return;
}
$data = $res[0];

// create JSON
$json["data_root_path"] = $data["view_id"];
$json["subview"] = array(
	"foldername"=>$data["subview_upload_id"],
	"coronal_slide"=>100,
	"size"=>$data["subview_size"],
	"min"=>$data["subview_range_min"],
	"max"=>$data["subview_range_max"],
);
$json["delineations"] = $data["svg_upload_id"];
$json["tree"] = $data["tree_upload_id"];

$json["first_access"] = array(
	"slide"=>$data["first_slide"],
	"delineations"=>($data["init_deliniation"] == 1)?"show":"hide"
);
$json["matrix"] = $data["matrix_data"];
if (preg_match("/^\d+(\.\d+)?$/", $data["init_gamma"])) {
	$json["gamma"] = floatval($data["init_gamma"])*10;// return 10times
}
$json["bright"] = $data["init_bright"];
$json["image_size"] = $data["image_size"];
$json["slide_count"] = $data["slide_count"];
$json["slice_step"] = $data["slice_step"];

// ImageGroup
$sql = "SELECT * FROM image_group WHERE group_id = :id ";
$stmt = $pdo->prepare($sql);
$stmt->bindParam(":id", $data["image_group"], PDO::PARAM_STR);
$stmt->execute();
$res = $stmt->fetchAll();
/*if(count($res) == 0){
	echo json_encode(array("error"=>"image_group was not found."));
	return;
}*/
if(count($res) > 0){
	$imageGroup = $res[0];
	$json["group_name"] = $imageGroup["group_name"];
	$json["group_id"] = $imageGroup["group_id"];
}else{
	$json["group_name"] = "Content Images";
}

// ContentImage + FileTable
$sql = "SELECT ft.publish_id, ft.display_name, ft.extension, ci.initial_opacity FROM content_image ci ";
$sql .= "INNER JOIN file_table ft ON ci.upload_id = ft.upload_id WHERE ci.view_id = :id ORDER BY ci.sort_no;";
$stmt = $pdo->prepare($sql);
$stmt->bindParam(":id", $data["view_id"], PDO::PARAM_STR);
$stmt->execute();
$imageList = $stmt->fetchAll();
if(count($imageList) == 0){
	//echo json_encode(array("error"=>"content_image was not found."));
	//return;
}else{
	$imageData = array();
	foreach($imageList as $value){
		$imageData[$value["publish_id"]] = array(
			"metadata"=>$value["display_name"],
			"extension"=>$value["extension"],
			"opacity"=>$value["initial_opacity"]
		);
	}
	$json["data"] = $imageData;
}

echo json_encode($json);
return;
?>