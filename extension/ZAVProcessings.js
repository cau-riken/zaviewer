/** 
* Custom Processings for ZAViewer
*/
ZAVProcessings = function () { };

(function ($) {

    'use strict';

    const processors = [];
    const addProcessor = (proc) => processors.push(proc);



    //=========================================================================
    // Add your processors' code here.

    addProcessor(
        // example : image color inversion
        {

            name: "invert image",

            processImageData: (imageData) => {
                for (let i = 0; i < imageData.data.length; i += 4) {
                    for (let c = 0; c < 3; c += 1) {
                        imageData.data[i + c] = 255 - imageData.data[i + c];
                    }
                }
                return imageData;
            }

        }
    );

    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    addProcessor(
        // example : non-operation
        {

            name: "NOp",

            processImageData: function (imageData) {
                return imageData;
            }

        }
    );
    //=========================================================================



    $.hasProcessors = () => processors.length;

    $.getProcessors = () => processors;

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

