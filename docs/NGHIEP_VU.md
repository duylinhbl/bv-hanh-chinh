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
**Báo cáo tuần (v43):** APP TỰ GỬI, không còn là scheduled task của Claude (trigger cũ trig_01LfHDUW… đã TẮT, đừng bật lại kẻo gửi trùng). Edge Function `bao-cao-tuan` chạy pg_cron 15:00 giờ VN thứ 5 (08:00 UTC; thử lại 15:30 nếu lỗi, tự bỏ qua nếu tuần đó đã gửi — bảng `bc_tuan_log`). Lấy `lich_cong_tac` (huy=false, rieng_tu=false) tuần thứ 2–6 này + tuần sau, rút 1 dòng/lịch bằng quy tắc (sự kiện → "Tham dự…", việc khác → "Thực hiện…", bỏ giờ/thành phần, gộp trùng), kế hoạch luôn kết thúc "- Duy trì công tác tiếp nhận cấp cứu, khám chữa bệnh.", tuần trống ghi Duy trì. Mẫu Word có ô {{...}} là file Drive "MAU BAO CAO CONG TAC TUAN.docx" (id trong apps-script/BaoCaoTuan.gs) → Apps Script (tchcbvdk) trả mẫu (`bc_mau`) và gửi thư (`bc_gui`: MailApp, bcc duylinhbl, lưu bản sao vào thư mục Drive 139jl…) tới vanphong@caosudautieng.com.vn, tiêu đề "Bệnh viện đa khoa". Thành công/lỗi đều báo push cho quản trị. Tắt: bi_mat `bc_tuan_tat`='1'; đổi người nhận: `bc_tuan_to` (phải nằm trong BC_NGUOI_NHAN_HOP_LE của Apps Script). Gọi tay (quản trị): body {dry:true} xem trước, {force:true} gửi lại. Lưu ý: lịch nhập SAU 15h thứ 5 sẽ không vào báo cáo tuần đó. Đã chạy thật 12/11 lúc 14:03 (3 việc, ok). Mã nguồn edge function chỉ nằm trên Supabase; BaoCaoTuan.gs nằm trong Apps Script, chưa có trong repo GitHub.
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
- Nguồn: Google Sheet "Bảng thu chi - bệnh viện đa khoa" (chủ sở hữu Thảo, shared with Linh). Đã nạp tab "KH 2026" → bảng `kh_dong` (104 dòng, có số đến tháng 10/2026; `thang` = BHYT/tháng, `thang_dv` = dịch vụ).
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

## v42 – Rà soát hệ thống & gia cố (12/11/2026)
**Bảo mật DB (đã vá, đã kiểm chứng):**
- View `danh_ba` chỉ còn SELECT (trước đó nhân viên thường sửa được tên/chức vụ người khác qua view). Mọi bảng: anon không ghi, authenticated không TRUNCATE.
- `tg_push_*` không ai gọi trực tiếp được; `vn_num/vn_arr` cố định search_path.
- Policy FOR ALL tách thành insert/update/delete (SELECT chỉ 1 policy); RLS dùng `(select auth.uid())`; 15 FK có index.
- Quy tắc: tạo VIEW mới phải `security_invoker` hoặc chỉ GRANT SELECT; không bao giờ để view DEFINER cập nhật được.
- Việc còn lại phải làm tay (Dashboard Supabase): bật *Leaked password protection*.

**Tài chính – độ tin cậy:**
- Apps Script v2: khóa `LockService` (2 người ghi cùng lúc không mất số), **mã phiếu `rq`** chống ghi trùng (bấm lại/mất mạng không cộng đôi), tab **"Nhật ký app"** trong Sheet ghi mọi lần cộng/hoàn tác (chỉ thêm dòng), **hoàn tác** phiếu (chỉ khi ô tháng chưa bị sửa tay sau đó; hồ sơ chuyển sang `_da_huy`, không xóa), **mã dòng cố định** (developer metadata `kh_id` gắn vào dòng Sheet → chèn/đổi tên dòng không ghi nhầm), kiểm lại số sau khi ghi, tự dọn `_tam` > 2 ngày (chạy `caiTrigger()` một lần).
- Sheet là nguồn gốc; `kh_dong` chỉ là bản sao. Hàm `kh-dong-bo` đọc lại Sheet (cron 15 phút 6h–20h + nút "Làm mới từ Sheet"), ghi `kh_bo_log`. Chỉ cập nhật dòng đã có dữ liệu tháng (không tạo số cho dòng cha/tổng).
- `kh-ghi` chỉ tự thử lại khi `bi_mat.kh_script_v2='1'` (Apps Script đã có chống ghi trùng).

