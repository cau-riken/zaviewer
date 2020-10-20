<?php

/** Basic WebService for retrieval & update of Region SVG files  */

define("SVGEditBaseFolder",     "../data/SVGEdit");

define("AXIAL",     1);
define("CORONAL",   2);
define("SAGITTAL",  3);

define('SVGnsURI', 'http://www.w3.org/2000/svg');
define('BMINDSnsURI', 'https://www.brainminds.riken.jp/Atlas');

$PLANE_LABEL = [AXIAL => 'axial', CORONAL => 'coronal', SAGITTAL => 'sagittal'];

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Max-Age: 1000');
header('Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token, Authorization');


$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestMethodArray = array();
$requestMethodArray = $_REQUEST;

//Checking input parameters
$datasetId = isset($requestMethodArray['dataset']) ? $requestMethodArray['dataset'] : null;
if (!$datasetId) {
    http_response_code(400);
    exit;
}

$planeId = isset($requestMethodArray['plane']) ? $requestMethodArray['plane'] : null;
if ($planeId==null || !is_int($planeId + 0)) {
    http_response_code(400);
    exit;
} else {
    $planeId = intval($planeId);
    if (AXIAL != $planeId && CORONAL != $planeId && SAGITTAL != $planeId) {
        http_response_code(400);
        exit;
    }
}

$sliceNum = isset($requestMethodArray['slice']) ?  $requestMethodArray['slice'] : null;
if ($sliceNum==null || !is_int($sliceNum + 0)) {
    http_response_code(400);
    exit;
} else {
    $sliceNum = intval($sliceNum);
}



$basename = 'AtlasReg_' . $sliceNum;
$suffix = '.svg';

// full path to SVG filecorresponding to specified parameters 
$fullpath = SVGEditBaseFolder . '/' . $datasetId . '/' . $PLANE_LABEL[$planeId] . '/' . $basename . $suffix;

if ($requestMethod === "GET") {
    // send the SVG file 
    if (file_exists($fullpath)) {

        header('Content-Type: image/svg+xml');
        header("Content-Length: " . filesize($fullpath));
        readfile($fullpath);
        exit;

    } else {
        //invalid parameters
        http_response_code(404);
        exit;
    }
} else if ($requestMethod === "PUT") {

    // update the source SVG file with the modified region
    $request_body = file_get_contents('php://input');

    // payload contains exported SVG path element
    $data = json_decode($request_body);
    $pathId = $data->{'pathId'};
    if ($pathId) {

        // save a backup copy of the previous version of the SVG file
        $currentDate = new DateTime();
        $archivedPath = SVGEditBaseFolder . '/' . $datasetId . '/' . 'coronal' . '/' . 'ARCHIVE' . '/' . $basename . '_' . $currentDate->format('c') . $suffix;
        rename($fullpath, $archivedPath);

        // load source SVG file to apply changes
        $domSVG = new DomDocument();
        $domSVG->load($archivedPath);
        $SVGns = $domSVG->documentElement->namespaceURI;

        //locate the edited path in the source SVG document 
        $xpath = new DOMXPath($domSVG);
        $xpath->registerNamespace("svg", $SVGns);
        $oldPath = $xpath->query("//svg:path[@id='$pathId']")->item(0);

        if ($oldPath) {

            $newPathDom = new DomDocument();
            //suppress warnings when loading path including custom namespace attributes
            $newPathDom->loadXML($data->{'pathSVG'}, LIBXML_NOERROR | LIBXML_NOWARNING);
            $editedPath = $newPathDom->getElementsByTagName('path')->item(0);
            if ($editedPath) {

                // since the editing process just changed the 'd' attribute, let's simply replace it
                $oldPath->setAttribute('d', $editedPath->getAttribute('d'));

                // save modified SVG
                $domSVG->save($fullpath);

                echo json_encode(array("message" => 'saved!'));
                exit;
            } else {
                // invalid input payload
                //BAD REQUEST
                http_response_code(400);
            }
        } else {
            //NOT FOUND
            http_response_code(404);
            exit;
        }
    }
}
