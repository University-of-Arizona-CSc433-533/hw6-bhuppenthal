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

    // INFO: any time the contrast threshold is changed, will call the rendering method.
    // This is why I have the hdr_image stored as a global variable.
    renderBilateralFilters();
})

var hdr_image;
var basic_gamma_img;

function readImage() {
    doneLoading = false;

    var file = input.files[0];
    var reader = new FileReader();

    reader.onload = (function(file) {
        return function(e) {
            var file_data = this.result;
            let loaded_image = parseHdr(file_data);
            console.log(loaded_image);

            hdr_image = new FloatArrayWrapper(loaded_image.shape[0], loaded_image.shape[1], array=loaded_image.data);
            console.log(hdr_image);

        }
    })(file);

    reader.onloadend = () => renderImage();

    reader.readAsArrayBuffer(file);
}

function renderImage() {
    // Called after a file is loaded and read into hdr_image.
    renderBasicGammaCorrection();
    renderBilateralFilters();
}

function renderBasicGammaCorrection() {
    // For Part B. The only element of interest is the final line in the nested for loops,
    // as well as the ImageData creation and write to the canvas.
    console.log(gamma);
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
    // TODO main function for Part C logic.
    console.log('pass on bilateral filters');
}

function clamp(val){
    // Clamps a value to be between 0 and 1 
    return Math.max(Math.min(1,val),0);
}

function spatialGaussian(oldx, oldy, newx, newy){
    // Calculates the spatial portion of the convolution.

    // I am assuming this is gonna be exp(-d^2) where distance here is the literal distance between the points.
    // For now I am just going to return 1 though.
    distance = Math.pow(Math.pow((oldx-oldy),2)+Math.pow((newx,newy),2),0.5);
    
    return  Math.exp(-clamp(Math.pow(distance,2)));
}

function intensityGaussian(xold, outer){
    // Calculates the intensity portion of the convolution.
    // Using exp(-clamp((log(Lold) - log(Louter)^2))).
    return Math.exp(-(Math.pow(clamp(Math.log(xold) - Math.log(outer)),2)));
}

function calculateScaleFactor(luminanceArray, row, col){
    // Calculates k(x), the normalization constant. 

    let scaleFactor = 0;
    for(leftShift = -10; leftShift <= 10; leftShift++){
        for(upShift = -10; upShift <= 10; upShift++){
            // Calculate contribution from space.
            spatialContribution = spatialGaussian(luminanceArray.getIdx(row,col),luminanceArray.getIdx(row+leftShift,col+upShift));
            // Calculate contribution from luminance.
            intensityContribution = intensityGaussian(luminanceArray.getIdx(row,col),luminanceArray.getidx(row+leftShift,col+upShift));
            // Add to the total scale factor.
            scaleFactor += spatialContribution*intensityContribution;
        }
    }

    // Return the value that will be used to normalize.
    return scaleFactor;
}

function lowPass(luminanceArray) {
    // Perform a bilateral filter on the luminance array.
    // to produce the lowPassArray. Notably, this only modifies
    // the interior pixels that actually have the necessary amount
    // of neighbors. 

    // Get the luminance width 
    const width = luminanceArray.width;

    // Get the luminance height. 
    const height = luminanceArray.height;

    const lowPassArray = FloatArrayWrapper(width-20, height-20);

    // Double for loop over the interior. Using a 21x21 filter.
    //
    // Note that because we're cutting off the image, the dimensions of the new array are actually smaller. 
    // We shave 10 off of the width and height total.

    for(col = 10; col<width-10; col++){
        for(row = 10; row<height-10; row++){
            // Now loop over neighbors 10 to left and right,
            // and 10 up and down 
            lowPassArray.setIdx(row-10,col-10) = 0.0;

            for(leftShift = -10; leftShift <= 10; leftShift++){
                for(upShift = -10; upShift <= 10; upShift++){
                    // Calculate the contribution of the gaussian in space.. 
                    spatialContribution = spatialGaussian(col,row,col+upShift,row+leftShift);
                    // Calculate the contribution of the gaussian w.r.t intensity. 
                    intensityContribution = intensityGaussian(luminanceArray.getIdx(row,col),luminanceArray.getidx(row+leftShift,col+upShift));
                    // Log of the luminance. 
                    logLuminance = Math.log(luminanceArray.getIdx(row,col));
                    // Convolve and update the values in the lowPassArray.
                    lowPassArray.setIdx(row-10,col-10 , lowPassArray.getIdx(row-10,col-10) +logLuminance*spatialContribution*intensityContribution);
                }
            }
            // INFO : updated object getIdx is called on to get values from luminance (=hdr_image) and scale appropriately
            // INFO : keep lowPassArray/highPassArray as floats, just need to remember to *255 when setting up the final image
            lowPassArray.setIdx(row-10, col-10, luminanceArray.getIdx(row-10,col-10)/scaleFactor); // We have summed over all 21x21 neighbors. 
        }
    }

    return lowPassArray;
}

