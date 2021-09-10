<?php

/** Basic WebService for retrieval & update of Region SVG files  */

//base folder to region SVG documents (specific set used in edit mode) 
define("SVGEditBaseFolder",  $_SERVER['DOCUMENT_ROOT'] . "/data/SVGEdit");

define("AXIAL",     1);
define("CORONAL",   2);
define("SAGITTAL",  3);

define('SVGnsURI', 'http://www.w3.org/2000/svg');
define('BMINDSnsURI', 'https://www.brainminds.riken.jp/Atlas');

$PLANE_LABEL = [AXIAL => 'axial', CORONAL => 'coronal', SAGITTAL => 'sagittal'];

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, POST, OPTIONS');
header('Access-Control-Max-Age: 1000');
header('Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token, Authorization');


$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestMethodArray = array();
$requestMethodArray = $_REQUEST;

//Checking input parameters
$datasetId = isset($requestMethodArray['dataset']) ? $requestMethodArray['dataset'] : null;

$planeId = isset($requestMethodArray['plane']) ? $requestMethodArray['plane'] : null;
if ($planeId == null) {
    if ($datasetId) {
        //plane must be specified if dataset was specified
        http_response_code(400);
        echo json_encode(array("message" => 'Missing plane code'));
        exit;
    }
} else if (!is_int($planeId + 0)) {
    http_response_code(400);
    echo json_encode(array("message" => 'Invalid plane code'));
    exit;
} else {
    $planeId = intval($planeId);
    if (AXIAL != $planeId && CORONAL != $planeId && SAGITTAL != $planeId) {
        http_response_code(400);
        echo json_encode(array("message" => 'Unknown plane code'));
        exit;
    }
}

$sliceNum = isset($requestMethodArray['slice']) ?  $requestMethodArray['slice'] : null;
if ($sliceNum == null || !is_int($sliceNum + 0)) {
    http_response_code(400);
    echo json_encode(array("message" => 'Missing or invalid slice number'));
    exit;
} else {
    $sliceNum = intval($sliceNum);
}



$basename = 'AtlasReg_' . $sliceNum;
$suffix = '.svg';

// full path to SVG filecorresponding to specified parameters 
$folderpath = SVGEditBaseFolder . ($datasetId ? '/' . $datasetId : '') . ($planeId ? '/' . $PLANE_LABEL[$planeId] : '');
$fullpath = $folderpath . '/' . $basename . $suffix;

if ($requestMethod === "GET") {
    // send the SVG file 
    if (file_exists($fullpath)) {

        header('Content-Type: image/svg+xml');
        header("Content-Length: " . filesize($fullpath));
        readfile($fullpath);
        exit;
    } else {
        //invalid parameters
        echo json_encode(array("message" => 'SVG file not found'));
        http_response_code(404);
        exit;
    }
} else if ($requestMethod === "POST") {
    $request_body = file_get_contents('php://input');

    // payload contains image dimensions for which SVG is created
    $data = json_decode($request_body);
    $width = $data->{'width'};
    $height = $data->{'height'};

    if ($width && is_int($width + 0) && $height && is_int($height + 0)) {

        $SVGnsURI = SVGnsURI;
        $BMINDSnsURI = BMINDSnsURI;

        //create a SVG file with just the background and no region
        $svgStr = <<<SVGLIT
<svg xmlns="$SVGnsURI" xmlns:bma="$BMINDSnsURI" width="$width" height="$height">
  <rect width="$width" height="$height" style="fill:rgb(0,0,0);"/>
  <g transform="scale(1.0)">
    <path id="background" style="fill:#00000000;stroke:#00000000;stroke-width:0;stroke-antialiasing:false" d="M 0 0 L 0 $height $width $height $width 0Z"/>
  </g>
</svg>
SVGLIT;

        // save a backup copy of the previous version of the SVG file (if any)
        if (!backupCurrentSVG($fullpath, $folderpath, $basename, $suffix)) {
            echo json_encode(array("message" => 'Failed to backup previous version of SVG'));
            http_response_code(500);
            exit;
        } else {

            $domSVG = new DomDocument();
            $domSVG->loadXML($svgStr);
            if ($domSVG->save($fullpath)) {
                http_response_code(201);
                echo json_encode(array("message" => 'SVG successfully created'));
                exit;
            } else {
                echo json_encode(array("message" => 'Failed to create new SVG'));
                http_response_code(500);
                exit;
            }
        }
    } else {
        http_response_code(400);
        echo json_encode(array("message" => 'Invalid or unspecified dimensions'));
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
        if (!backupCurrentSVG($fullpath, $folderpath, $basename, $suffix)) {
            //$err =error_get_last( );
            //echo json_encode(array("message" => 'Failed to backup previous version of SVG ' . $err["message"]));
            echo json_encode(array("message" => 'Failed to backup previous version of SVG '));
            http_response_code(500);
            exit;
        } else {

            // load source SVG file to apply changes
            $domSVG = new DomDocument();
            $domSVG->load($fullpath);
            $SVGns = $domSVG->documentElement->namespaceURI;

            //locate the edited path in the source SVG document 
            $xpath = new DOMXPath($domSVG);
            $xpath->registerNamespace("svg", $SVGns);

            //load Path from the paylod
            $newPathDom = new DomDocument();
            //suppress warnings when loading path including custom namespace attributes
            $newPathDom->loadXML($data->{'pathSVG'}, LIBXML_NOERROR | LIBXML_NOWARNING);
            $editedPath = $newPathDom->getElementsByTagName('path')->item(0);
            if ($editedPath) {

                $mode = $data->{'mode'};
                //create region mode
                if ($mode && $mode == 'cr') {

                    //append new Path in the first group below <svg>
                    $group = $xpath->query("//svg:g")->item(0);
                    $node = $domSVG->importNode($editedPath, true);
                    $group->appendChild($node);

                } 
                //update region mode
                elseif ($mode && $mode == 'up') {

                    $oldPath = $xpath->query("//svg:path[@id='$pathId']")->item(0);
                    if ($oldPath) {
                        //Transfer attributes which may have changed in the edited region
                        $oldPath->setAttribute('d', $editedPath->getAttribute('d'));
                        $oldPath->setAttribute('id', $editedPath->getAttribute('id'));
                        $oldPath->setAttribute('stroke', $editedPath->getAttribute('stroke'));
                        $oldPath->setAttribute('fill', $editedPath->getAttribute('fill'));
                        $oldPath->setAttribute('bma:regionId', $editedPath->getAttribute('bma:regionId'));
                    } else {
                        //NOT FOUND
                        echo json_encode(array("message" => 'Edited region not found in SVG.'));
                        http_response_code(404);
                        exit;
                    }
                }

                // save modified SVG
                if ($domSVG->save($fullpath)) {
                    echo json_encode(array("message" => 'saved!'));
                    http_response_code(200);
                    exit;
                } else {
                    echo json_encode(array("message" => 'Failed to save new version of SVG'));
                    http_response_code(500);
                    exit;
                }
            } else {
                // invalid input payload
                //BAD REQUEST
                echo json_encode(array("message" => 'Invalid editor payload.'));
                http_response_code(400);
                exit;
            }
        }
    }
}

function backupCurrentSVG($fullpath, $folderpath, $basename, $suffix)
{
    if (file_exists($fullpath)) {
        $currentDate = new DateTime();
        $archivedPath = $folderpath . '/' . 'ARCHIVE' . '/' . $basename . '_' . $currentDate->format('c') . $suffix;
        return copy($fullpath, $archivedPath);
    } else {
        return true;
    }
}
