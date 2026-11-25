/**
 * ThuocKho.gs — cho app đọc danh mục tờ hướng dẫn sử dụng thuốc trong Drive.
 *
 * App KHÔNG tải nội dung PDF về; chỉ lấy danh sách tên tệp và id để dựng bộ tra cứu,
 * còn khi bác sĩ bấm xem thì mở thẳng tệp trên Drive. Nhờ vậy không nhân bản dữ liệu,
 * khoa Dược sửa tệp nào là app thấy ngay tệp đó.
 *
 * CÁCH DÁN (giống VanBan.gs / DoiChieu.gs / SaoLuu.gs):
 *  1. Mở Apps Script của tài khoản tchcbvdkcsdt@gmail.com.
 *  2. Thêm tệp ThuocKho.gs, dán toàn bộ nội dung này.
 *  3. Trong doPost, thêm một dòng định tuyến:   if (/^thuoc_/.test(b.action)) return out(thuocRoute(b));
 *  4. Triển khai > Quản lý bản triển khai > sửa > Phiên bản: MỚI > Triển khai.
 *
 * ĐIỀU KIỆN: thư mục kho phải được chia sẻ cho tchcbvdkcsdt@gmail.com quyền Người xem
 * (hoặc đặt "Bất kỳ ai có đường liên kết" quyền Người xem).
 */

var THUOC_TOI_DA = 4000;   // trần số tệp quét một lượt, phòng kho phình to bất thường

function thuocRoute(b) {
  if (b.action === 'thuoc_quet') return thuocQuet(b);
  return { ok: false, loi: 'Không rõ việc cần làm: ' + b.action };
}

function thuocQuet(b) {
  try {
    if (!b.thu_muc) return { ok: false, loi: 'Thiếu id thư mục kho' };
    var goc;
    try { goc = DriveApp.getFolderById(b.thu_muc); }
    catch (e) {
      return { ok: false, loi: 'Không mở được thư mục kho. Đã chia sẻ thư mục cho ' +
        Session.getEffectiveUser().getEmail() + ' quyền Người xem chưa?' };
    }

    var ds = [], chan = { n: 0 };
    quetDeQuy_(goc, '', ds, chan);
    return { ok: true, thu_muc: goc.getName(), so_tep: ds.length,
             cat_bot: chan.n >= THUOC_TOI_DA, ds: ds };
  } catch (e) {
    return { ok: false, loi: 'Lỗi khi quét kho: ' + e.message };
  }
}

function quetDeQuy_(tm, chuCai, ds, chan) {
  var f = tm.getFiles();
  while (f.hasNext() && chan.n < THUOC_TOI_DA) {
    var x = f.next(), ten = x.getName();
    if (!/\.pdf$/i.test(ten)) continue;          // bỏ qua NGUON.txt và tệp lạ
    ds.push({
      id: x.getId(),
      ten: ten,
      chu_cai: chuCai,
      byte: x.getSize(),
      sua_luc: x.getLastUpdated().toISOString()
    });
    chan.n++;
  }
  var s = tm.getFolders();
  while (s.hasNext() && chan.n < THUOC_TOI_DA) {
    var sn = s.next();
    // tầng 1 là thư mục chữ cái A–Z; tầng sâu hơn vẫn quét nhưng giữ chữ cái của tầng 1
    quetDeQuy_(sn, chuCai || sn.getName(), ds, chan);
  }
}