function highPass(lowPassArray, luminanceArray){
    // Given a low pass array and original luminance create the high pass array.
    const width = lowPassArray.width;
    const height = lowPassArray.height;

    const highPassArray = (width, height);

    // Keep in mind that the highPass array is missing 10 rows on the top and bottom and 10 rows on the left and right.

    for(col = 0; col < width; col++){
        for(row = 0; row < height; row++){
            highPassArray.setIdx(row,col,Math.log(luminanceArray.getIdx(row+10,col+10)) - lowPassArray.getIdx(row+10,col+10));
        }              
    }

    return highPassArray;
}

function gammaCorrect(lowPassArray, highPassArray, gammaParam){
    const width = lowPassArray.width;
    const height = lowPassArray.height;
    // lowPassArray and highPassArray ARE the same dimensions.
    
    // Parameter used for gamma, gammaParam in [5,100]
    max = lowPassArray.getIdx(0,0);
    min = lowPassArray.getIdx(0,0);
    // Determine the max of the low pass array.
    // Determine the min of the low pass array.
    for(col = 0; col < width; col++){
        for(row=0; row < height; row++){
        max = (max < lowPassArray.getIdx(row,col)) ? lowPassArray.getIdx(row,col) : max;
        min = (min > lowPassArray.getIdx(row,col)) ? lowPassArray.getIdx(row,col) : min;
        }
    }

    // Calculate gamma.
    const gamma = Math.log(c)/(max-min); 

    const newLuminanceArray = new FloatArrayWrapper(width, height);
    // Gamma corrects the image to calculate the Log(L')
    // array.

    for(col = 0; col < width; col++){
        for(row = 0; row < height; row++){
        logLuminance = gamma*lowPassArray.getIdx(row,col) + highPassArray.getIdx(row,col);
        newLuminanceArray.setIdx(row,col, Math.exp(logLuminance));
        }
    }

    return newLuminanceArray;
}

function finalizeImage(originalLuminanceArray, updatedLuminanceArray, image){
    // Calculate scale for each pixel. 

    // Calculate the new RGB in the image 
    // by multiplying the original image RGB by the scale. 
    const width = updatedLuminaceArray.width;
    const height = updatedLuminaceArray.height;

    const newImage = [];

    // Loop over the pixels of the SMALLER updatedLuminanceArray, shifting by 10 from the original dimensions.
    for(col = 0; col < width; col++){
        for(row = 0; row < height; row++){
        scaleFactor = updatedLuminanceArray.getIdx(row,col)/originalLuminanceArray.getIdx(row+10,col+10); // Calculate the scale factor used.

        newImage.setIdx(row,col, image.getIdx(row+10,col+10)*scaleFactor);                                // Set the pixel in the new image 
                                                                                                          // to be the old RGB times the scalefactor.

        }
    }

    // Recall that newImage IS OF SMALLER DIMENSION (20 less in x, 20 less in y)
    return newImage;
}
