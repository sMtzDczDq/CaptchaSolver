#!/bin/bash
./checkdeps.sh
sleep 1
node ./ocr.js keep2share.cc "$1" >> log.txt 2>&1
return
