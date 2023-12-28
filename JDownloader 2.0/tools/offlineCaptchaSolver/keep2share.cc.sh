#!/bin/bash
set -x
./checkdeps.sh
sleep 1
/opt/homebrew/bin/node ./ocr.js keep2share.cc &> log.txt
sleep 1
