/** 
* Custom Processings for ZAViewer
*/
ZAVProcessings = function () { };

(function (modfn) {

    'use strict';

    const processors = [];
    const addProcessor = (proc) => processors.push(proc);



    //=========================================================================
    // Add your processors' code here.
    /**
     * Declared Processors must minimally expose :
     * - a name property, 
     *      the readable name of the process that is displayed in the UI.
     * - a processImageData(imageData) function, 
     *      that takes an ImageData object as single parameter (https://developer.mozilla.org/en-US/docs/Web/API/ImageData)
     *      and returns a Promise which resolves as an Image or an ImageData object
     */
    
    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    addProcessor(
        // example : image color inversion
        {

            name: "invert image",

            processImageDataSync: (imageData) => {
                for (let i = 0; i < imageData.data.length; i += 4) {
                    for (let c = 0; c < 3; c += 1) {
                        imageData.data[i + c] = 255 - imageData.data[i + c];
                    }
                }
                return imageData;
            },

            processImageData: function (imageData) {
                return new Promise(
                    (resolve, reject) =>
                        resolve(this.processImageDataSync(imageData))
                );
            },
        }
    );

    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    addProcessor(
        // Processor based on Pix2Pix from ml5.js - https://learn.ml5js.org/#/reference/pix2pix
        {
            name: "pix2pix /Pikachu 256px",

            processImageData: function (imageData) {
                return (
                    // initialize a pix2pix method with a pre-trained model
                    ml5.pix2pix("ext/models/edges2pikachu.pict")
                        .then(pix2pixModel => {
                            console.debug("Pix2pix: Model Loaded!");

                            // The Edges2Pikachu model was trained with 256x256 pixels images, so input images must be this size or integer multiple of it
                            const PixelPerBlock = 256;
                            const nbBlocks = Math.max(
                                Math.min(
                                    Math.floor(imageData.width / PixelPerBlock),
                                    Math.floor(imageData.height / PixelPerBlock)
                                ), 1
                            );

                            //prepare canvas from clipped image data
                            return {
                                model: pix2pixModel,
                                canvas: modfn.imageDataToCanvas(imageData, { width: nbBlocks * PixelPerBlock, height: nbBlocks * PixelPerBlock })
                            };
                        })
                        .then((params) => {
                            console.debug("Pix2pix: Image prepared!");
                            // Apply pix2pix transformation
                            return params.model.transfer(params.canvas);
                        })
                        .then(result => {
                            console.debug("Pix2pix: Transfer done!");
                            // Create an image based on the result
                            const imageObj = new Image();
                            const imgPromise = new Promise(
                                (resolve, reject) => {
                                    imageObj.onload = () => {
                                        console.debug("Pix2pix: Result exported!");
                                        resolve(imageObj);
                                    }
                                }
                            );
                            //trigger image loading
                            imageObj.src = result.src;
                            return imgPromise;
                        })
                );
            }
        }
    );
    //=========================================================================



    modfn.hasProcessors = () => processors.length;

    modfn.getProcessors = () => processors;


    modfn.imageDataToCanvas = (imageData, size) => {
        // create temp canvas
        const tmpCanvas = document.createElement("canvas");
        const width = size && size.width ? size.width : imageData.width;
        const height = size && size.height ? size.height : imageData.height;
        tmpCanvas.setAttribute("width", width);
        tmpCanvas.setAttribute("height", height);
        // put image data into canvas
        const tmpContext = tmpCanvas.getContext("2d");
        tmpContext.putImageData(imageData, 0, 0);
        return tmpCanvas;
    };

    modfn.imageDataToImage = (imageData) => {
        return new Promise((resolve, reject) => {
            try {
                const tmpCanvas = modfn.imageDataToCanvas(imageData);
                // extract canvas data into an image object
                const imageObj = new Image();
                //prepare to asynchronously draw result on top of layers, once image is created from canvas 
                imageObj.onload = () => resolve(imageObj);
                //create image from canvas 
                imageObj.src = tmpCanvas.toDataURL("image/png");

            } catch (msg) {
                reject(msg);
            }
        });
    };

}(ZAVProcessings));




// Universal Module Definition, supports CommonJS, AMD and simple script tag
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // expose as amd module
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // expose as commonjs module
        module.exports = factory();
    } else {
        // expose as window.ZAVProcessings
        root.ZAVProcessings = factory();
    }
}(this, function () {
    return ZAVProcessings;
}));

