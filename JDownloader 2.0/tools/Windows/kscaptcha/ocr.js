var Tesseract = require('tesseract.js');
var Jimp = require('jimp');
var fs = require('fs');

var what2Scan = process.argv[2] || "keep2share.cc"; //Start parameter
var white = Jimp.rgbaToInt(255, 255, 255, 255);
var black = Jimp.rgbaToInt(0, 0, 0, 255);
var gray = Jimp.rgbaToInt(200, 200, 200, 255);

var inputPic = 'input.gif';
//inputPic = 'keep2share.cc_02.11.2018_13.23.05.340.jpg';
console.log("Running ->", what2Scan);

if (what2Scan == "keep2share.cc") {
	console.log("keep2share.cc");
    getKeep2shareSText(inputPic, function (content) {
        fs.writeFile('result.txt', content["text"], (err) => {
            if (err) throw err;

            fs.writeFile('log.txt', JSON.stringify(content), (err) => {
                process.exit();
            });
        });

    })
} else  if (what2Scan == "przeklej.org") {
    getPrzeklejText(inputPic, function (content) {
        fs.writeFile('result.txt', content["text"], (err) => {
            if (err) throw err;

            fs.writeFile('log.txt', JSON.stringify(content), (err) => {
                process.exit();
            });
        });

    })
} else {
    console.log("No function found for: ", what2Scan);
}

function getPrzeklejText(file, callback) {
    Jimp.read(file).then(image => {
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            var color = image.getPixelColor(x, y);
            var rgbColor = Jimp.intToRGBA(color);
            if(rgbColor["r"]>50) {
                image.setPixelColor(white, x, y);
            }
            if(x==0||y==0||x==image.bitmap.width-1||y==image.bitmap.height-1) {
                image.setPixelColor(white, x, y);
            }
            if (x == image.bitmap.width - 1 && y == image.bitmap.height - 1) { //Scan1 finished
                image.resize( 250, Jimp.AUTO );
                changeAllPresentPixelsToBlack(image, function (image) {
                    removeSpikes(image, 3, function (image) {
                        fillGaps(image, 1, function (image) {
                            image.write('temp.jpg', function () {
                                fs.readFile('temp.jpg', function (err, data) {
                                    // Tesseract.recognize(data).then(function (result) {
                                    //     var text = result["text"].replace(/\W/g, '');
                                    //     var confidence = result["confidence"];
                                    //     callback({ host : what2Scan, text: text, confidence: confidence });
                                    // })
                                });
                            });
                        });
                    });
                });
            }
        });
    }).catch(err => {
        console.log(err);
        // Handle an exception.
    });
} 

function getKeep2shareSText(file, callback) {
    var colorBuffer = {};
    var bandColors = [];
    var borderColors = {};
    Jimp.read(file).then(image => {
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            var index = image.getPixelColor(x, y);
            if (!colorBuffer[index]) {
                colorBuffer[index] = 1;
            } else {
                colorBuffer[index]++;
            }

            //Take all border colors to remove them from the image (Removing lines)
            if (index != white && (y < 2 || image.bitmap.height - y < 10)) {
                borderColors[index] = true;
            }

            if (x == image.bitmap.width - 1 && y == image.bitmap.height - 1) { //Scan1 finished
                for (var k in borderColors) {
                    bandColors.push({ "color": k });
                }
                for (var i in colorBuffer) {
                    if (colorBuffer[i] < 100) { //Remove all colors witch are not very present in the img (<100 pixels in the image)
                        bandColors.push({ "color": i });
                    }
                }

                image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
                    var color = image.getPixelColor(x, y);
                    var rgbColor = Jimp.intToRGBA(color);
                    if(!isColorVisableWellOnWhite(rgbColor)) { //remove colors that are barley seen
                        image.setPixelColor(white, x, y);
                    }

                    for (var k in bandColors) {
                        var clEntry = bandColors[k];

                        if (color == clEntry["color"]) {
                            image.setPixelColor(white, x, y);
                            break;
                        }
                    }

                    if (x == image.bitmap.width - 1 && y == image.bitmap.height - 1) {
                        fillGaps(image, 3, function (image) {
                            thinOut(image, 2, function (image) {
                                changeAllPresentPixelsToBlack(image, function (image) {
                                    image.write('temp.jpg', function () {
                                        fs.readFile('temp.jpg', function (err, data) {
                                            Tesseract.recognize(data).then(function (result) {
                                                var text = result["text"].replace(/\W/g, '');
                                                var confidence = result["confidence"];
                                                callback({ host : what2Scan, text: text, confidence: confidence });
                                            })
                                        });
                                    });
                                });
                            });    
                        })
                    }
                });
            }
        });
    }).catch(err => {
        console.log(err);
        // Handle an exception.
    });
}

