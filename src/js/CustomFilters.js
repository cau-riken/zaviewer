const CustomFilters = {

    INTENSITYALPHA: function (hue) {
        return function (context, callback) {
            const clearChannel= [[0, 2], [1, 2], [0, 1], [2], [1], [0],];
            var imgData = context.getImageData(
                0, 0, context.canvas.width, context.canvas.height);
            var pixels = imgData.data;
            for (var i = 0; i < pixels.length; i += 4) {
                var r = pixels[i];
                var g = pixels[i + 1];
                var b = pixels[i + 2];
                var v = (r + g + b) / 3;
                pixels[i + 3] = v;

                clearChannel[hue % clearChannel.length].forEach(idx => pixels[i+ idx] = 0);
            }
            context.putImageData(imgData, 0, 0);
            callback();
        };
    },
}

export default CustomFilters;