#!/bin/sh
./checkdeps.sh
sleep 1
/opt/homebrew/bin/node ./ocr.js filejoker.net &> log.txt
sleep 1
