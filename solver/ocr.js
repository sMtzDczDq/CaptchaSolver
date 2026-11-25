var Jimp = require('jimp'); //For image processing
var fs = require('fs');
const { execSync } = require('child_process');
const { EOL } = require('os');

const Pixelizer = require('image-pixelizer');
var white = Jimp.rgbaToInt(255, 255, 255, 255);
var red = Jimp.rgbaToInt(255, 0, 0, 255);
var black = Jimp.rgbaToInt(0, 0, 0, 255);

const darknetExec = (process.platform === 'win32' ? 'darknet_no_gpu.exe' : './darknet');

var what2Scan = process.argv[2] || "keep2share.cc"; //Start parameter
//var inputPic = 'input.gif';
var inputPic = process.argv[3]
//inputPic = 'c2.PNG';
console.log("Running ->", what2Scan);


if (what2Scan == "keep2share.cc") {
    console.log("keep2share.cc");
    getKeep2share(inputPic, function (content) {
        fs.writeFile('result.txt', content["text"].toString(), (err) => {
            if (err) throw err;

            fs.writeFile('log.txt', JSON.stringify(content, false, 2), (err) => {
                process.exit();
            });
        });

    })
} else if (what2Scan == "filejoker.net") {
    console.log(what2Scan);
    getFilejoker(inputPic, function (content) {
        fs.writeFile('result.txt', content["text"].toString(), (err) => {
            if (err) throw err;

            console.log("Write log file...")
            fs.writeFile('log.txt', JSON.stringify(content, false, 2), (err) => {
                process.exit();
            });
        });

    })
} else {
    console.log("No function found for: ", what2Scan);
}

