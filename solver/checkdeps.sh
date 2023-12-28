#!/bin/sh
set -x
if [ -d "node_modules" ]; then
	echo "all good!"
else
	$(which npm) i jimp
fi
