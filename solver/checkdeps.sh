#!/bin/sh
set -x
if ! [ -d "node_modules" ]; then
	npm i jimp
fi
