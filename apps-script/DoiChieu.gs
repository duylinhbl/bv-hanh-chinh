// Đối chiếu báo cáo với hồ sơ trong thư mục Drive. Dán thêm vào CÙNG dự án Apps Script đang có hàm doPost, hàm layChu và hằng TOKEN.
// Sau khi dán: thêm 3 dòng vào doPost (ngay sau dòng kiểm tra b.token), rồi Triển khai > Quản lý bản triển khai > Sửa > Phiên bản: Mới > Triển khai.
//   if (b.action === 'dc_who') return out(dcWho());
//   if (b.action === 'dc_ds') return out(dcDs(b));
//   if (b.action === 'dc_lay') return out(dcLay(b));
// Thư mục hồ sơ phải được chia sẻ (quyền Người xem) cho tài khoản Google đang chạy script này. Email của tài khoản đó app sẽ hiện sẵn.

const DC_TOI_DA_FILE = 400;
const DC_TOI_DA_BYTE = 10 * 1024 * 1024; // PDF/ảnh lớn hơn mức này không gửi cho AI

function dcWho() {
  return { ok: true, email: Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || '' };
}

// {folder_id} -> {ok, ten, files:[{id,ten,duong_dan,mime,size,sua}]}
function dcDs(b) {
  const id = String(b.folder_id || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) return { ok: false, loi: 'Thiếu mã thư mục' };
  let goc;
  try { goc = DriveApp.getFolderById(id); } catch (e) {
    return { ok: false, loi: 'Chưa mở được thư mục. Hãy chia sẻ thư mục cho tài khoản chạy script (quyền Người xem).', chua_chia_se: true };
  }
  const files = [];
  (function duyet(fd, duong, sau) {
    if (files.length >= DC_TOI_DA_FILE || sau > 4) return;
    const it = fd.getFiles();
    while (it.hasNext() && files.length < DC_TOI_DA_FILE) {
      const f = it.next();
      files.push({ id: f.getId(), ten: f.getName(), duong_dan: duong, mime: f.getMimeType(), size: f.getSize(), sua: f.getLastUpdated().toISOString() });
    }
    const sub = fd.getFolders();
    while (sub.hasNext()) { const c = sub.next(); duyet(c, duong ? duong + '/' + c.getName() : c.getName(), sau + 1); }
  })(goc, '', 0);
  return { ok: true, ten: goc.getName(), files: files, cat: files.length >= DC_TOI_DA_FILE };
}

// {file_id} -> {ok, kieu:'text', text} | {ok, kieu:'b64', mime, b64} | {ok, kieu:'bo_qua', ly_do}
function dcLay(b) {
  const id = String(b.file_id || '').replace(/[^A-Za-z0-9_-]/g, '');
  let f;
  try { f = DriveApp.getFileById(id); } catch (e) { return { ok: false, loi: 'Không mở được file' }; }
  const mime = f.getMimeType();
  const MAX_TEXT = 40000;
  if (mime === 'application/vnd.google-apps.document') return { ok: true, kieu: 'text', text: DocumentApp.openById(id).getBody().getText().slice(0, MAX_TEXT) };
  if (mime === 'application/vnd.google-apps.spreadsheet') {
    let t = '';
    SpreadsheetApp.openById(id).getSheets().forEach(function (s) { t += '## ' + s.getName() + '\n' + s.getDataRange().getDisplayValues().map(function (r) { return r.join(' | '); }).join('\n') + '\n'; });
    return { ok: true, kieu: 'text', text: t.slice(0, MAX_TEXT) };
  }
  if (/wordprocessingml|msword|spreadsheetml|ms-excel/.test(mime)) {
    if (f.getSize() > 15 * 1024 * 1024) return { ok: true, kieu: 'bo_qua', ly_do: 'File Word/Excel quá lớn' };
    return { ok: true, kieu: 'text', text: String(layChu(f.getBlob(), mime)).slice(0, MAX_TEXT) };
  }
  if (/^text\//.test(mime)) return { ok: true, kieu: 'text', text: f.getBlob().getDataAsString().slice(0, MAX_TEXT) };
  if (mime === 'application/pdf' || /^image\/(jpeg|png|webp)$/.test(mime)) {
    if (f.getSize() > DC_TOI_DA_BYTE) return { ok: true, kieu: 'bo_qua', ly_do: 'File ' + Math.round(f.getSize() / 1048576) + ' MB, lớn hơn giới hạn ' + Math.round(DC_TOI_DA_BYTE / 1048576) + ' MB' };
    return { ok: true, kieu: 'b64', mime: mime, b64: Utilities.base64Encode(f.getBlob().getBytes()) };
  }
  return { ok: true, kieu: 'bo_qua', ly_do: 'Loại file chưa hỗ trợ (' + mime + ')' };
}
