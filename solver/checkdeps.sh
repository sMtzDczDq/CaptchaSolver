#!/bin/sh
if [ -d "node_modules" ]; then
	echo "all good!"
else
	/opt/homebrew/bin/npm i jimp
fi
