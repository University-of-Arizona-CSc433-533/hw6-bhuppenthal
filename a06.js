var canvasB = document.getElementById('canvasB');
var ctxB = canvasB.getContext('2d');

var canvasC = document.getElementById('canvasC');
var ctxC = canvasC.getContext('2d');

var input = document.getElementById("load_image");
input.addEventListener("change", readImage);

var gamma_elem = document.getElementById('gammaID');
var gamma = gamma_elem.value;
gamma_elem.addEventListener('change', function (e) {
    gamma = parseFloat(gamma_elem.value);
    renderBasicGammaCorrection();
});

var c_elem = document.getElementById('contrastID');
var c = c_elem.value;
c_elem.addEventListener('change', function (e) {
    c = parseFloat(c_elem.value);
    console.log(`c: ${c}`);
    // Because the lowPass and highPass filters only need to be calculated once,
    // skip when the contrast threshold changes.
    renderBilateralFilters();
})

var hdr_image;
var basic_gamma_img;
var luminanceArray;
var luminancePrimeArray; // this is the only one that updates with changes to c.
var lowPassArray;
var highPassArray;

function readImage() {
    doneLoading = false;

    var file = input.files[0];
    var reader = new FileReader();

    reader.onload = (function(file) {
        return function(e) {
            var file_data = this.result;
            let loaded_image = parseHdr(file_data);

            hdr_image = new HDRWrapper(loaded_image.shape[0], loaded_image.shape[1], array=loaded_image.data);
        }
    })(file);

    reader.onloadend = () => renderImage();

    reader.readAsArrayBuffer(file);
}

function renderImage() {
    // Called after a file is loaded and read into hdr_image.
    renderBasicGammaCorrection();
    calculateLuminance();
    calculateLowPass();
    calculateHighPass();
    renderBilateralFilters();
}

function renderBasicGammaCorrection() {
    // For Part B. The only element of interest is the final line in the nested for loops,
    // as well as the ImageData creation and write to the canvas.
    let width = hdr_image.width;
    let height = hdr_image.height;

    canvasB.width = width;
    canvasB.height = height;

    var rgb_values = new Uint8Wrapper(width, height);

    for(var i=0; i < height; i++){
        for(var j=0; j < width; j++){
            [r, g, b, a] = hdr_image.getIdx(i, j);

            let L = (20.0*r + 40.0*g + b)/61.0;
            let scale = L**gamma / L;

            rgb_values.setIdx(i, j, [255*scale*r, 255*scale*g, 255*scale*b, 255]);
        }
    }

    basic_gamma_img = new ImageData(rgb_values.array, width, height);
    ctxB.putImageData(basic_gamma_img, 0, 0);
}

function renderBilateralFilters() {
    gammaCorrect();
    finalizeImage();
}

function calculateLuminance() {
    // Create an array containing the luminance values of the image.
    // This only needs to be calculated once, thus we store as a global variable.
    let width = hdr_image.width;
    let height = hdr_image.height;

    luminanceArray = new LuminanceWrapper(width, height);

    for(var i=0; i < height; i++){
        for(var j=0; j < width; j++){
            [r, g, b, a] = hdr_image.getIdx(i, j);

            let L = (20.0*r + 40.0*g + b)/61.0;
            luminanceArray.setIdx(i, j, L);
        }
    }
}

function clamp(val){
    // Clamps a value to be between 0 and 1 
    return Math.max(0, Math.min(1, val));
}

function spatialGaussian(oldx, oldy, newx, newy){
    // Calculates the spatial portion of the convolution.
    d = Math.sqrt(Math.pow((oldx - newx), 2) + Math.pow((oldy - newy), 2));
    return  Math.exp(-clamp(Math.pow(d, 2)));
}

function intensityGaussian(xold, outer){
    // Calculates the intensity portion of the convolution.
    // Using exp(-clamp((log(Lold) - log(Louter)^2))).
    d_2 = Math.pow(Math.log(xold) - Math.log(outer), 2);
    return Math.exp(-clamp(d_2));
}

