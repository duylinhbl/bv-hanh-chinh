# Sổ nghiệp vụ & bài học – App Quản lý hành chính BV Đa khoa Cao su Dầu Tiếng

> Người dùng (anh Duy Linh, trưởng phòng TCHC) nói đến đâu làm đến đó, KHÔNG tự ghi chép. File này là bộ nhớ chung: đọc trước khi sửa app, cập nhật sau mỗi yêu cầu mới. Dùng để viết hướng dẫn sử dụng và tránh lặp lại lỗi cũ.

## 1. Hệ thống
- Web app PWA (vanilla JS) trên GitHub Pages: https://duylinhbl.github.io/bv-hanh-chinh/ (repo duylinhbl/bv-hanh-chinh, nhánh main).
- Backend Supabase project `fndqxqwgnvrkuzogashv` (ap-southeast-1): Postgres + RLS + Auth (email giả `<sđt>@bv.local`) + Storage (bucket `anh`) + Edge Function `gui-push` + pg_cron + pg_net.
- Mục tiêu chiến lược: app là KÊNH DUY NHẤT cho chỉ đạo và giao việc; mọi người bắt buộc dùng.
- Mỗi lần deploy phải tăng số phiên bản ở 3 chỗ: `?v=N` trong index.html, tên cache trong sw.js, nhãn `vN` ở header (app.js). Không tăng thì điện thoại giữ bản cũ.
- Màu: xanh lá logo BV (#055c2b/#00843a) + vàng đồng (#d9a521); logo lấy từ Drive (thư mục LOGO).

## 2. Vai trò
- Quản trị (la_quan_tri): Duy Linh. Xóa được việc, thông báo, lịch công tác, kỳ lịch trực.
- Phát thông báo/ghi lịch công tác (duoc_phat): BGĐ, TCHC, KHTH, TCKT. Thảo (TCHC) nhập lịch công tác.
- Xếp lịch trực (duoc_xep): Lưu Văn Huy, Hà Huy Thành (KHTH) + quản trị.
- Trưởng khoa/ĐD trưởng (vai_tro truong_khoa) chỉ thấy và giao việc trong khoa mình; nhân viên chỉ tự giao.
- Lãnh đạo khoa: Khám bệnh (đã GỘP YTCĐ + YHCT + Khám bệnh): BS Danh phụ trách, BS Lại Kim Hoàng phó phụ trách, ĐD Như Anh ĐD trưởng (anh Lê Anh Chính không còn là lãnh đạo). HSCC: BS Quang phụ trách + ĐD Thu Hương. Sản: NHS Ngô Thị Hải Yến phụ trách. BGĐ: Quốc, Trần Bích Nữ.

## 3. Nghiệp vụ theo mô-đun
**Giao việc/hiện trạng:** người nhận cập nhật trạng thái + ảnh chụp tại chỗ + GPS chỉ lấy lúc bấm Gửi (không theo dõi liên tục). Có hàng đợi offline. Giao cho người khác mới có push; giao cho chính mình thì không (cố ý). Ô Người nhận có ô gõ tên lọc, chỉ hiện người trong phạm vi quyền.
**Thông báo:** phát cho cả viện hoặc nhóm; người nhận bấm "Đã đọc, đã hiểu"; người phát xem tình hình đọc; nhắc lại theo giờ cài.
**Lịch công tác (tháng/tuần):** Thảo nhập TRONG APP (không dùng Google Calendar làm nguồn). Có "dán nhanh" tự tách ngày/giờ/địa điểm/thành phần. Chọn khoa bằng ô gõ tên; chọn khoa chỉ nhắn trưởng khoa + ĐD trưởng + BGĐ (vai truong_khoa/bgd), KHÔNG nhắn cả khoa. Ai được tag đều nhận push. Thẻ lịch hiển thị 1 dòng "giờ · nội dung", chi tiết ẩn/hiện bên phải (máy tính chia 2 cột). Giờ nhập 1 ô (vd 8h-9h30).
**Lịch trực:** KHTH xếp, công bố; nhân viên thấy ca của mình, nhắc 17h chiều hôm trước và 6h30 sáng hôm trực; in đúng mẫu BV. Quy tắc: BS Sơn và BS Tô Văn Châu không trực chung; 2 bác sĩ cùng khoa không trực chung (trừ Khám bệnh tối đa 2); khoa Sản trực đôi (2 người/ngày); BS nghỉ phép/bệnh/hợp đồng/mang thai không trực (khong_truc); trực lãnh đạo chỉ Quốc, Tô Văn Châu, Danh, Nguyễn Đắc Lộc (3 BS lãnh đạo cũng là trực viện cột 1; Châu trực viện thì trực luôn siêu âm); trực viện/lãnh đạo/siêu âm chỉ gom bác sĩ; nhóm HSCC có nhóm trưởng (tên đầu) N1/N2/N3 và Sản N1–N3. Phân biệt trùng tên bằng năm sinh (Kim Yến 1990 = Yến (N) nhỏ; 1991/1984 như dữ liệu).
**Đổi trực:** nhân viên bấm "Đổi trực" ở ca của mình → người kia đồng ý → trưởng khoa + ĐD trưởng khoa liên quan + BGĐ (≥1 người) duyệt → KHTH xác nhận → hệ thống tự đổi lịch và báo. Ai từ chối thì báo ngay.
**Học từ thói quen:** mỗi lần lưu lịch trực và mỗi lần đổi trực ghi vào bảng `nhat_ky_hoc`. Sau vài tháng sẽ gợi ý lịch; chỉ áp dụng cho menu khác khi lịch trực ổn định.
**Báo cáo tuần:** 10h sáng thứ 5 hằng tuần (scheduled task) tự lập file Word "BÁO CÁO CÔNG TÁC TUẦN" từ lịch công tác trong app (theo mẫu Drive thư mục 139jl_3We-_a-ynCjqjLZn5ntWSnY1a4K), gửi vanphong@caosudautieng.com.vn, tiêu đề "Bệnh viện đa khoa".
**Đang chờ:** mẫu bảng công của TCKT (anh đang xin) → chấm công GPS (chỉ khi bấm, ngoài khu vực = không có mặt) + bảng công tháng (trưởng khoa duyệt → gửi TCKT); quy chế dùng GPS; Zalo/SMS dự phòng (chưa trả lời); tự gợi ý lịch trực; xác nhận "NHS Phương" (Sản), Bí thư chưa khớp; backup ảnh 6 tháng; xóa file mật khẩu ban đầu sau khi phát.

## 4. Lỗi đã xử lý – KHÔNG để lặp lại
1. RLS + join tên người gây lỗi "Đang tải" (nhân viên không đọc được tên người giao) → luôn dùng view `danh_ba` hoặc RPC (`ds_nguoi_truc`, `ds_khoa`, `ds_lanh_dao`), không join bảng nguoi_dung từ client.
2. Cache cũ làm máy không cập nhật → fetch network-first, `?v=N`, tăng phiên bản mỗi lần deploy.
3. Đóng/ngắt DOM khi bất đồng bộ: truy cập `$('#x').innerHTML` sau khi người dùng đã chuyển màn → lỗi "Cannot set properties of null". Luôn kiểm tra phần tử còn tồn tại sau `await`.
4. Trigger cho phép nhân viên đóng việc của người khác → đã chặn ở trigger `viec_chuyen_tt`.
5. Lịch trực: nhầm Võ Minh Hoàng/Lại Thị Kim Hoàng (người mang thai là Lại Thị Kim Hoàng); BS Hoàng "Nhân viên KHTH" vẫn là bác sĩ (nhận diện qua chuyen_mon).
6. plpgsql: biến trùng tên cột (`ngay`) gây lỗi mơ hồ → đặt tên biến `v_ngay`.
7. Push iOS cần iOS ≥16.4, mở từ icon "Thêm vào MH chính" trong Safari; trong SW không dùng `renotify` khi không có `tag`.
8. Thẻ lịch từng bị tách tiêu đề và địa điểm thành 2 khối → người dùng muốn 1 dòng duy nhất, chi tiết ẩn.
9. Công cụ Supabase `execute_sql` nhiều lệnh chỉ trả kết quả lệnh cuối; kiểm tra RLS cần giao dịch tách riêng; một lần DROP FUNCTION bị treo ở bước xác nhận → thử lại.
10. Tài khoản phải xác nhận trước khi giao việc cho người khác: kiểm tra phạm vi bằng RLS (đã có `viec_them`).

## Báo cáo kế hoạch – sử dụng chi phí (v29)
- Nguồn: Google Sheet "Bảng thu chi - bệnh viện đa khoa" (chủ sở hữu Thảo, shared with Linh). Đã nạp tab "KH 2026" → bảng `kh_dong` (102 dòng; `thang` = BHYT/tháng, `thang_dv` = dịch vụ).
- Quyền xem: admin, BGĐ, TCHC (hàm `xem_tai_chinh()`); chỉ admin sửa. Menu: Tôi → "Kế hoạch – sử dụng chi phí".
- Số trong sheet định dạng lẫn lộn (chấm/phẩy) → hàm `vn_num()`. Một số dòng tháng lệch vị trí (ghi chú trong cột ghi_chu).
- Chưa nạp: KH 2026 2, Thanh toán, EMS, Quỹ phòng, Công ty thành viên, Hợp đồng, TT đối tác, DNTT, Chiến sỹ TĐ, Theo dõi TT tháng, DNTT cũ 2025. Chờ Linh hướng dẫn cách kết nối.
- (v30) Thêm biểu đồ: chi theo tháng, kế hoạch theo nhóm, bấm 1 dòng có số tháng để xem biểu đồ tháng của dòng đó.
- QUYẾT ĐỊNH của Linh: dữ liệu tài chính KHÔNG lưu chính trên DB; nguồn gốc vẫn là Google Sheet. Nhân viên (Thảo) nhập qua menu trong app → ghi thẳng vào Sheet. Sếp chỉ xem số liệu + chart. Bảng kh_dong chỉ là bản chép tạm để xem.
- (v31) Nhập số chi tháng: app → Edge Function `kh-ghi` → Apps Script gắn trong Sheet → ghi ô tháng (cột H + 2*(tháng-1), +1 nếu Dịch vụ) ở tab KH 2026, tìm dòng theo stt + tên hạng mục (KHÔNG đổi tên hạng mục trong Sheet, sẽ báo "không tìm thấy dòng"). Quyền nhập: admin hoặc nguoi_dung.nhap_tc=true (Thảo). Cấu hình ở bi_mat: kh_token, kh_script_url. Sau khi ghi, cập nhật bản chép kh_dong.
- (v32) SỬA NGHIỆP VỤ nhập chi: Thảo nhập từ PHIẾU ĐỀ NGHỊ THANH TOÁN từng khoản. Ô tháng trong Sheet là CÔNG THỨC cộng tay (=a+b+c) → app CỘNG THÊM "+số" vào công thức, KHÔNG BAO GIỜ ghi đè; ghi chú ô lưu ngày/số tiền/nội dung/người nhập. Chỉ nhập ở các khoản chi cụ thể (dòng nhóm/tổng do Sheet tự cộng). Nguồn BHYT/Dịch vụ chỉ áp dụng cho báo cáo khám chữa bệnh và nguồn thu, KHÔNG áp dụng cho chi (kế toán tự tách).
- BÀI HỌC: cột stt kiểu "6.1" bị Sheet hiểu là NGÀY (serial 46028) → đối chiếu dòng theo tên hạng mục + getDisplayValues; phải kiểm tra ô là công thức hay số trước khi ghi. Lần test v31 đã ghi đè công thức H41 (Tiền thuốc T1) → đã khôi phục "=827835515+59838022". Script chủ: tài khoản tchcbvdk@gmail.com.
- (v35) HỒ SƠ ĐÍNH KÈM khi nhập phiếu: Thảo kéo thả/chọn file (PDF, ảnh, Word, Excel) → Apps Script đọc OCR (Drive API v2, cần bật dịch vụ Drive API) → gợi ý số tiền (ưu tiên dòng "Tổng cộng/Tổng thanh toán") → Thảo kiểm/sửa → bấm Cộng: cộng "+số" vào ô tháng, ghi chú ô = ngày + số + TÊN FILE + link Drive; file chuyển từ "_tam" vào thư mục "Hồ sơ chi phí 2026/<nhóm>.<stt> - <tên khoản>" (vd "IV.2.4 - Bảo trì xe máy"; tự tạo nếu chưa có; chia sẻ sửa cho Linh + Thảo). Chưa bấm Cộng thì file chỉ nằm "_tam". Nhiều hồ sơ cùng tháng → cộng nối tiếp từng số. Thư mục nằm trong Drive của tài khoản chạy script (tchcbvdk).
- (v37) Mẫu hồ sơ: "Giấy đề nghị thanh toán" Mẫu 05-TT (TT 99/2025/TT-BTC) xuất từ Excel ra PDF. Có dòng "Tổng cộng" + "(Số tiền bằng chữ: …)". App đọc số ở dòng Tổng cộng và ĐỐI CHIẾU với số bằng chữ (khớp → "✓ khớp"; lệch → cảnh báo). Chưa lấy số tài khoản/ngân hàng từ phiếu (nhạy cảm, không lưu). Drive API khi thêm vào Apps Script là bản v3 (Drive.Files.create), không phải v2 → script hỗ trợ cả hai.
- (v39) HỒ SƠ THỰC TẾ = file scan nhiều trang (vd 13 trang, HP Scan) gồm: Giấy đề nghị thanh toán (Mẫu 05-TT) + Tờ trình/đề nghị mua sắm + Hóa đơn + báo giá/biên bản... Mỗi tờ có "Tổng cộng" KHÁC nhau (vd tờ trình 8.610.000 chưa trừ giảm giá; DNTT và hóa đơn 8.540.780). QUY TẮC: số tiền cộng vào ô tháng = TỔNG CỘNG TRÊN GIẤY ĐỀ NGHỊ THANH TOÁN (đối chiếu số bằng chữ ngay dưới). Không có DNTT mới dùng số bằng chữ xuất hiện nhiều nhất; cuối cùng mới dùng dòng "Tổng cộng". Bộ đọc chữ dung sai lỗi OCR (so khớp mờ 1 ký tự) và bỏ qua số điện thoại/số tài khoản. Giữ nguyên bài học: không bao giờ tin "max các số".
- (v40) CHỈ ĐỌC TRANG ĐẦU của hồ sơ PDF (trang 1 = Giấy đề nghị thanh toán): app dựng ảnh trang 1 bằng pdf.js (cdnjs 3.11.174) trên máy người dùng, gửi ảnh đó đi đọc chữ; file PDF đầy đủ vẫn được lưu vào thư mục khoản chi. Lý do: file scan 13 trang (~3,6MB) đọc OCR cả file quá chậm/dễ lỗi.
- (v41) PDF có lớp chữ (xuất từ Excel/Word): app lấy chữ trang 1 ngay trên máy (pdf.js getTextContent) → không cần OCR, tức thì. PDF scan/ảnh: gửi ảnh trang 1 cho Google OCR (≈30-60 giây). Đã thử OCR thật: Google đọc đúng 11.580.000 khớp số bằng chữ.
