class FloatWrapper{
    constructor(width, height, array=null) {
        if (array === null) {
            this.array = new Float32Array(4*height*width);
        } else {
            this.array = array;
        }
        this.width = width;
        this.height = height;
    }

    getIdx = (row, col) => {

        if(row < 0 || row >= this.height || col < 0 || col >= this.width){
            throw new Error('OOB');
        }

        var i = this.width * 4 * row + 4 * col;
        let red = this.array[i];
        let green = this.array[i+1];
        let blue = this.array[i+2];
        let alpha = this.array[i+3]
        return [red, green, blue, alpha];
    }

    setIdx = (row, col, rgba) => {
        var i = this.width * 4 * row + 4 * col;

        this.array[i] = rgba[0];
        this.array[i+1] = rgba[1];
        this.array[i+2] = rgba[2];
        this.array[i+3] = rgba[3];
    }
}

class Uint8Wrapper{
    constructor(width, height, array=null) {
        if (array === null) {
            this.array = new Uint8ClampedArray(4*width*height);
        } else {
            this.array = array;
        }
        this.width = width;
        this.height = height;
    }

    getIdx = (row, col) => {

        if(row < 0 || row >= this.height || col < 0 || col >= this.width){
            throw new Error('OOB')
        }

        var i = 4 * this.width * row + 4 * col;
        let red = this.array[i];
        let green = this.array[i+1];
        let blue = this.array[i+2];
        let alpha = this.array[i+3];
        return [red, green, blue, alpha];
    }

    setIdx = (row, col, rgba) => {
        var i = 4 * this.width * row + 4 * col;

        this.array[i] = rgba[0];
        this.array[i+1] = rgba[1];
        this.array[i+2] = rgba[2];
        this.array[i+3] = rgba[3];
    }
}