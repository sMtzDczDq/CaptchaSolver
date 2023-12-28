#!/bin/sh
./checkdeps.sh
sleep 1
$(which node) ./ocr.js filejoker.net &> log.txt
sleep 1