**Vận hành:** bảng `loi_app` nhận lỗi JS từ app (admin xem); `sao-luu` xuất JSON 23 bảng vào bucket private `sao-luu` mỗi đêm 03:00 (giữ 30 bản; chưa gồm ảnh bucket `anh`); `tools/bump.sh` tăng phiên bản đồng bộ 3 nơi, `tools/kiemtra.sh` kiểm cú pháp + phiên bản; báo cáo tuần: lỗi thì push cho quản trị (xem mục Báo cáo tuần).

## Kiểm thử tự động (v42)
- **Trong DB** (`select * from kiem_thu()`): 23 bài – cấu trúc (RLS, quyền, search_path, FK, cron, sao lưu, đồng bộ Sheet) + phân quyền thật bằng cách đóng vai nhân viên thường / trưởng khoa / BGĐ / TCHC / người nhập TC / người xếp lịch (mọi thay đổi trong test đều hoàn lại). `kiem_thu_va_bao()` chạy 03:30 mỗi đêm, ghi `kiem_thu_log`, có lỗi thì push cho quản trị. **Sau mỗi migration phải chạy lại.**
- **Phía app** (`tests/chay_tat_ca.sh`): cú pháp + phiên bản đồng bộ, đọc số tiền hồ sơ, ghi/hoàn tác/chống trùng Sheet (Sheet giả lập), giao diện nhập chi phí (playwright). GitHub Actions tự chạy mỗi lần push (`.github/workflows/kiem-thu.yml`).
- Quy tắc: thêm tính năng/ sửa lỗi mới → thêm 1 bài kiểm thử tương ứng.
- Chính sách xem thông báo (`tb_xem`): chỉ người phát, BGĐ/TCHC và người nhận (do người phát chọn toàn viện hoặc theo khoa) thấy; kiểm thử D1/D2 bảo vệ quy tắc này.

## v43 – Thông báo đẩy đáng tin cậy (12/11/2026)
- Nguyên nhân mất thông báo: đăng ký push hết hạn bị máy chủ xóa (404/410) nhưng app vẫn báo "đang bật" nên không đăng ký lại; đa số nhân viên chưa bật; lỗi gửi không được ghi.
- App: `dongBoPush()` tự đăng ký lại khi đăng nhập/mở lại app (6 giờ/lần) và khi SW báo `pushsubscriptionchange`.
- Form giao việc: hiện "đã bật thông báo (n máy)" hoặc cảnh báo chưa bật (RPC `so_may_push`); sau khi giao cũng cảnh báo.
- Tab Tôi (TCHC/BGĐ): danh sách "Ai chưa bật thông báo" (RPC `ds_chua_bat_push`).
- Edge `gui-push` v2: thử lại 1 lần, ghi bảng `push_log` (ok / loi / het_han / khong_may); SW: thông báo việc giữ trên màn hình đến khi chạm (requireInteraction), rung.

