#!/bin/bash
# Chạy toàn bộ kiểm thử phía app. Dùng: tests/chay_tat_ca.sh
cd "$(dirname "$0")/.."; ok=1
tools/kiemtra.sh || ok=0
for t in doc_so ghi_sheet giao_dien tro_ly ds_viec quy_trinh soan_vb bang_phu_luc bao_cao_tuan tra_cuu tra_thuoc tra_cuu_menu giao_dien_chuan; do node tests/$t.test.js || ok=0; done
[ $ok = 1 ] && echo "=== TẤT CẢ ĐẠT ===" || { echo "=== CÓ LỖI, ĐỪNG ĐẨY LÊN ==="; exit 1; }
