#!/bin/sh

set -e

dev=""
if [ "$1" = '-d' ]; then
    dev=":dev"
fi

if [ -n "$DIST_VERSION" ]; then
    version=$DIST_VERSION
else
    version=`git describe --dirty --tags || echo unknown`
fi

npm run clean
npm run build$dev

# include the sample config in the tarball. Arguably this should be done by
# `npm run build`, but it's just too painful.
cp config.sample.json webapp/

mkdir -p dist
cp -r webapp riot-$version
echo $version > riot-$version/version
tar chvzf dist/riot-$version.tar.gz riot-$version
rm -r riot-$version

echo
echo "Packaged dist/riot-$version.tar.gz"
