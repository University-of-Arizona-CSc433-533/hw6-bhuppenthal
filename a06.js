var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');

var input = document.getElementById("load_image");
input.addEventListener("change", readImage);

var gamma_val;
var gamma = document.getElementById('gammaID');//Slider for cam position
gamma.addEventListener('change', function (e) {
    gamma_val = gamma.value;
    console.log('gamma:', gamma_val);
    renderImage();
});

var hdr_image;
var corrected_img;

function readImage() {
    console.log(input.files[0]);

    doneLoading = false;

    var file = input.files[0];
    var reader = new FileReader();

    reader.onload = (function(file) {
        return function(e) {
            var file_data = this.result;
            hdr_image = parseHdr(file_data);
            console.log(hdr_image);

            canvas.width = hdr_image.shape[0];
            canvas.height = hdr_image.shape[1];
        }
    })(file);

    reader.onloadend = () => renderImage();

    reader.readAsArrayBuffer(file);
}

// Given a new gamma value, recalculate everything.
function renderImage() {
    console.log('rendering!');
    let width = hdr_image.shape[0];
    let height = hdr_image.shape[1];
    canvas.width = width;
    canvas.height = height;
    let rgb_values = new Uint8ClampedArray(4*width*height);

    for(var offset=0; offset<hdr_image.data.length; offset += 4) {
        let r = hdr_image.data[offset];
        let g = hdr_image.data[offset+1];
        let b = hdr_image.data[offset+2];
        let a = hdr_image.data[offset+3];

        let L = (20.0*r + 40.0*g + b)/61.0;
        let scale = L**gamma_val / L;

        rgb_values[offset] = scale*r;
        rgb_values[offset+1] = scale*g;
        rgb_values[offset+2] = scale*b;
        rgb_values[offset+3] = 255;
    }

    console.log(rgb_values);

    // make a new image data and write that to the canvas.
    corrected_img = new ImageData(rgb_values, width, height);
    ctx.putImageData(corrected_img, 0, 0);

}