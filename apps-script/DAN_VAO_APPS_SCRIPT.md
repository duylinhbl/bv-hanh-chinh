# Dán mã mới vào Apps Script (tài khoản tchcbvdk@gmail.com)

Lỗi đang gặp: khi bấm 💾 Lưu, app báo *"Đã lưu trong app. Chưa đưa được vào Drive: Exception: 입력한 ID에 해당하는 항목이 없습니다…"*.
Nghĩa là mã trên Apps Script vẫn là **bản cũ**: nó mở thư mục Drive theo ID cố định, tài khoản chạy script không mở được thư mục đó nên văng lỗi (câu tiếng Hàn là do ngôn ngữ của tài khoản Google đó).

## Làm 1 lần, khoảng 3 phút
1. Mở script: script.google.com → dự án đang dùng (có hàm `doPost` và hằng `TOKEN`).
2. Mở file **VanBan.gs** trong dự án (nếu chưa có thì Tệp > + > Tập lệnh, đặt tên VanBan) → **xóa hết** rồi dán toàn bộ nội dung `apps-script/VanBan.gs` mới.
3. Mở (hoặc tạo) file **DoiChieu.gs** → xóa hết → dán toàn bộ `apps-script/DoiChieu.gs`.
4. Trong `doPost`, ngay sau dòng kiểm tra `b.token`, bảo đảm có 3 dòng:
   ```js
   if (b.action === 'vb_mau_lay') return out(vbMauLay(b));
   if (b.action === 'luu_van_ban') return out(luuVanBan(b));
   if (/^dc_/.test(b.action)) return out(dcRoute(b));
   ```
5. **Triển khai > Quản lý bản triển khai > Sửa (bút chì) > Phiên bản: Mới > Triển khai.** (Bỏ bước này là vẫn chạy mã cũ.)

## Sau khi dán
- Bản mới tự xoay xở: mở được thư mục cũ thì dùng, không mở được thì **tự tạo thư mục "Văn bản soạn từ app"** trong Drive của tài khoản chạy script và **chia sẻ quyền sửa cho duylinhbl@gmail.com**.
- Mọi lỗi Drive trả về bằng tiếng Việt, không còn câu tiếng Hàn.
