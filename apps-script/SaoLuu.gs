/**
 * SaoLuu.gs — nhận bản sao lưu từ app và cất vào Google Drive.
 *
 * Vì sao cần: bản sao lưu hằng đêm đang nằm trong CHÍNH dự án Supabase chứa dữ liệu gốc.
 * Mất dự án là mất cả hai. Mỗi tuần một bản được đẩy ra Drive để có bản ngoài.
 *
 * CÁCH DÁN (giống VanBan.gs / DoiChieu.gs):
 *  1. Mở Apps Script của tài khoản tchcbvdkcsdt@gmail.com.
 *  2. Thêm tệp mới tên SaoLuu.gs, dán toàn bộ nội dung này.
 *  3. Trong doPost, thêm một dòng định tuyến:   if (/^sl_/.test(b.action)) return out(slRoute(b));
 *  4. Triển khai > Quản lý bản triển khai > sửa > Phiên bản: MỚI > Triển khai.
 *     (Bỏ bước 4 là Apps Script vẫn chạy mã cũ.)
 */

var SL_THU_MUC = 'Sao lưu app BV Hành chính';
var SL_GIU = 12;                       // giữ 12 bản gần nhất (khoảng 3 tháng nếu chạy hằng tuần)
var SL_CHIA_SE = 'duylinhbl@gmail.com';

function slRoute(b) {
  if (b.action === 'sl_luu') return slLuu(b);
  if (b.action === 'sl_ds') return slDs();
  return { ok: false, loi: 'Không rõ việc cần làm: ' + b.action };
}

function slThuMuc_() {
  var it = DriveApp.getFoldersByName(SL_THU_MUC);
  if (it.hasNext()) return it.next();
  var f = DriveApp.createFolder(SL_THU_MUC);
  try { f.addViewer(SL_CHIA_SE); } catch (e) {}
  return f;
}

function slLuu(b) {
  try {
    if (!b.ten || !b.b64) return { ok: false, loi: 'Thiếu tên tệp hoặc nội dung' };
    var tm = slThuMuc_();

    // Tên trùng thì thay bản cũ, để chạy lại trong cùng ngày không sinh ra hai bản
    var cu = tm.getFilesByName(b.ten);
    while (cu.hasNext()) cu.next().setTrashed(true);

    var blob = Utilities.newBlob(Utilities.base64Decode(b.b64), 'application/json', b.ten);
    var tep = tm.createFile(blob);

    // Dọn bản cũ, giữ SL_GIU bản mới nhất
    var ds = [], it = tm.getFiles();
    while (it.hasNext()) { var f = it.next(); ds.push({ f: f, ten: f.getName() }); }
    ds.sort(function (a, c) { return c.ten.localeCompare(a.ten); });
    var da_xoa = 0;
    for (var i = SL_GIU; i < ds.length; i++) { ds[i].f.setTrashed(true); da_xoa++; }

    return { ok: true, ten: b.ten, url: tep.getUrl(), thu_muc: tm.getName(), con_lai: Math.min(ds.length, SL_GIU), da_xoa: da_xoa };
  } catch (e) {
    return { ok: false, loi: 'Không lưu được vào Drive: ' + e.message + ' (đã dán bản mới và Triển khai phiên bản MỚI chưa?)' };
  }
}

function slDs() {
  try {
    var tm = slThuMuc_(), ds = [], it = tm.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      ds.push({ ten: f.getName(), byte: f.getSize(), luc: f.getDateCreated().toISOString() });
    }
    ds.sort(function (a, c) { return c.ten.localeCompare(a.ten); });
    return { ok: true, thu_muc: tm.getUrl(), so_ban: ds.length, ds: ds.slice(0, 20) };
  } catch (e) {
    return { ok: false, loi: String(e.message) };
  }
}
