// Trợ lý việc: đọc hồ sơ trong Drive (CHỈ ĐỌC, không ghi gì vào thư mục được chia sẻ).
// Dán đè toàn bộ file này vào CÙNG dự án Apps Script đang có hàm doPost, hàm chuyen và hằng TOKEN.
// Trong doPost (ngay sau dòng kiểm tra b.token) chỉ cần MỘT dòng, thay cho 3 dòng dc_who/dc_ds/dc_lay cũ:
//   if (/^dc_/.test(b.action)) return out(dcRoute(b));
// Rồi: Triển khai > Quản lý bản triển khai > Sửa > Phiên bản: Mới > Triển khai.

const DC_TOI_DA_FILE = 400;
const DC_TOI_DA_BYTE = 10 * 1024 * 1024; // PDF/ảnh/Word lớn hơn mức này không gửi cho AI
const DC_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function dcRoute(b) {
  if (b.action === 'dc_who') return dcWho();
  if (b.action === 'dc_con') return dcCon(b);
  if (b.action === 'dc_ds') return dcDs(b);
  if (b.action === 'dc_lay') return dcLay(b);
  if (b.action === 'dc_tho') return dcTho(b);
  return { ok: false, loi: 'Thao tác dc không hợp lệ' };
}
function dcId(x) { return String(x || '').replace(/[^A-Za-z0-9_-]/g, ''); }
function dcWho() {
  return { ok: true, email: Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || '' };
}
// Chỉ cho đọc những gì nằm TRONG các thư mục gốc được phép (b.goc: danh sách id do máy chủ gửi)
function dcTrong(item, goc) {
  if (!goc || !goc.length) return false;
  const ok = {}; goc.forEach(function (g) { ok[dcId(g)] = 1; });
  if (ok[item.getId()]) return true;
  let lop = [item];
  for (let i = 0; i < 8 && lop.length; i++) {
    const ke = [];
    for (let k = 0; k < lop.length; k++) {
      const ps = lop[k].getParents();
      while (ps.hasNext()) { const p = ps.next(); if (ok[p.getId()]) return true; ke.push(p); }
    }
    lop = ke;
  }
  return false;
}
function dcMoThuMuc(b) {
  const id = dcId(b.folder_id);
  if (!id) return { loi: 'Thiếu mã thư mục' };
  let fd;
  try { fd = DriveApp.getFolderById(id); fd.getName(); } catch (e) {
    return { loi: 'Chưa mở được thư mục. Hãy chia sẻ thư mục cho tài khoản chạy script (quyền Người xem).', chua_chia_se: true };
  }
  if (!dcTrong(fd, b.goc)) return { loi: 'Thư mục này nằm ngoài danh mục loại việc' };
  return { fd: fd };
}
function dcMoFile(b) {
  let f;
  try { f = DriveApp.getFileById(dcId(b.file_id)); f.getName(); } catch (e) { return { loi: 'Không mở được file' }; }
  if (!dcTrong(f, b.goc)) return { loi: 'File này nằm ngoài danh mục loại việc' };
  return { f: f };
}

// Duyệt 1 tầng: {folder_id, goc} -> {ok, ten, thu_muc:[{id,ten}], files:[{id,ten,mime,size,sua}]}
function dcCon(b) {
  const m = dcMoThuMuc(b); if (m.loi) return { ok: false, loi: m.loi, chua_chia_se: !!m.chua_chia_se };
  const thu = [], files = [];
  const s = m.fd.getFolders(); while (s.hasNext() && thu.length < 200) { const c = s.next(); thu.push({ id: c.getId(), ten: c.getName() }); }
  const it = m.fd.getFiles(); while (it.hasNext() && files.length < 300) { const f = it.next(); files.push({ id: f.getId(), ten: f.getName(), mime: f.getMimeType(), size: f.getSize(), sua: f.getLastUpdated().toISOString() }); }
  const ss = function (a, c) { return a.ten.localeCompare(c.ten, 'vi', { numeric: true }); };
  return { ok: true, id: m.fd.getId(), ten: m.fd.getName(), thu_muc: thu.sort(ss), files: files.sort(ss) };
}

// Liệt kê cả cây: {folder_id, goc} -> {ok, ten, files:[{id,ten,duong_dan,mime,size,sua}]}
function dcDs(b) {
  const m = dcMoThuMuc(b); if (m.loi) return { ok: false, loi: m.loi, chua_chia_se: !!m.chua_chia_se };
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
  })(m.fd, '', 0);
  return { ok: true, ten: m.fd.getName(), files: files, cat: files.length >= DC_TOI_DA_FILE };
}

