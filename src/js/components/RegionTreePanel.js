import React from 'react';

import SplitterLayout from 'react-splitter-layout';

import Utils from '../Utils.js';
import OSDManager from '../OSDManager.js'


class RegionTreePanel extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <SplitterLayout vertical primaryIndex={1} secondaryMinSize={100} secondaryInitialSize={100}>
                <div id="tree_search" style={{ height: "100%", width: "100%" }}>
                    <div id="region_search_label">Search for a region:</div>
                    <div>
                        {/*<input autocomplete="off" id="region_search_form" value="Region search" type="text" />*/}
                        <input autocomplete="off" id="region_search_form" type="text" />
                    </div>
                </div>
                <div style={{ height: "100%", width: "100%" }}>
                    <div id="jstree" ></div>
                </div>
            </SplitterLayout>
        );
    }

    componentDidUpdate(prevProps) {
        if (this.props.config && !prevProps.config) {
            this.createTree(this.props.config);
        }
    }

    createTree(config) {
        const that = this;
        const urlPath = config.treeUrlPath;

        if (!urlPath || urlPath == null || urlPath.lenght == 0) {
            return;
        }
        // 6 create an instance when the DOM is ready
        $('#jstree').jstree({
            "core": {
                "themes": { "icons": false },
                "data": {
                    "url": Utils.makePath(config.PUBLISH_PATH, urlPath, "/tree.html"),
                    async: true
                }
            },
            "search": {
                "show_only_matches": true
            },
            "plugins": ["search"]
        });

        var to = false;
        $('#region_search_form').keyup(function () {
            if (to) { clearTimeout(to); }
            to = setTimeout(function () {
                var v = $('#region_search_form').val();
                $('#jstree').jstree(true).search(v);
                $('#jstree').scrollLeft(0);
            }, 250);
        });

        var json_nodeList = $('#jstree').jstree().get_json('#', { 'flat': true });
        for (var i = 0; i < json_nodeList.length; i++) {
            if (json_nodeList[i]['li_attr']['data-regionexists'] == '0') {
                //console.log("tryng to disable");
                $('#jstree').jstree().disable_node(json_nodeList[i]['id']);
            }
        }


        // 7 bind to events triggered on the tree
        $('#jstree').on("changed.jstree", function (e, data) {
            //console.log("user interaction");
            //remove selection on all elements
            OSDManager.unselectRegions();

            if (data.action == "deselect_all") {
                //console.log("deselect_all");
            } else if (data.action == "select_node") {
                //console.log("select_node");
                var node = $('#jstree').jstree(true).get_node(data.selected[0]);
                //handle the case when there are children
                //console.log("testing for children:"+data.selected[0]+"children"+node.children.length)
                if (node.children.length > 0) {
                    var nameList = [];
                    that.getAllChildrenTexts(data, data.selected[0].trim(), nameList);
                    OSDManager.selectRegions(nameList);

                } else {
                    //console.log("Has no children");
                    OSDManager.selectRegion(data.selected[0].trim());
                }

                //$('#current_region').html(data.selected[0].trim());
            } else {
                //console.log("else");
            }

        });

    }

    getAllChildrenTexts(treeObj, nodeId, result) {
        var node = $('#jstree').jstree(true).get_node(nodeId);
        result.push(node.id);
        if (node.children) {
            for (var i = 0; i < node.children.length; i++) {
                this.getAllChildrenTexts(treeObj, node.children[i], result);
            }
        }
    }



}



export default RegionTreePanel;