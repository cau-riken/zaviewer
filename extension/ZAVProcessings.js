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
     * 
     * Processors may optionally expose :
     * - some input size constraints, in the form {width: XX, height: YY, constraint: "fixed"|"ratio"|"none" },
     *      when constraint="none", or unspecified, the input image dimensions will be limited to specified number of pixels, or integer multiples of those values.
     *      when constraint="ratio", width and height values will correspond to same integer multiple of respective specified values.
     *      when constraint="fixed", width and height values will equal the respective specified values.
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
        // Processor using ONNX (see https://github.com/microsoft/onnxruntime/tree/master/js/)
        {
            name: "FNST Udnie (onnx)",

            //Fast Neural Style Transfer models work on 224x224 RGB images
            inputSize: { width: 224, height: 224, constraint: "fixed" },


            processImageData: function (imageData) {
                // initialize ONNX with a pre-trained model
                // (local copy of model provided at https://github.com/onnx/models/tree/main/vision/style_transfer/fast_neural_style)

                const width = imageData.width;
                const height = imageData.height;

                return (

                    ort.InferenceSession.create(
                        "ext/models/onnx/udnie-9.onnx",
                        {
                            //NOTE: webgl execution seems not to be supported for now (for these models only?) 
                            //executionProviders: ["webgl"],
                            executionProviders: ["wasm"],
                        })
                        .then(
                            (session) => {

                                /* NOTE: 
                                In the ImageData, RGBA pixels components are stored following a row-major layout :
                                  in a single dimension array, red, green, blue and alpha components of each pixel are located at consecutive indices.

                                The Fast Neural Style Transfer models expects RGB pixels components stored following a column-major layout:
                                  in a single dimension array, red components of pixel 1 to pixel N at consecutive indices, followed by green components, and finally blue ones.
                                */

                                const feeds = {
                                    input1: new ort.Tensor(
                                        'float32',
                                        modfn.imageDataPixs2FnstPixs(imageData.data),
                                        [1, 3, width, height]
                                    )
                                };
                                return session.run(feeds);
                            }
                        ).then(
                            (results) => {

                                //The Fast Neural Style Transfer model outputs a float32 array of same height and width as the input image.
                                const rgba = modfn.fnstPixs2ImageDataPixs(results.output1.data);
                                return new ImageData(rgba, width, height)
                            }
                        )

                );

            }

        }
    );

    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    addProcessor(
        // Processor based on UNET from ml5.js
        {
            name: "UNET /Face 128px (ml5)",

            inputSize: { width: 128, height: 128, constraint: "fixed" },

            processImageData: function (imageData) {
                // initialize a UNET method with a pre-trained model
                // (local copy of default model, https://github.com/zaidalyafeai/HostedModels)
                const options = {
                    modelPath: "ext/models/unet-128/model.json"
                }
                return (
                    ml5.uNet("", options).ready
                        .then(uNetModel => {
                            console.debug("UNET: Model Loaded!");
                            //prepare canvas from clipped image data
                            return {
                                model: uNetModel,
                                canvas: modfn.imageDataToCanvas(imageData)
                            };
                        })
                        .then((params) => {
                            console.debug("UNET: Image prepared!");

                            // Apply UNET segmentation
                            return params.model.segment(params.canvas);
                        })
                        .then(result => {
                            console.debug("UNET: segmentation done!");

                            //return new ImageData(result.raw.featureMask, 128, 128);
                            //return new ImageData(result.raw.backgroundMask, 128, 128);
                            // UNET image is 128x128
                            return new ImageData(result.segmentation, 128, 128);
                        })
                );
            }
        }
    );


    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    addProcessor(
        // Processor based on Pix2Pix from ml5.js - https://learn.ml5js.org/#/reference/pix2pix
        {
            name: "pix2pix /Pikachu 256px (ml5)",

            inputSize: { width: 256, height: 256, constraint: "ratio" },

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



    modfn.nbProcessors = () => processors.length;

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
                //Beware: image created from blob can't be (directly) downloaded due to CSP (see https://github.com/w3c/FileAPI/issues/142 and related)
                tmpCanvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const imageObj = new Image();
                    imageObj.onload = () => {
                        // no longer need to read the blob so it's revoked
                        URL.revokeObjectURL(url);
                        resolve(imageObj);
                    }
                    imageObj.onerror = (event) => {
                        const message = "Error when converting processor result image";
                        console.error(message, event);
                        reject(message);
                    };
                    imageObj.src = url;
                });

            } catch (msg) {
                reject(msg);
            }
        });
    };

    const RGBA_BytesPerPx = 4;
    const RGB_BytesPerPx = 3;

    //convert a row-major ordered UInt8 array of RGBA pixel components 
    //  into  a column-major ordered Float32 array of RGB pixel components
    modfn.imageDataPixs2FnstPixs = (inData) => {
        const inLen = inData.length;
        const nbPixels = Math.ceil(inLen / RGBA_BytesPerPx);
        const dblPixels = 2 * nbPixels;
        const outLen = nbPixels * RGB_BytesPerPx;
        const outData = new Float32Array(outLen);
        let oPix = 0;
        for (let iPix = 0; iPix < inLen; iPix += RGBA_BytesPerPx) {
            outData[oPix] = inData[iPix]; // Red
            outData[nbPixels + oPix] = inData[iPix + 1]; // Green
            outData[dblPixels + oPix] = inData[iPix + 2]; // Blue
            //drop Alpha
            oPix += 1;
        }
        return outData;
    }

    //convert a column-major ordered Float32 array of RGB pixel components  
    //  into  a row-major ordered UInt8 array of RGBA pixel components
    modfn.fnstPixs2ImageDataPixs = (inData) => {
        const inLen = inData.length;
        const nbPixels = Math.ceil(inLen / RGB_BytesPerPx);
        const dblPixels = 2 * nbPixels;

        const outLen = nbPixels * RGBA_BytesPerPx;
        const outData = new Uint8ClampedArray(outLen);
        let iPix = 0;
        for (let oPix = 0; oPix < outLen; oPix += RGBA_BytesPerPx) {
            outData[oPix] = Math.round(inData[iPix]); // Red
            outData[oPix + 1] = Math.round(inData[nbPixels + iPix]); // Green
            outData[oPix + 2] = Math.round(inData[dblPixels + iPix]); // Blue
            outData[oPix + 3] = 255; //Alpha
            iPix += 1;
        }
        return outData;
    }


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

