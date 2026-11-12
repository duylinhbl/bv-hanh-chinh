#!/bin/bash
# Dùng: tools/bump.sh        -> tự tăng số phiên bản ở index.html, sw.js, app.js (đồng bộ 3 nơi)
set -e; cd "$(dirname "$0")/.."
cur=$(grep -o "bv-v[0-9]*" sw.js | head -1 | tr -dc 0-9); n=${1:-$((cur+1))}
sed -i -E "s/\?v=[0-9]+/?v=$n/g" index.html
sed -i -E "s/bv-v[0-9]+/bv-v$n/" sw.js
sed -i -E "s/ v[0-9]+</ v$n</" app.js
echo "phiên bản -> v$n"; tools/kiemtra.sh
