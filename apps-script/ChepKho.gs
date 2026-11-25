/**
 * ChepKho.gs — chép toàn bộ kho "Tờ hướng dẫn sử dụng thuốc" về Drive của mình.
 *
 * CÁCH DÙNG
 *  1. Mở script.google.com, tạo dự án mới (hoặc dùng dự án sẵn có), thêm tệp ChepKho.gs, dán nội dung này.
 *  2. Chạy hàm  demKho()  TRƯỚC — chỉ đếm, không chép. Xem Nhật ký thực thi để biết bao nhiêu tệp, nặng bao nhiêu.
 *     Nếu dung lượng vượt chỗ trống trong Drive thì dừng lại, đừng chép.
 *  3. Chạy  chepKho()  để bắt đầu chép. Lần chạy đầu Google sẽ hỏi cấp quyền Drive — bấm cho phép.
 *     Script tự dừng trước khi hết giờ và tự hẹn chạy lại sau 1 phút, cho tới khi xong.
 *  4. Muốn dừng giữa chừng:  dungChep()
 *  5. Chép xong, chạy lại  chepKho()  lần nữa sẽ không chép lại tệp đã có (so theo tên), nên chạy lại để bổ sung
 *     tệp mới của kho nguồn cũng được.
 *
 * LƯU Ý NGHIỆP VỤ (script tự ghi vào tệp NGUON.txt trong thư mục chép ra):
 *  Kho nguồn là của người khác, cập nhật lần cuối khoảng 9/2025, và là danh mục thuốc của nơi khác.
 *  Trước khi cho bác sĩ tra cứu, khoa Dược phải đối chiếu với danh mục thuốc bệnh viện đang trúng thầu:
 *  cùng hoạt chất nhưng khác hãng thì tờ hướng dẫn khác nhau.
 */

var KHO_NGUON = '1ok-iLla79elP7cHpolXZLwExYbL4gNNp';   // "Tờ hướng dẫn sử dụng thuốc"
var TEN_DICH  = 'Tờ hướng dẫn sử dụng thuốc (bản chép)';
var CHIA_SE   = '';          // để trống nếu chạy bằng chính tài khoản của mình; điền email nếu muốn chia sẻ thêm
var GIAY_TOI_DA = 270;       // chạy tối đa 4,5 phút mỗi lượt rồi hẹn lượt sau (giới hạn của Apps Script là 6 phút)

/** Đếm trước, không chép gì cả. */
function demKho() {
  var d = { tep: 0, thuMuc: 0, byte: 0 };
  demDeQuy_(DriveApp.getFolderById(KHO_NGUON), d);
  Logger.log('Thư mục: %s | Tệp: %s | Dung lượng: %s MB',
    d.thuMuc, d.tep, Math.round(d.byte / 1048576));
  return d;
}

function demDeQuy_(tm, d) {
  d.thuMuc++;
  var f = tm.getFiles();
  while (f.hasNext()) { var x = f.next(); d.tep++; d.byte += x.getSize(); }
  var s = tm.getFolders();
  while (s.hasNext()) demDeQuy_(s.next(), d);
}

