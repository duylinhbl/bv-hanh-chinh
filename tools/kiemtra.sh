#!/bin/bash
# Kiểm tra trước khi đẩy: cú pháp JS + 3 chỗ số phiên bản phải trùng nhau
cd "$(dirname "$0")/.."; ok=1
for f in app.js lich.js ct.js kh.js sw.js config.js; do node --check $f 2>/dev/null || { echo "LỖI cú pháp: $f"; ok=0; }; done
a=$(grep -o "bv-v[0-9]*" sw.js | head -1 | tr -dc 0-9)
b=$(grep -o "?v=[0-9]*" index.html | sort -u | tr -dc '0-9\n' | tr '\n' ' ')
c=$(grep -o " v[0-9]*<" app.js | head -1 | tr -dc 0-9)
[ "$a" = "$c" ] && [ "$b" = "$a " ] || { echo "LỆCH phiên bản: sw=$a index=$b app=$c"; ok=0; }
for f in $(grep -o 'src="[a-z.]*\.js' index.html | sed 's/src="//'); do grep -q "'$f'" sw.js || { echo "sw.js thiếu $f"; ok=0; }; done
[ $ok = 1 ] && echo "ĐẠT: cú pháp + phiên bản v$a đồng bộ" || exit 1