function calculateLowPass() {
    // Perform a bilateral filter on the luminance array.
    // to produce the lowPassArray. Notably, this only modifies
    // the interior pixels that actually have the necessary amount
    // of neighbors. 
    console.log('starting low pass...');

    const width = luminanceArray.width;
    const height = luminanceArray.height;

    lowPassArray = new LuminanceWrapper(width-20, height-20);

    // Double for loop over the interior. Using a 21x21 filter.
    //
    // Note that because we're cutting off the image, the dimensions of the new array are actually smaller. 
    // We shave 20 off of the width and height total.

    for(col = 10; col<width-10; col++){
        for(row = 10; row<height-10; row++){
            
            let pixelLowPass = 0.0;

            for(leftShift = -10; leftShift <= 10; leftShift++){
                for(upShift = -10; upShift <= 10; upShift++){
                    let logLuminance = Math.log(luminanceArray.getIdx(row,col));
                    // Calculate the contribution of the gaussian in space. 
                    // spatialContribution = spatialGaussian(col,row,col+upShift,row+leftShift);
                    let spatialContribution = 1;
                    // Calculate the contribution of the gaussian w.r.t intensity. 
                    let intensityContribution = intensityGaussian(luminanceArray.getIdx(row,col), luminanceArray.getIdx(row+leftShift,col+upShift));

                    // Add to low pass value for this pixel.
                    pixelLowPass += spatialContribution * intensityContribution * logLuminance;
                }
            }
            lowPassArray.setIdx(row-10, col-10, pixelLowPass);
        }
    }
    console.log('finished low pass!');
}

function calculateHighPass(){
    // Given a low pass array and original luminance create the high pass array.
    const width = lowPassArray.width;
    const height = lowPassArray.height;

    highPassArray = new LuminanceWrapper(width, height);

    // Keep in mind that the highPass array is missing 10 rows on the top and bottom and 10 rows on the left and right.
    for(col = 0; col < width; col++){
        for(row = 0; row < height; row++){
            highPassArray.setIdx(row, col, Math.log(luminanceArray.getIdx(row+10,col+10)) - lowPassArray.getIdx(row, col));
        }              
    }
}

function gammaCorrect(){
    const width = lowPassArray.width;
    const height = lowPassArray.height;
    
    // Parameter used for gamma, gammaParam in [5,100]
    let max = lowPassArray.getIdx(0,0);
    let min = lowPassArray.getIdx(0,0);
    // Determine the max of the low pass array.
    // Determine the min of the low pass array.
    for(col = 0; col < width; col++){
        for(row = 0; row < height; row++){
        max = (max < lowPassArray.getIdx(row,col)) ? lowPassArray.getIdx(row,col) : max;
        min = (min > lowPassArray.getIdx(row,col)) ? lowPassArray.getIdx(row,col) : min;
        }
    }

    // Calculate gamma.
    const gamma = Math.log(c)/(max-min); 

    luminancePrimeArray = new LuminanceWrapper(width, height);

    for(col = 0; col < width; col++){
        for(row = 0; row < height; row++){
            let logLuminancePrime = gamma*lowPassArray.getIdx(row, col) + highPassArray.getIdx(row, col);
            luminancePrimeArray.setIdx(row, col, Math.exp(logLuminancePrime));
        }
    }
}

function finalizeImage(){

    // Calculate the new RGB in the image 
    // by multiplying the original image RGB by the scale. 
    const width = lowPassArray.width;
    const height = lowPassArray.height;

    var rgb_values = new Uint8Wrapper(width, height);

    // INFO: the hdr_image and luminance arrays are the larger size
    // the luminance prime, low pass, and high pass arrays are the reduced size

    for(col = 0; col < width; col++){
        for(row = 0; row < height; row++){
            [r, g, b, a] = hdr_image.getIdx(row + 10, col + 10);

            let L = luminanceArray.getIdx(row + 10, col + 10);
            let LPrime = luminancePrimeArray.getIdx(row, col);
            let scale = LPrime / L;

            rgb_values.setIdx(row, col, [255*scale*r, 255*scale*g, 255*scale*b, 255]);
        }
    }

    canvasC.width = width;
    canvasC.height = height;
    let bilateralFilterImage = new ImageData(rgb_values.array, width, height);
    ctxC.putImageData(bilateralFilterImage, 0, 0);
}