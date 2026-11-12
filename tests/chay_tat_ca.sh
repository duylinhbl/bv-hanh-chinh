#!/bin/bash
# Chạy toàn bộ kiểm thử phía app. Dùng: tests/chay_tat_ca.sh
cd "$(dirname "$0")/.."; ok=1
tools/kiemtra.sh || ok=0
for t in doc_so ghi_sheet giao_dien; do node tests/$t.test.js || ok=0; done
node --experimental-strip-types --no-warnings tests/bao_cao_tuan.test.js || ok=0
[ $ok = 1 ] && echo "=== TẤT CẢ ĐẠT ===" || { echo "=== CÓ LỖI, ĐỪNG ĐẨY LÊN ==="; exit 1; }