function changeAllPresentPixelsToBlack(image, callback) {
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        var color = image.getPixelColor(x, y);
        if(color != white) {
            image.setPixelColor(black, x, y);
        }
        
        if (x == image.bitmap.width - 1 && y == image.bitmap.height - 1) {
            callback(image);
        }
    });
}

function fillGaps(image, iterations, callback) {
    iterations--;
    new Jimp(image.bitmap.width, image.bitmap.height, white, (err, newImage) => {
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            var color = image.getPixelColor(x, y);
            if (color != white) {
                newImage.setPixelColor(color, x - 1, y - 1);
                newImage.setPixelColor(color, x, y - 1);
                newImage.setPixelColor(color, x, y - 1);

                newImage.setPixelColor(color, x - 1, y + 1);
                newImage.setPixelColor(color, x, y + 1);
                newImage.setPixelColor(color, x + 1, y + 1);

                newImage.setPixelColor(color, x, y);
                newImage.setPixelColor(color, x - 1, y);
                newImage.setPixelColor(color, x + 1, y);
            }
            if (x == image.bitmap.width - 1 && y == image.bitmap.height - 1) {
                if(iterations<=0) {
                    callback(newImage);
                } else {
                    fillGaps(newImage, iterations, callback);
                }
            }
        })
    });
}

function thinOut(image, iterations, callback) {
    iterations--;
    new Jimp(image.bitmap.width, image.bitmap.height, white, (err, newImage) => {
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            var color = image.getPixelColor(x, y);
            if (color != white) {
                var l = image.getPixelColor(x - 1, y);
                var r = image.getPixelColor(x + 1, y);
                var t = image.getPixelColor(x, y + 1);
                var b = image.getPixelColor(x, y - 1);

                var lb = image.getPixelColor(x - 1, y - 1);
                var lt = image.getPixelColor(x - 1, y + 1);
                var rt = image.getPixelColor(x + 1, y + 1);
                var rb = image.getPixelColor(x + 1, y - 1);
                if (l == white || r == white || t == white || b == white || lb == white || lt == white || rt == white || rb == white) {
                    newImage.setPixelColor(white, x, y);
                } else {
                    newImage.setPixelColor(color, x, y);
                }
            }

            if (x == image.bitmap.width - 1 && y == image.bitmap.height - 1) {
                callback(newImage);
                if(iterations<=0) {
                    callback(newImage);
                } else {
                    thinOut(newImage, iterations, callback);
                }
            }
        })
    });
}

function removeSpikes(image, iterations, callback) {
    iterations--;
    new Jimp(image.bitmap.width, image.bitmap.height, white, (err, newImage) => {
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            var color = image.getPixelColor(x, y);
            if (color != white) {
                var l = image.getPixelColor(x - 1, y);
                var r = image.getPixelColor(x + 1, y);
                var t = image.getPixelColor(x, y + 1);
                var b = image.getPixelColor(x, y - 1);

                var lb = image.getPixelColor(x - 1, y - 1);
                var lt = image.getPixelColor(x - 1, y + 1);
                var rt = image.getPixelColor(x + 1, y + 1);
                var rb = image.getPixelColor(x + 1, y - 1);

                var whiteNCount = 0;
                if (l == white) {
                    whiteNCount++;
                } 
                if(r == white) {
                    whiteNCount++;
                } 
                if(t == white) {
                    whiteNCount++;
                } 
                if(b == white) {
                    whiteNCount++;
                } 
                if(lb == white) {
                    whiteNCount++;
                } 
                if(lt == white) {
                    whiteNCount++;
                } 
                if(rt == white) {
                    whiteNCount++;
                } 
                if(rb == white) {
                    whiteNCount++;
                }

                if(whiteNCount>=4) {
                    newImage.setPixelColor(white, x, y);
                } else {
                    newImage.setPixelColor(color, x, y);
                }
            }

            if (x == image.bitmap.width - 1 && y == image.bitmap.height - 1) {
                callback(newImage);
                if(iterations<=0) {
                    callback(newImage);
                } else {
                    thinOut(newImage, iterations, callback);
                }
            }
        })
    });
}

function luminanace(r, g, b) {
    var a = [r, g, b].map(function (v) {
        v /= 255;
        return v <= 0.03928
            ? v / 12.92
            : Math.pow( (v + 0.055) / 1.055, 2.4 );
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

//contrast([255, 255, 255], [255, 255, 0]); 1.074 for yellow
//contrast([255, 255, 255], [0, 0, 255]); // 8.592 for blue
function contrast(rgb1, rgb2) {
    return (luminanace(rgb1["r"], rgb1["g"], rgb1["b"]) + 0.05)
         / (luminanace(rgb2["r"], rgb2["g"], rgb2["b"]) + 0.05);
}

function isColorVisableWellOnWhite(rgbColor) {
    if(contrast(Jimp.intToRGBA(white), rgbColor) < 2 && rgbColor["r"] > 150 && rgbColor["g"] > 150 && rgbColor["b"] > 150) {
        return false;
    }
    return true;
}