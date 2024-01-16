#!/bin/sh
./checkdeps.sh
sleep 1
node ./ocr.js filejoker.net > log.txt 2>&1
sleep 1
