
type HexColor = string


type ColorTable = Map<HexColor, string>;

class LabelMapper {

    private static LabelColorPattern = /^(?<ordnum>\d+)\s+(?<label>[^\s]+)\s+(?<r>\d+)\s+(?<g>\d+)\s+(?<b>\d+)(?:\s+(?<a>\d+))*/;

    static rgbToHexColor(rgb: number[]): HexColor {
        return "#" + rgb.map(v => v.toString(16)).map(h => (h.length == 1 ? "0" : "") + h).join("");
    }

    static parseColorTable(data: string): ColorTable {
        //parse color table

        return new Map<HexColor, string>(
            data
                .split("\n")
                .map(line => {
                    const matches = line.match(LabelMapper.LabelColorPattern);
                    if (matches) {
                        return matches.groups;
                    } else
                        return undefined;
                })
                .filter(ll => typeof ll != 'undefined')
                .map(ll => [LabelMapper.rgbToHexColor([parseInt(ll!.r), parseInt(ll!.g), parseInt(ll!.b)]), ll!.label])
        );

    }


    static initLabelMapper(
        viewer,
        layerDisplaySettings,
        color2labelMap: ColorTable,
        onClassFocused: (color: HexColor|undefined, label?: string) => void,
    ) {

        const labelMapper = new LabelMapper(
            viewer, layerDisplaySettings, color2labelMap, onClassFocused
        );

        return typeof labelMapper.mouseTracker != 'undefined';

    }

    private previousClassColor: string;
    private mouseTracker = undefined;

    private constructor(
        viewer,
        layerDisplaySettings,
        color2labelMap: ColorTable,
        onClassFocused: (color: HexColor|undefined, label?: string) => void,
    ) {

        const labelMapLayer = Object.values(layerDisplaySettings).find(l => l.isLabelMap);
        if (labelMapLayer && color2labelMap) {
            // (see https://github.com/openseadragon/openseadragon/issues/1471#issuecomment-391425270 )
            this.mouseTracker = new OpenSeadragon.MouseTracker({
                element: viewer.element,
                moveHandler: function (event) {
                    //find labelMap layer, if any 
                    const viewportPos = viewer.viewport.pointFromPixel(event.position);
                    const tiledImage = viewer.world.getItemAt(labelMapLayer.index);
                    if (tiledImage) {

                        const labelMapTile = LabelMapper.findLabelMapTile(viewer, layerDisplaySettings, labelMapLayer, tiledImage, viewportPos)
                        if (labelMapTile) {
                            const rgb = LabelMapper.getPointRGBLabel(labelMapTile, viewportPos);
                            if (rgb) {
                                const color = LabelMapper.rgbToHexColor(rgb);
                                
                                if (color != this.previousClassColor) {
                                    this.previousClassColor = color;
                                    const label = color2labelMap.get(color);
                                    if (label && onClassFocused) {
                                        onClassFocused(color, label);
                                    } else {
                                        onClassFocused(undefined, undefined);
                                        console.log("No label for Color:", color);
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

    }

    private static getPointRGBLabel = (labelMapTile, viewportPos) => {
        //points in the source tile 
        if (labelMapTile.bounds) {
            const tx = (viewportPos.x - labelMapTile.bounds.x) / labelMapTile.bounds.width * labelMapTile.sourceBounds.width;
            const ty = (viewportPos.y - labelMapTile.bounds.y) / labelMapTile.bounds.height * labelMapTile.sourceBounds.height;
            //get pixel color from cached tile
            const rc = labelMapTile.cacheImageRecord.getRenderedContext();
            const data = rc.getImageData(tx, ty, 1, 1).data;
            const rgb = [data[0], data[1], data[2]];
            return rgb;
        } else {
            return null;
        }
    };


    private static findLabelMapTile = (viewer, layerDisplaySettings, labelMapLayer, tiledImage, viewportPos) => {
        if (labelMapLayer.enabled && labelMapLayer.opacity > 0) {
            //if labelmap layer is visible, can get info directly from lastDrawn
            return tiledImage.lastDrawn.find(tile =>
                tile.bounds.containsPoint(viewportPos));

        } else {
            //labelmap layer is not visible, first need to find tiles level and coords

            const anyVisibleLayer = Object.values(layerDisplaySettings).find(l => l.enabled && l.opacity > 0);
            if (anyVisibleLayer) {

                //get current title level from lastdrawn on any enabled layer (see https://github.com/openseadragon/openseadragon/issues/1888#issuecomment-1282423960 )
                const coordinates = viewer.world.getItemAt(anyVisibleLayer.index).lastDrawn.map(item => {
                    const container = [];
                    container.push(parseInt(item["level"]));
                    return container;
                })

                const tileLevel = Math.max.apply(null, coordinates);

                // getTileAtPoint technique
                var viewportPosRect = new OpenSeadragon.Rect(viewportPos.x, viewportPos.y, 0, 0);
                var tileSourcePosRect = tiledImage._viewportToTiledImageRectangle(viewportPosRect);
                var tileSourcePos = tileSourcePosRect.getTopLeft();
                var source = tiledImage.source;
                if (tileSourcePos.x >= 0 && tileSourcePos.x <= 1 && tileSourcePos.y >= 0 &&
                    tileSourcePos.y <= 1 / source.aspectRatio) {

                    const tileCoord = source.getTileAtPoint(tileLevel, tileSourcePos);

                    //Since labelmap layers' tiles are always loaded, they can be retrieved from tileCache
                    const cacheKey = tiledImage.source.getTileUrl(tileLevel, tileCoord.x, tileCoord.y);
                    const imageRecord = tiledImage._tileCache.getImageRecord(cacheKey);
                    if (imageRecord && imageRecord._tiles && imageRecord._tiles.length > 0) {
                        const labelMapTile = imageRecord._tiles[0];
                        return labelMapTile;
                    }
                }

            }
        }
    };


}


export default LabelMapper;