/** Chép. Chạy lại nhiều lượt cho tới khi xong; gọi lại lúc nào cũng an toàn. */
function chepKho() {
  var P = PropertiesService.getScriptProperties();
  var motc = new Date().getTime();
  xoaHen_();

  var hang = JSON.parse(P.getProperty('hang') || 'null');
  if (!hang) {
    var dich = DriveApp.createFolder(TEN_DICH);
    if (CHIA_SE) { try { dich.addEditor(CHIA_SE); } catch (e) {} }
    dich.createFile('NGUON.txt',
      'Thư mục này được chép tự động ngày ' + new Date().toLocaleString('vi-VN') + '.\n\n' +
      'Nguồn: Google Drive "Tờ hướng dẫn sử dụng thuốc", thư mục id ' + KHO_NGUON + '\n' +
      'Chủ sở hữu kho nguồn: truongxuanbachkddhydtphcm@gmail.com (không phải khoa Dược Bệnh viện Đa khoa Cao su Dầu Tiếng).\n' +
      'Kho nguồn cập nhật lần cuối khoảng tháng 9/2025.\n\n' +
      'CẢNH BÁO TRƯỚC KHI DÙNG CHO LÂM SÀNG\n' +
      'Đây là danh mục thuốc của nơi khác. Cùng một hoạt chất nhưng khác nhà sản xuất thì tờ hướng dẫn\n' +
      'sử dụng khác nhau về tá dược, liều trình bày, chống chỉ định và cảnh báo.\n' +
      'Khoa Dược phải đối chiếu với danh mục thuốc bệnh viện đang trúng thầu, đánh dấu tệp nào dùng được,\n' +
      'trước khi mở cho bác sĩ và điều dưỡng tra cứu.\n' +
      'Nội dung từng tờ hướng dẫn thuộc bản quyền nhà sản xuất thuốc; dùng nội bộ bệnh viện.\n',
      MimeType.PLAIN_TEXT);
    hang = [{ s: KHO_NGUON, d: dich.getId() }];
    P.setProperty('dich', dich.getId());
    P.setProperty('dem', '0');
    Logger.log('Đã tạo thư mục đích: %s', dich.getUrl());
  }

  var dem = Number(P.getProperty('dem') || 0);
  while (hang.length) {
    var cap = hang[0];
    var nguon = DriveApp.getFolderById(cap.s), dich2 = DriveApp.getFolderById(cap.d);

    // thư mục con: tạo nếu chưa có, rồi xếp vào hàng chờ
    var sub = nguon.getFolders();
    while (sub.hasNext()) {
      var sn = sub.next(), ten = sn.getName();
      var co = dich2.getFoldersByName(ten);
      var sd = co.hasNext() ? co.next() : dich2.createFolder(ten);
      hang.push({ s: sn.getId(), d: sd.getId() });
    }

    // tệp: bỏ qua tệp đã có cùng tên, nên chạy lại không nhân đôi
    var f = nguon.getFiles();
    while (f.hasNext()) {
      var x = f.next();
      if (!dich2.getFilesByName(x.getName()).hasNext()) {
        try { x.makeCopy(x.getName(), dich2); dem++; }
        catch (e) { Logger.log('Không chép được "%s": %s', x.getName(), e.message); }
      }
      if ((new Date().getTime() - motc) / 1000 > GIAY_TOI_DA) {
        // hết giờ giữa chừng thư mục này: giữ nguyên nó ở đầu hàng, lượt sau chạy tiếp
        P.setProperty('hang', JSON.stringify(hang));
        P.setProperty('dem', String(dem));
        hen_();
        Logger.log('Tạm dừng, đã chép %s tệp. Sẽ chạy tiếp sau 1 phút.', dem);
        return;
      }
    }

    hang.shift();
    P.setProperty('hang', JSON.stringify(hang));
    P.setProperty('dem', String(dem));
    if ((new Date().getTime() - motc) / 1000 > GIAY_TOI_DA) {
      hen_(); Logger.log('Tạm dừng, đã chép %s tệp. Sẽ chạy tiếp sau 1 phút.', dem); return;
    }
  }

  P.deleteProperty('hang');
  Logger.log('XONG. Đã chép %s tệp vào %s',
    dem, DriveApp.getFolderById(P.getProperty('dich')).getUrl());
}

/** Dừng hẳn, xóa lịch chạy tiếp. Phần đã chép vẫn giữ nguyên. */
function dungChep() {
  xoaHen_();
  PropertiesService.getScriptProperties().deleteProperty('hang');
  Logger.log('Đã dừng. Chạy chepKho() lần nữa để bắt đầu lại từ đầu (tệp đã có sẽ không chép lại).');
}

function hen_() {
  ScriptApp.newTrigger('chepKho').timeBased().after(60 * 1000).create();
}

function xoaHen_() {
  var ds = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ds.length; i++) {
    if (ds[i].getHandlerFunction() === 'chepKho') ScriptApp.deleteTrigger(ds[i]);
  }
}