//Solving keep2share.cc new captchas
var ANSI_RE = /\x1b\[[0-9;]*m/g;
var OLD_DETECTION_RE = /^\s*(\S+):\s*([\d.]+)%(?:\s*\(left_x:\s*(-?\d+(?:\.\d+)?)\s+top_y:\s*(-?\d+(?:\.\d+)?)\s+width:\s*(-?\d+(?:\.\d+)?)\s+height:\s*(-?\d+(?:\.\d+)?)\))?\s*$/;
var NEW_DETECTION_RE = /^\s*(\S+)\s+c=([\d.]+)%(?:\s+x=(-?\d+(?:\.\d+)?))?(?:\s+y=(-?\d+(?:\.\d+)?))?(?:\s+w=(-?\d+(?:\.\d+)?))?(?:\s+h=(-?\d+(?:\.\d+)?))?\s*$/;

function parseDetections(resultString) {
    var lines = resultString.replace(ANSI_RE, '').split(EOL);
    var detections = [];

    for (var i = 0; i < lines.length; i++) {
        var match = OLD_DETECTION_RE.exec(lines[i]) || NEW_DETECTION_RE.exec(lines[i]);
        if (!match) {
            continue;
        }

        detections.push({
            c: match[1],
            p: match[2],
            pNum: parseFloat(match[2]),
            x: match[3] === undefined ? null : parseFloat(match[3]),
            y: match[4] === undefined ? null : parseFloat(match[4]),
            w: match[5] === undefined ? null : parseFloat(match[5]),
            h: match[6] === undefined ? null : parseFloat(match[6]),
            order: i
        });
    }

    return detections;
}

function boxIoU(a, b) {
    if (a.x === null || a.y === null || a.w === null || a.h === null ||
        b.x === null || b.y === null || b.w === null || b.h === null) {
        return 0;
    }

    var interW = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    var interH = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    var intersection = interW * interH;
    var union = (a.w * a.h) + (b.w * b.h) - intersection;
    return union > 0 ? intersection / union : 0;
}

function deduplicateBoxes(detections) {
    var kept = [];
    var sorted = detections.slice().sort(function (a, b) {
        return b.pNum - a.pNum;
    });

    for (var i = 0; i < sorted.length; i++) {
        var duplicate = false;
        for (var j = 0; j < kept.length; j++) {
            if (boxIoU(sorted[i], kept[j]) > 0.5) {
                duplicate = true;
                break;
            }
        }
        if (!duplicate) {
            kept.push(sorted[i]);
        }
    }

    return kept;
}

function postProcessDetections(resultString) {
    var detections = deduplicateBoxes(parseDetections(resultString));
    detections.sort(function (a, b) {
        var ax = a.x === null ? Number.POSITIVE_INFINITY : a.x;
        var bx = b.x === null ? Number.POSITIVE_INFINITY : b.x;
        if (ax !== bx) {
            return ax - bx;
        }
        return a.order - b.order;
    });

    var chosen = detections.slice(0, 6);
    var text = '';
    var confidence = 0;
    for (var i = 0; i < chosen.length; i++) {
        text += chosen[i].c;
        confidence += chosen[i].pNum;
    }
    confidence = chosen.length ? Math.round(confidence / chosen.length) : 0;

    return { host: what2Scan, text: text, confidence: confidence };
}

function getKeep2share(file, callback) {
    Jimp.read(file).then(image => {

        image.rgba(false).greyscale()

        for (var x = 0; x < image.bitmap.width; x++) {
            for (var y = 0; y < image.bitmap.height; y++) {

                let currentColor = image.getPixelColor(x, y);

                var rgb = Jimp.intToRGBA(currentColor);
                if (rgb.r < 253) {

                    let newVal = 0;

                    image.setPixelColor(Jimp.rgbaToInt(newVal, newVal, newVal, 255), x, y);
                }
            }
        }

        image = image.clone();
        image.write('./darknet64/temp.jpg', function () {
            setTimeout(function () {
                let result = execSync('cd darknet64 && ' + darknetExec + ' detector test -dont_show -ext_output data/obj.data yolov4-tiny-custom.cfg yolov4-tiny-custom_last.weights temp.jpg');
                let resultString = result.toString('utf8');
                //console.log(resultString);

                callback(postProcessDetections(resultString));
            }, 200)
        });

    }).catch(err => {
        console.log(err);
    });
}

function getFilejoker(file, callback) {
    Jimp.read(file).then(image => {

        var mainImg = "";
        var solution = "";
        var confidence = {};

        let gImgCnt = 0;
        for (var yOrg = 0; yOrg < 5; yOrg++) {
            for (var xOrg = 0; xOrg < 5; xOrg++) {
                let CPimage = image.clone();
                let xxxx = xOrg * 50
                let yyyy = yOrg * 50
                if (yOrg == 0 && xOrg > 0) {
                    //Dont read the black ones
                } else {
                    if (xxxx < image.bitmap.width - 1 && yyyy < image.bitmap.height - 1) {
                        CPimage.crop(xxxx, yyyy, 50, 50);
                        CPimage.write("out" + gImgCnt + "_0.png");
                        CPimage.convolute(kernels.blur);

                        let inputBitmap = new Pixelizer.Bitmap(
                            CPimage.bitmap.width,
                            CPimage.bitmap.height,
                            CPimage.bitmap.data
                        );

                        let options = new Pixelizer.Options()
                            .setPixelSize(1)
                            .setColorDistRatio(0.1)
                            .setClusterThreshold(0.1)
                            .setMaxIteration(10)
                            .setNumberOfColors(3);
                        let outputBitmap = new Pixelizer(inputBitmap, options).pixelize();

                        CPimage.bitmap.width = outputBitmap.width;
                        CPimage.bitmap.height = outputBitmap.height;
                        CPimage.bitmap.data = outputBitmap.data;

                        CPimage = CPimage.clone();
                        CPimage.write("out" + gImgCnt + "_1.png")

                        fillBucket(CPimage, 25, 25, white)

                        CPimage.write("out" + gImgCnt + "_2.png")
                        let maxDistance = 0;
                        var fx = 0;
                        var fy = 0;
                        CPimage = CPimage.clone();

                        //CPimage.convolute(kernels.edgedetect);
                        for (var x = 0; x < CPimage.bitmap.width; x++) {
                            for (var y = 0; y < CPimage.bitmap.height; y++) {
                                let currentColor = CPimage.getPixelColor(x, y);
                                if (currentColor != white) {
                                    CPimage.setPixelColor(black, x, y);
                                } else {
                                    var d = distance(x, y, 25, 25)
                                    if (d > maxDistance) {
                                        maxDistance = d;
                                        fx = x;
                                        fy = y;
                                    }
                                }
                            }
                        }

                        //CPimage.setPixelColor(red, fx, fy);

                        CPimage.write("out" + gImgCnt + "_3.png")

                        var maxD = distance(50, 50, 25, 25)

                        var dDiv = maxD / maxDistance;

                        CPimage.resize(50 * dDiv, Jimp.AUTO);
                        CPimage.write("out" + gImgCnt + "_4.png")

                        let pixelCount = 0;
                        for (var x = 0; x < CPimage.bitmap.width; x++) {
                            for (var y = 0; y < CPimage.bitmap.height; y++) {
                                let currentColor = CPimage.getPixelColor(x, y);
                                if (currentColor != black) {
                                    CPimage.setPixelColor(red, x, y);
                                    pixelCount++;
                                }
                            }
                        }

                        let localSolution = getGeoFromPixelCnt(pixelCount);
                        if (gImgCnt == 0) {
                            mainImg = localSolution;
                        } else if (mainImg == localSolution) {
                            solution = solution == "" ? gImgCnt : solution + "," + gImgCnt;
                        }
                        console.log(gImgCnt, localSolution, pixelCount)
                        confidence[gImgCnt] = localSolution + " " + pixelCount;
                        CPimage.write("out" + gImgCnt + "_5.png")

                        gImgCnt++;
                    }
                }
            }
        }
        console.log("Done getting shapes from images! Going into callback!")
        callback({ host: what2Scan, text: solution, confidence: confidence });

        console.log("Done! Delete old files now!")
        for (var i = 0; i < 20; i++) { //Delete all old files
            for (var k = 0; k < 10; k++) {
                let path = "out" + i + "_" + k + ".png";
                if (fs.existsSync(path)) {
                    fs.unlinkSync(path)
                }
            }
        }
        console.log("solution", solution)
    });

    const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

    function fillBucket(image, startX, startY, newColor) { // Start painting with paint bucket tool starting from pixel specified by startX and startY
        var pixelStack = [[startX, startY]];
        var doneObj = {};

        var colorToReplace = image.getPixelColor(startX, startY)

        while (pixelStack.length) {

            newPos = pixelStack.pop();
            x = newPos[0];
            y = newPos[1];

            if (!doneObj[x + "," + y] && y > 0 && y < image.bitmap.height && x > 0 && x < image.bitmap.width) {
                doneObj[x + "," + y] = true;
                // Get current pixel position

                if (colorToReplace == image.getPixelColor(x, y)) {
                    image.setPixelColor(newColor, x, y);
                    pixelStack.push([x + 1, y]);
                    pixelStack.push([x + 1, y + 1]);
                    pixelStack.push([x + 1, y - 1]);
                    pixelStack.push([x - 1, y]);
                    pixelStack.push([x - 1, y + 1]);
                    pixelStack.push([x - 1, y - 1]);
                    pixelStack.push([x, y - 1]);
                }
            }
        }
    }

    function getGeoFromPixelCnt(pixelCnt) {
        if (pixelCnt > 3850) {
            return "Circle"
        } else if (pixelCnt > 3300) {
            return "6 Corners"
        } else if (pixelCnt > 3000) {
            return "5 Corners"
        } else if (pixelCnt > 2500) {
            return "4 Corners"
        } else {
            return "3 Corners"
        }
    }

    const kernels =
        {
            emboss: [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]],
            edgedetect: [[0, 1, 0], [1, -4, 1], [0, 1, 0]],
            edgeenhance: [[0, 0, 0], [-1, 1, 0], [0, 0, 0]],
            blur: [[0.0625, 0.125, 0.0625], [0.125, 0.25, 0.125], [0.0625, 0.125, 0.0625]],
            // equivalent to {name: "blur", kernel: [[1/16, 1/8, 1/16],[1/8, 1/4, 1/8], [1/16, 1/8, 1/16]]},
            sharpen: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]]
        }
}