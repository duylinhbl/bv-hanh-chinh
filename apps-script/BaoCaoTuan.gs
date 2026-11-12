// Thêm vào Apps Script hiện có (cùng dự án với CauNoi_BangThuChi.gs, tài khoản tchcbvdkcsdt@gmail.com), rồi Triển khai > Quản lý bản triển khai > Sửa > Phiên bản mới.
// 1) Trong doPost(), ngay sau dòng kiểm tra token, thêm 2 dòng:
//      if (b.action === 'bc_mau') return out(bcMau());
//      if (b.action === 'bc_gui') return out(bcGui(b));
// 2) Chia sẻ file "MAU BAO CAO CONG TAC TUAN.docx" (và thư mục báo cáo, quyền Chỉnh sửa) cho tchcbvdkcsdt@gmail.com.
// 3) Lần đầu chạy thử hàm bcCapQuyen() trong trình soạn thảo để Google xin quyền Gmail (MailApp) + Drive.
const BC_MAU_ID = '1nI4i3s6HQ0EcCILjezM5hYsz0t-PMPpI';      // MAU BAO CAO CONG TAC TUAN.docx (có các ô {{...}})
const BC_THU_MUC = '1VhAksV8C_GfX6EHC6n5tr4OG1WAQQVkZ';      // nơi lưu báo cáo đã gửi: 18.BÁO CÁO CHUYÊN ĐỀ - ĐỊNH KỲ / 2026 / TCHC / Báo cáo
const BC_NGUOI_NHAN_HOP_LE = ['vanphong@caosudautieng.com.vn', 'duylinhbl@gmail.com']; // chỉ gửi tới các địa chỉ này

function bcMau() {
  try {
    const f = DriveApp.getFileById(BC_MAU_ID);
    return { ok: true, b64: Utilities.base64Encode(f.getBlob().getBytes()) };
  } catch (err) { return { ok: false, loi: 'Không đọc được mẫu Word (đã chia sẻ cho tài khoản chạy script chưa?): ' + err }; }
}

function bcGui(b) {
  try {
    if (BC_NGUOI_NHAN_HOP_LE.indexOf(String(b.to).toLowerCase()) < 0) return { ok: false, loi: 'Địa chỉ nhận không nằm trong danh sách cho phép' };
    const blob = Utilities.newBlob(Utilities.base64Decode(b.b64), b.mime, b.filename);
    if (blob.getBytes().length < 20000) return { ok: false, loi: 'File Word quá nhỏ, nghi lỗi' };
    const opt = { attachments: [blob], name: 'Bệnh viện đa khoa Cao su Dầu Tiếng', replyTo: b.reply_to || '' };
    if (b.bcc && BC_NGUOI_NHAN_HOP_LE.indexOf(String(b.bcc).toLowerCase()) >= 0) opt.bcc = b.bcc;
    MailApp.sendEmail(b.to, b.subject, b.body, opt);
    let luu = false;
    try { DriveApp.getFolderById(BC_THU_MUC).createFile(blob); luu = true; } catch (err) { /* thư mục chưa chia sẻ: thư vẫn đã gửi */ }
    return { ok: true, luu_drive: luu };
  } catch (err) { return { ok: false, loi: String(err) }; }
}

function bcCapQuyen() { DriveApp.getFileById(BC_MAU_ID).getName(); MailApp.getRemainingDailyQuota(); }
