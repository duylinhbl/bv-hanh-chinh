// Soạn văn bản theo mẫu: lấy khung mẫu + lưu văn bản vào Drive. Dán thêm vào CÙNG dự án Apps Script đang có hàm doPost và hằng TOKEN.
// Sau khi dán: Triển khai > Quản lý bản triển khai > Sửa (biểu tượng bút) > Phiên bản: Mới > Triển khai.
const VB_GOC = '1LNNj0k0urwS-aG-GFeKrEbJ2LtRFYTZr'; // thư mục "Văn bản soạn từ app"
const VB_MAU = '1EM4CbhTyt9fazJ8GamFg0QNHwFkQm9eP';  // thư mục "_mau" (khung Word + json)

// Thư mục gốc: nếu tài khoản chạy script không mở được thư mục cũ (do thư mục nằm trong Drive của người khác)
// thì tự tạo thư mục cùng tên trong Drive của tài khoản này và chia sẻ quyền sửa cho anh Linh.
function vbGoc() {
  try { return DriveApp.getFolderById(VB_GOC); } catch (e) {}
  const ten = 'Văn bản soạn từ app', it = DriveApp.getFoldersByName(ten);
  if (it.hasNext()) return it.next();
  const f = DriveApp.createFolder(ten);
  try { f.addEditor('duylinhbl@gmail.com'); } catch (e) {}
  return f;
}
function vbCon(cha, ten) {
  const it = cha.getFoldersByName(ten);
  return it.hasNext() ? it.next() : cha.createFolder(ten);
}
// action 'vb_mau_lay': {ma} -> {docx_b64, json}
function vbMauLay(b) {
  const ma = String(b.ma || '').replace(/[^a-z0-9_]/gi, '');
  const th = DriveApp.getFolderById(VB_MAU);
  const a = th.getFilesByName(ma + '.docx'), j = th.getFilesByName(ma + '.json');
  if (!a.hasNext() || !j.hasNext()) return { ok: false, loi: 'Không thấy khung mẫu ' + ma + ' trong thư mục _mau' };
  return { ok: true, docx_b64: Utilities.base64Encode(a.next().getBlob().getBytes()), json: j.next().getBlob().getDataAsString('UTF-8') };
}
// action 'luu_van_ban': {ten_file, b64, mime, loai_ten, folder_id, viec_ten} -> {url, thu_muc}
function luuVanBan(b) {
  let cha;
  if (b.folder_id) { try { cha = DriveApp.getFolderById(b.folder_id); } catch (e) { cha = null; } }
  if (!cha) {
  cha = vbCon(vbGoc(), String(b.loai_ten || 'Khác').replace(/[\\\/:*?"<>|]/g, ' ')); }
  const th = vbCon(cha, String(b.viec_ten || 'Việc').replace(/[\\\/:*?"<>|]/g, ' ').slice(0, 60));
  const blob = Utilities.newBlob(Utilities.base64Decode(b.b64), b.mime, b.ten_file);
  const f = th.createFile(blob);
  return { ok: true, url: f.getUrl(), thu_muc: th.getName() };
}
// Thêm 2 dòng này vào hàm doPost hiện có, ngay sau dòng kiểm tra b.token:
//   if (b.action === 'vb_mau_lay') return out(vbMauLay(b));
//   if (b.action === 'luu_van_ban') return out(luuVanBan(b));