// Chuyển tạm sang Google Docs/Sheets để lấy chữ (bản tạm nằm ở Drive của tài khoản chạy script và bị xóa ngay)
function dcChu(blob, mime) {
  const laBang = /spreadsheetml|ms-excel/.test(mime);
  let res = null, loi = '';
  try {
    res = chuyen(blob, laBang ? 'application/vnd.google-apps.spreadsheet' : 'application/vnd.google-apps.document', false);
    for (let k = 0; k < 4; k++) {
      try {
        if (laBang) {
          let t = '';
          SpreadsheetApp.openById(res.id).getSheets().forEach(function (s) { t += '## ' + s.getName() + '\n' + s.getDataRange().getDisplayValues().map(function (r) { return r.join(' | '); }).join('\n') + '\n'; });
          return t;
        }
        return DocumentApp.openById(res.id).getBody().getText();
      } catch (e) { loi = String(e); Utilities.sleep(1500 * (k + 1)); }
    }
    throw new Error(loi);
  } finally {
    if (res && res.id) { try { DriveApp.getFileById(res.id).setTrashed(true); } catch (x) {} }
  }
}

// {file_id, goc} -> {ok, kieu:'text', text} | {ok, kieu:'docx', b64} | {ok, kieu:'b64', mime, b64} | {ok, kieu:'bo_qua', ly_do}
function dcLay(b) {
  const m = dcMoFile(b); if (m.loi) return { ok: false, loi: m.loi };
  const f = m.f, id = f.getId(), mime = f.getMimeType(), MAX_TEXT = 40000;
  const lon = function () { return { ok: true, kieu: 'bo_qua', ly_do: 'File ' + Math.round(f.getSize() / 1048576) + ' MB, lớn hơn giới hạn ' + Math.round(DC_TOI_DA_BYTE / 1048576) + ' MB' }; };
  if (mime === 'application/vnd.google-apps.document') return { ok: true, kieu: 'text', text: DocumentApp.openById(id).getBody().getText().slice(0, MAX_TEXT) };
  if (mime === 'application/vnd.google-apps.spreadsheet') {
    let t = '';
    SpreadsheetApp.openById(id).getSheets().forEach(function (s) { t += '## ' + s.getName() + '\n' + s.getDataRange().getDisplayValues().map(function (r) { return r.join(' | '); }).join('\n') + '\n'; });
    return { ok: true, kieu: 'text', text: t.slice(0, MAX_TEXT) };
  }
  if (mime === DC_DOCX) { // Word đời mới: gửi nguyên file, máy chủ tự đọc (nhanh, không cần chuyển đổi)
    if (f.getSize() > DC_TOI_DA_BYTE) return lon();
    return { ok: true, kieu: 'docx', b64: Utilities.base64Encode(f.getBlob().getBytes()) };
  }
  if (/msword|spreadsheetml|ms-excel/.test(mime)) {
    if (f.getSize() > DC_TOI_DA_BYTE) return lon();
    return { ok: true, kieu: 'text', text: String(dcChu(f.getBlob(), mime)).slice(0, MAX_TEXT) };
  }
  if (/^text\//.test(mime)) return { ok: true, kieu: 'text', text: f.getBlob().getDataAsString().slice(0, MAX_TEXT) };
  if (mime === 'application/pdf' || /^image\/(jpeg|png|webp)$/.test(mime)) {
    if (f.getSize() > DC_TOI_DA_BYTE) return lon();
    return { ok: true, kieu: 'b64', mime: mime, b64: Utilities.base64Encode(f.getBlob().getBytes()) };
  }
  return { ok: true, kieu: 'bo_qua', ly_do: 'Loại file chưa hỗ trợ (' + mime + ')' };
}

// Lấy file MẪU dạng .docx để AI điền: {file_id, goc} -> {ok, ten, b64}
function dcTho(b) {
  const m = dcMoFile(b); if (m.loi) return { ok: false, loi: m.loi };
  const f = m.f, mime = f.getMimeType();
  if (mime !== DC_DOCX) return { ok: false, loi: 'Mẫu phải là file Word .docx. File này là "' + f.getName() + '": hãy mở bằng Word, Lưu thành .docx rồi để vào thư mục.' };
  if (f.getSize() > DC_TOI_DA_BYTE) return { ok: false, loi: 'File mẫu quá lớn (trên 10 MB)' };
  return { ok: true, ten: f.getName(), b64: Utilities.base64Encode(f.getBlob().getBytes()) };
}
