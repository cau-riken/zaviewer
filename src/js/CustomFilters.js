const CustomFilters = {

    INTENSITYALPHA: function () {
        return function (context, callback) {
            var imgData = context.getImageData(
                0, 0, context.canvas.width, context.canvas.height);
            var pixels = imgData.data;
            for (var i = 0; i < pixels.length; i += 4) {
                var r = pixels[i];
                var g = pixels[i + 1];
                var b = pixels[i + 2];
                var v = (r + g + b) / 3;
                pixels[i + 3] = v;
                pixels[i] = pixels[i + 2] = 0;
            }
            context.putImageData(imgData, 0, 0);
            callback();
        };
    },
}

export default CustomFilters;