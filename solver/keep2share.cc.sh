#!/bin/sh
./checkdeps.sh
sleep 1
$(which node)  ./ocr.js keep2share.cc &> log.txt
sleep 1
