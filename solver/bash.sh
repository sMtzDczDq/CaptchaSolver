#!/bin/bash
#set -x
./checkdeps.sh
sleep 1
/usr/local/bin/deno --allow-run --allow-read --allow-write --allow-env ./ocr.js keep2share.cc "$1" >> log.txt 2>&1