## Đề án chuyển đổi số BVĐK (11/2026)
- Hai cuốn trong Drive nhóm 21.CNTT CHUYỂN ĐỔI SỐ: bản 2023 (Finish) và bản 2026 (file gốc "1011_"). Quy tắc: KHÔNG ghi đè, luôn tạo file mới cạnh file cũ.
- Nhân sự: 2023 còn sếp Hưng; 2026 sếp đã về hưu, chỉ còn Nữ và Linh; 2026 bỏ Bình Dương, mốc tháng 11/2026; 2023 mốc tháng 9. Bản 2026 có ghi chú "cập nhật theo thực tế".
- Đã làm: bìa cho cả 2 cuốn (xanh #1B6B3A + vàng đồng #B8892B, logo BV); bản 2026 cập nhật theo báo cáo + báo giá, thêm 4 phụ lục, chuẩn font Times New Roman 13. File mới nhất 2026: "1112_đề án cđs bvđk 2026 (chuẩn font TNR 13, có bìa, có phụ lục).docx" (id 1rm3raN-uzipMXCa8GP5fJmnRFesKs8bG); 2023 có bìa: id 11K_O9Xpo1qnyPxm08CUqY6944aCXYivS.
- Số đã kiểm khớp báo giá: phần mềm 300.141.200; hạ tầng 2.021.379.000; ATTT 280.280.000; VAT 8% 202.456.734; dự phòng 132.449.459; tổng 2.983.895.370. Báo giá hiệu lực 30 ngày từ 21/10/2026 (~20/11/2026); từ 01/01/2027 VAT 10% (+≈50,6 triệu).
- Còn tồn: Word phải Update Field để cập nhật mục lục; tên mục lục chưa đổi; bảng kế hoạch mới có hàng nhóm hẹp; bản 2023 chưa chuẩn font; Phần II.I còn số liệu Bình Dương 2023.

## Báo cáo tháng (đã tạo lịch, chạy thử 13/11/2026)
- Cách anh Linh vẫn gửi mỗi tháng (ngày 1–3, tiêu đề "Bệnh viện đa khoa"), gồm 2 thư: (1) tới binh_hc@yahoo.com (ông Hồng Chí Bình) + khdt@caosudautieng.com.vn, kèm "Báo cáo công tác tháng N - BVĐK.docx", nội dung "Bệnh viện đa khoa kính gửi Ông Hồng Chí Bình Báo cáo tháng N và phương hướng tháng N+1 của Bệnh viện / Trân trọng,"; (2) chỉ tới khdt@ (Phòng QLĐT&XD dùng chung hộp thư này), kèm "1. Tổng hợp - Bao cao thuc hien ke hoach den thang N nam 2026 (QLĐT&XD).docx", nội dung "…kính gửi Báo cáo thực hiện kế hoạch đến hết tháng N của Bệnh viện".
- Scheduled task trig_01H5i11o5Zj2xa5m146UgdSu: ngày 2 hằng tháng 08:45 giờ VN. QUYẾT ĐỊNH của Linh (13/11): thư 1 (ông Bình + khdt, báo cáo công tác) tạo NHÁP tháng đầu (12/2026), từ 01/2027 tự gửi thẳng; thư 2 (Tổng hợp, riêng khdt) tạo NHÁP 2 tháng đầu (12/2026, 01/2027), từ 02/2027 tự gửi thẳng; có cảnh báo/bất thường thì luôn chỉ tạo nháp. Mỗi lần có mail báo về duylinhbl@gmail.com; lỗi thì mail "⚠ Báo cáo tháng chưa soạn được". Muốn tự gửi thẳng thì đổi bước 4 sau khi ổn vài tháng. Chạy thử đầu tiên (M=10) 13/11, kết quả xem hộp thư.
- Phát hiện từ so sánh Tổng hợp tháng 9 và 10: mỗi tháng chỉ đổi 1 bảng của Bệnh viện (các hàng Sửa chữa kiến trúc, Điện, Nước, Thuốc/VTYT/hóa chất, Khám bệnh, Điều trị, Tổng) + tiêu đề cột; số lấy từ "kế hoạch .xlsx" (Drive id 1x0fyIAkP7sa3rnyVihKfo6nrxkU7uWKB) do anh Linh tự cập nhật đầu tháng (có số kWh, m³ mà app không có). Tiêu đề cột "Thực hiện đến tháng 9/2026" bị bỏ sót, không đổi sang tháng 10.
- Khám bệnh/Điều trị trong xlsx khớp tổng trong app (58.993 / 4.030). Thuốc/VTYT lệch: xlsx 14.247.222.275 vs ô "Sử dụng" trong Sheet 14.077.009.143; ô này của dòng 6.2 mới cộng đến tháng 9 (thiếu tháng 10 = 64.861.381+125.185.450).

## v44 – Đính kèm Word/Excel khi giao việc (13/11/2026)
- Ngoài ảnh, được đính kèm .doc/.docx/.xls/.xlsx (tối đa 10 MB, kiểm cả phía app và bucket `anh`) ở 2 chỗ: (1) form Giao việc — người giao đính kèm tài liệu (cột `viec.file_path/file_ten`); (2) Cập nhật hiện trạng — người nhận gửi file (cột `cap_nhat_hien_trang.file_path/file_ten`, vẫn qua hàng đợi offline). Tên file lưu trên Storage là mã ngẫu nhiên, tên gốc ở `file_ten`; mở bằng đường dẫn ký 1 giờ.
- Policy upload `anh_them`: cả người giao lẫn người nhận việc được tải vào thư mục `<viec_id>/`. Bucket giới hạn mime Word/Excel/ảnh. Chưa nhận PDF (chưa được yêu cầu).
- Chưa có bài kiểm thử riêng cho đính kèm (nên thêm).

## Quy tắc mục "phương hướng/kế hoạch" của báo cáo tuần và tháng (13/11/2026)
- Một dòng cố định "- Duy trì công tác tiếp nhận cấp cứu, khám chữa bệnh." + các sự kiện anh Linh/Thảo đã ghi sẵn trong lịch công tác của app cho tuần/tháng sau (vd 26/11 KSK Leading, PTEC; 01/12 KSK định kỳ lần 2 Cty CP Cao su Bà Rịa). Không tự thêm việc ngoài lịch. Muốn có gì trong phương hướng thì ghi vào lịch công tác trước giờ chạy (tuần: 15h thứ 5; tháng: 08:45 ngày 2).
- Số liệu kế hoạch-sử dụng còn lệch (điều trị 4.050 vs 4.030, thuốc/VTYT) là do chưa nhập đủ; anh Linh sẽ báo khi nhập xong để rà lại.

## v45 – Xem file Excel/Word ngay trong app + bản đồ vị trí (13/11/2026)
- Nút "👁 Xem" cạnh file đính kèm (ở việc và ở từng cập nhật): Excel (.xlsx/.xls) hiện thành bảng có tab từng sheet (tối đa 1000 dòng × 40 cột), Word (.docx) hiện nội dung; .doc cũ chỉ tải. Dùng SheetJS 0.18.5 + mammoth 1.4.2 nạp từ cdnjs khi mở file (không tải trước). HTML đã lọc script/on*/javascript:.
- Vị trí: cập nhật có GPS hiện bản đồ OpenStreetMap ngay trong dòng + nút mở Google Maps + sai số; không có GPS thì hiện cảnh báo kèm LÝ DO (chưa cho phép định vị / hết thời gian chờ…). Cột mới `vi_tri_loi`, `do_chinh_xac`. GPS thử độ chính xác cao 10 giây rồi tự hạ mức 10 giây. Phần lớn cập nhật trước đây không có vị trí vì máy không cho phép định vị hoặc hết thời gian chờ 8 giây.
- Chưa làm: trợ lý AI trên file (cần khóa Anthropic API đặt trong Supabase; xem thiết kế dưới).
- Thiết kế AI trên file: Edge Function `ai-file` đọc file (Excel→CSV theo sheet, Word→chữ), nhận câu hỏi của anh Linh dạng chat, gọi Claude, lưu lịch sử vào bảng `file_chat`; trả lời có công thức/phép tính; sau đó soạn tờ trình/quyết định thành file Word lưu lại trong việc. Chỉ quản trị/TCHC dùng.

**Trợ lý AI trên file (v46):** trong trình xem file Excel/Word (👁 Xem) có khung "🤖 Hỏi AI về tệp này": tóm tắt, soát số liệu, tính toán (Gemini tự chạy mã), viết công thức Excel, soạn tờ trình/quyết định, nút ⬇ Tải Word. Động cơ: Gemini gói miễn phí (user chọn, KHÔNG giới hạn/không chặn dữ liệu vì văn bản phòng không mật). Edge Function `ai-file` (verify_jwt=false, tự kiểm quyền: người dùng phải xem được việc theo RLS và tệp thuộc việc đó; mã nguồn ở supabase/functions/ai-file/index.ts). Khóa: Edge Function Secret `GEMINI_API_KEY` (user tự dán, không gửi qua chat). bi_mat tùy chọn: ai_model (mặc định gemini-2.5-flash), ai_code='0' tắt chạy mã, ai_tat='1' tắt hẳn. Hội thoại lưu bảng `file_chat` theo (việc, tệp, người hỏi). Chỉ đọc .xlsx/.docx (đời cũ .doc/.xls chưa đọc được). Gói miễn phí: Google có thể dùng nội dung để cải thiện sản phẩm, hạn mức dùng chung cả dự án (báo "hết hạn mức" thì thử lại sau). Claude (trả phí) để dành thêm sau cho văn bản quan trọng.

## Soạn văn bản theo mẫu bệnh viện (v48)
- (v53) Luồng 1 màn hình: 👁 Xem file > nút xanh "Soạn tờ trình / quyết định từ file này" > AI tự gợi ý loại + viết sẵn ý chính (action `goi_y`) > người dùng sửa ý > Soạn > Xem / Chỉnh lại > 💾 Lưu (Drive nếu cầu nối sẵn sàng, không thì lưu trong app) > ✔ Kết thúc. Khung Word mẫu đặt ở thư mục `mau/` của repo (GitHub Pages), function lấy từ đó, Apps Script chỉ còn dùng để lưu Drive.
- (v49, cũ) Luồng: mở file Excel/Word của việc (👁 Xem) > khung AI > "📝 Soạn tờ trình / quyết định theo mẫu BV": tích chọn loại (bảng `mau_van_ban`, 6 mẫu), nhập ý, AI đọc tệp + ý rồi bấm "Tải Word" hoặc "Lưu vào Drive". Chi tiết việc chỉ còn danh sách văn bản đã soạn, loại công việc và nút Kết thúc. Giao việc có chọn "Loại công việc" (`viec.loai_cv`, bảng `loai_cong_viec`); người giao đổi được trong khung này.
- Edge Function `soan-mau` (actions soan / luu / tai): Gemini (model theo `bi_mat.ai_model`, hiện `gemini-flash-lite-latest`) viết thân văn bản, ghép vào khung Word gốc (giữ quốc hiệu, bảng, chữ ký). Kết quả lưu storage `anh/<viec>/vb-*.docx` và bảng `van_ban_viec`.
- Khung mẫu (docx + json) nằm Drive: thư mục "Văn bản soạn từ app" > "_mau" (id 1EM4CbhTyt9fazJ8GamFg0QNHwFkQm9eP). Tạo khung từ file gốc bằng `tools/gan_mau.py <thư mục nguồn> <thư mục ra>`. Muốn thêm mẫu: gắn khung, đưa 2 file `<ma>.docx` + `<ma>.json` vào `_mau`, thêm dòng vào `mau_van_ban`.
- Lưu Drive: Apps Script `apps-script/VanBan.gs` (vb_mau_lay, luu_van_ban). Thư mục đích: `loai_cong_viec.drive_folder_id` nếu có, không thì "Văn bản soạn từ app" > tên loại > tên việc.
- Nút "Kết thúc việc" (chỉ người giao): ghi cập nhật `da_dong` như "Xác nhận đóng việc".


## Cập nhật 13/11/2026 (v60)
- Nhập phiếu chi: thả/chọn file → HIỆN NGAY bản xem (PDF vẽ bằng pdf.js tối đa 8 trang, ảnh hiện trực tiếp, Word/Excel chỉ có link mở) → người dùng TỰ GÕ số tiền (không tự điền). Số đọc từ OCR chỉ là nút gợi ý bấm để dùng. File vẫn được tải lên "_tam" nền để Cộng xong chuyển vào thư mục hồ sơ.
- Nhắc việc (`nhac_viec`, pg_cron 10 phút): mọi việc chưa đóng có hạn — trước 3 ngày, 1 ngày, 1 giờ, lúc quá hạn, rồi 8h sáng mỗi ngày tới khi đóng (báo cả người giao); việc "Chờ xác nhận" nhắc người giao. Giao việc bắt buộc có hạn; việc cũ chưa có hạn có nút "Đặt hạn" ở chi tiết.
- Cập nhật hiện trạng: một ô "Ảnh hoặc file Word/Excel".
- Soạn văn bản (soan-mau v8): mẫu Quyết định theo văn bản BV (gạch ngang, "Điều N:", Xét đề nghị tại Tờ trình…), bảng đủ cột, khung xem Word hiển thị spacing/indent. Lưu Drive qua VanBan.gs: nếu tài khoản chạy script không mở được thư mục gốc thì tự tạo "Văn bản soạn từ app" và chia sẻ sửa cho duylinhbl@gmail.com.

### Cập nhật 13/11/2026 (v61) – AI tự xếp hạng mục khi thả hồ sơ
- Thả PDF/ảnh vào "Nhập phiếu đề nghị thanh toán": app đọc phiếu (text pdf.js hoặc ảnh trang đầu), kh-ghi action `phan_loai` (Gemini) chọn hạng mục + số tiền + tháng, tự điền vào thẻ hồ sơ.
- Người dùng chỉ xem PDF, đối chiếu rồi bấm Cộng; có thể đổi hạng mục/tháng/số tiền ngay trong thẻ. Nhiều hồ sơ khác hạng mục được ghi riêng từng hạng mục, hoàn tác theo từng phiếu.
