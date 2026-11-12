// Cầu nối App Bệnh viện -> Bảng thu chi (tab "KH 2026") + lưu hồ sơ vào Google Drive
// - Mỗi phiếu được CỘNG THÊM vào ô tháng bằng công thức (=a+b+c), không bao giờ ghi đè.
// - Hồ sơ lưu vào thư mục "Hồ sơ chi phí 2026" / "IV.2.4 - Bảo trì xe máy" (tự tạo nếu chưa có).
// - Đọc số tiền từ hồ sơ bằng OCR của Google Drive: cần bật dịch vụ "Drive API" (Services > + > Drive API).
const TOKEN = 'THAY_BANG_MA_THAT'; // mã thật chỉ nằm trong Apps Script và bảng bi_mat, KHÔNG đưa lên GitHub
const TAB = 'KH 2026';
const FILE_ID = '1_fnrceUvn4AzaqAK-42O0CUC80Pr8aFikqH1rcQ-W5A'; // file gốc Bảng thu chi
const ROOT = 'Hồ sơ chi phí 2026';
const NK = 'Nhật ký app'; // tab ghi lại mọi lần app cộng/hoàn tác (chỉ thêm dòng, không sửa)
const CHIA_SE = ['duylinhbl@gmail.com', 'thaothanhle175@gmail.com']; // được quyền sửa thư mục hồ sơ

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.token !== TOKEN) return out({ ok: false, loi: 'Sai mã' });
    if (b.action === 'doc') return out(docHoSo(b));
    if (b.action === 'bang') return out(docBang());
    if (b.action === 'gan_ma') return out(voKhoa(function () { return ganMa(b); }));
    if (b.action === 'hoan') return out(voKhoa(function () { return hoan(b); }));
    return out(voKhoa(function () { return ghi(b); }));
  } catch (err) {
    return out({ ok: false, loi: String(err) });
  }
}
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Thư mục ----------
function goc() {
  const it = DriveApp.getFoldersByName(ROOT);
  if (it.hasNext()) return it.next();
  const f = DriveApp.createFolder(ROOT);
  CHIA_SE.forEach(function (m) { try { f.addEditor(m); } catch (x) {} });
  return f;
}
function con(cha, ten) {
  const it = cha.getFoldersByName(ten);
  return it.hasNext() ? it.next() : cha.createFolder(ten);
}

// ---------- Bước 1: đọc hồ sơ, gợi ý số tiền (chưa lưu chính thức) ----------
function docHoSo(b) {
  const blob = Utilities.newBlob(Utilities.base64Decode(b.b64), b.mime || 'application/octet-stream', b.ten_file);
  const tam = con(goc(), '_tam');
  const f = tam.createFile(blob);
  let text = '', loi = '';
  try {
    if (b.text_doc) { text = String(b.text_doc); } else {
    // Chỉ đọc chữ ở TRANG ĐẦU: app gửi kèm ảnh trang 1 (b64_doc). File gốc đầy đủ vẫn được lưu.
    const bo = b.b64_doc ? Utilities.newBlob(Utilities.base64Decode(b.b64_doc), b.mime_doc || 'image/jpeg', 'trang1.jpg') : blob;
    text = layChu(bo, b.b64_doc ? (b.mime_doc || 'image/jpeg') : (b.mime || ''));
    }
  } catch (err) { loi = String(err); }
  const k = timSo(text);
  return { ok: true, tam: f.getId(), best: k.best, cands: k.cands, chu: k.chu, khop: k.khop, nguon: k.nguon, loi_doc: loi };
}
// Chuyển file sang Google Docs/Sheets (kèm OCR) - hỗ trợ cả Drive API v3 (Drive.Files.create) và v2 (Drive.Files.insert)
function chuyen(blob, dich, ocr) {
  if (Drive.Files.create) {
    const o = ocr ? { ocrLanguage: 'vi' } : {};
    return Drive.Files.create({ name: 'tmp', mimeType: dich }, blob, o);
  }
  const o2 = ocr ? { ocr: true, ocrLanguage: 'vi' } : { convert: true };
  return Drive.Files.insert({ title: 'tmp', mimeType: dich }, blob, o2);
}
function layChu(blob, mime) {
  if (/^text\//.test(mime)) return blob.getDataAsString();
  let res = null, text = '';
  try {
    if (/spreadsheetml|ms-excel/.test(mime)) {
      res = chuyen(blob, 'application/vnd.google-apps.spreadsheet', false);
      const ss = SpreadsheetApp.openById(res.id);
      ss.getSheets().forEach(function (s) { text += s.getDataRange().getDisplayValues().map(function (r) { return r.join(' | '); }).join('\n') + '\n'; });
    } else if (/wordprocessingml|msword/.test(mime)) {
      res = chuyen(blob, 'application/vnd.google-apps.document', false);
      text = DocumentApp.openById(res.id).getBody().getText();
    } else {
      res = chuyen(blob, 'application/vnd.google-apps.document', true);
      text = DocumentApp.openById(res.id).getBody().getText();
    }
  } finally {
    if (res && res.id) { try { DriveApp.getFileById(res.id).setTrashed(true); } catch (x) {} }
  }
  return text;
}
// Chạy hàm này MỘT LẦN trong trình soạn thảo để cấp đủ quyền (Drive, Sheets, Docs)
function capQuyen() {
  DriveApp.getRootFolder();
  SpreadsheetApp.openById(FILE_ID).getName();
  const d = DocumentApp.create('tmp-quyen');
  DriveApp.getFileById(d.getId()).setTrashed(true);
  return 'OK';
}
function boDau(x) { return String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
function lech(a, b) { // khoảng cách sửa chữ (Levenshtein)
  const m = a.length, n = b.length, d = [];
  for (var i = 0; i <= m; i++) { d[i] = [i]; }
  for (var j = 1; j <= n; j++) d[0][j] = j;
  for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const TU = { khong: 0, mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 'muoi', tram: 'tram', nghin: 1e3, ngan: 1e3, trieu: 1e6, ty: 1e9, ti: 1e9, linh: 'bo', le: 'bo', dong: 'dong', chan: 'bo' };
function tuGan(x) { // nhận chữ số tiếng Việt kể cả khi OCR sai 1 ký tự
  if (x in TU) return x;
  if (x.length < 3) return null;
  let tot = null, kc = 2;
  Object.keys(TU).forEach(function (k) { if (k.length >= 3) { const l = lech(x, k); if (l < kc) { kc = l; tot = k; } } });
  return tot;
}
function bangChu(t) {
  const w = boDau(t).replace(/(?<=[a-z])[60]|[60](?=[a-z])/g, 'o').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  let total = 0, val = 0, cur = null, co = false;
  for (var i = 0; i < w.length; i++) {
    const k = tuGan(w[i]); if (!k) continue;
    const x = TU[k];
    if (x === 'dong') { if (co) break; else continue; }
    if (x === 'bo') continue;
    if (x === 'muoi') { val += cur === null ? 10 : cur * 10; cur = null; co = true; }
    else if (x === 'tram') { val += (cur === null ? 0 : cur) * 100; cur = null; co = true; }
    else if (x >= 1000) { val += (cur === null ? 0 : cur); total += val * x; val = 0; cur = null; co = true; }
    else { cur = x; co = true; }
  }
  return co ? total + val + (cur === null ? 0 : cur) : 0;
}
function soTrongDong(ln) {
  const kq = [];
  (String(ln).match(/\d[\d.,]*\d|\d/g) || []).forEach(function (s) {
    const coPhay = /[.,]/.test(s), digits = s.replace(/[^\d]/g, '');
    if (coPhay ? !/^\d{1,3}([.,]\d{3})+$/.test(s) : (digits.length < 5 || digits.length > 8 || digits[0] === '0')) return;
    const v = parseInt(digits, 10);
    if (v >= 10000 && v < 1e11) kq.push(v);
  });
  return kq;
}
function chuTrong(lines, i) { // số bằng chữ ở dòng i (có thể xuống dòng tiếp theo)
  const bd = boDau(lines[i]);
  const m = bd.match(/b[aă]ng\s*ch\w{0,3}\s*[:;.]?(.*)$/);
  if (!m) return 0;
  const v = bangChu(m[1] + ' ' + boDau(lines[i + 1] || ''));
  return v >= 10000 ? v : 0;
}
function timSo(text) {
  const lines = String(text || '').split(/\r?\n/);
  const bd = lines.map(boDau);
  const reMax = /(tong cong|tong thanh toan|tong tien|tong so tien|tong gia tri|cong tien|grand total|total)/;
  const reTien = /(thanh tien|so tien|gia tri|thanh toan|amount)/;
  let manh = [], vua = [], tat = [], chus = [];
  lines.forEach(function (ln, i) {
    const cung = ln + ' ' + (lines[i + 1] || '');
    const c = chuTrong(lines, i); if (c) chus.push({ i: i, v: c });
    soTrongDong(cung).forEach(function (v) {
      tat.push(v);
      if (reMax.test(bd[i])) manh.push(v); else if (reTien.test(bd[i])) vua.push(v);
    });
  });
  const uniq = function (a) { return a.filter(function (x, k) { return a.indexOf(x) === k; }); };
  let best = 0, khop = false, nguon = '', chu = 0;
  // 1) Ưu tiên "Giấy đề nghị thanh toán": lấy số trong khối từ tiêu đề đến hết dòng "bằng chữ" đầu tiên
  for (var i = 0; i < bd.length && !best; i++) {
    if (/de nghi thanh toan/.test(bd[i]) && !/kinh de nghi|de nghi giam doc/.test(bd[i])) {
      const khoi = chus.filter(function (c) { return c.i > i && c.i <= i + 45; })[0];
      if (!khoi) continue;
      chu = khoi.v;
      let trong = [];
      for (var k = i; k <= khoi.i; k++) trong = trong.concat(soTrongDong(lines[k]));
      if (trong.indexOf(chu) >= 0) { best = chu; khop = true; nguon = 'Giấy đề nghị thanh toán'; }
    }
  }
  // 2) Không có DNTT: lấy số bằng chữ khớp với số có trong hồ sơ, ưu tiên số xuất hiện nhiều nhất
  if (!best && chus.length) {
    const dem = {};
    chus.forEach(function (c) { if (tat.indexOf(c.v) >= 0) dem[c.v] = (dem[c.v] || 0) + 1; });
    const ks = Object.keys(dem).sort(function (a, b) { return dem[b] - dem[a] || Number(a) - Number(b); });
    if (ks.length) { best = Number(ks[0]); khop = true; chu = best; nguon = 'Số bằng chữ trong hồ sơ'; }
  }
  // 3) Dự phòng: dòng có chữ "tổng cộng"/"thành tiền"
  if (!best) best = manh.length ? Math.max.apply(null, manh) : vua.length ? Math.max.apply(null, vua) : tat.length ? Math.max.apply(null, tat) : 0;
  if (!chu && chus.length) chu = chus[0].v;
  const cands = uniq((best ? [best] : []).concat(chus.map(function (c) { return c.v; })).concat(manh).concat(vua).concat(tat.slice().sort(function (a, b) { return b - a; }))).slice(0, 6);
  return { best: best, cands: cands, chu: chu, khop: khop, nguon: nguon };
}

// ---------- Khóa chống 2 người ghi cùng lúc ----------
function voKhoa(fn) {
  const lk = LockService.getScriptLock();
  if (!lk.tryLock(25000)) return { ok: false, ban: true, loi: 'Đang có người khác ghi vào Sheet, thử lại sau vài giây' };
  try { return fn(); } finally { lk.releaseLock(); }
}

// ---------- Mã dòng cố định (gắn vào dòng Sheet, không đổi khi chèn/xóa/đổi tên dòng) ----------
function maHang(sh) { // trả {số dòng: mã}
  const o = {};
  try {
    sh.createDeveloperMetadataFinder().withKey('kh_id').find().forEach(function (m) {
      try {
        const l = m.getLocation();
        if (l.getLocationType() === SpreadsheetApp.DeveloperMetadataLocationType.ROW) o[l.getRow().getRow()] = Number(m.getValue());
      } catch (x) {}
    });
  } catch (x) {}
  return o;
}
function ganMa(b) {
  const sh = SpreadsheetApp.openById(FILE_ID).getSheetByName(TAB);
  const co = maHang(sh), dung = {};
  Object.keys(co).forEach(function (r) { dung[co[r]] = 1; });
  let n = 0;
  (b.map || []).forEach(function (x) {
    if (co[x.r] || dung[x.id]) return;
    if (String(sh.getRange(x.r, 2).getValue()).trim() !== String(x.ten).trim()) return;
    try { sh.getRange(x.r + ':' + x.r).addDeveloperMetadata('kh_id', String(x.id)); n++; } catch (e) {}
  });
  return { ok: true, da_gan: n };
}
function so(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
function docBang() { // đọc toàn bộ tab KH để app đồng bộ lại số liệu
  const sh = SpreadsheetApp.openById(FILE_ID).getSheetByName(TAB);
  const last = sh.getLastRow();
  if (last < 4) return { ok: false, loi: 'Tab trống' };
  const v = sh.getRange(3, 1, last - 2, 32).getValues();
  const d = sh.getRange(3, 1, last - 2, 1).getDisplayValues();
  const ma = maHang(sh), rows = [];
  for (var i = 0; i < v.length; i++) {
    const ten = String(v[i][1]).trim();
    if (!ten) continue;
    const th = [], dv = [];
    for (var m = 0; m < 12; m++) { th.push(so(v[i][7 + 2 * m])); dv.push(so(v[i][8 + 2 * m])); }
    rows.push({ r: i + 3, stt: d[i][0], ten: ten, kh: so(v[i][5]), sd: so(v[i][6]), thang: th, dv: dv, ma: ma[i + 3] || null });
  }
  return { ok: true, rows: rows };
}

// ---------- Nhật ký (sổ ghi vết, chỉ thêm dòng) ----------
function nhatKy() {
  const ss = SpreadsheetApp.openById(FILE_ID);
  let s = ss.getSheetByName(NK);
  if (!s) {
    s = ss.insertSheet(NK);
    s.appendRow(['Thời gian', 'Mã phiếu', 'Dòng', 'Mã hạng mục', 'Hạng mục', 'Tháng', 'Số tiền', 'Phần công thức thêm', 'File', 'Link', 'Người nhập', 'Trạng thái']);
    s.setFrozenRows(1);
    s.getRange('B:B').setNumberFormat('@');
    s.getRange('H:H').setNumberFormat('@');
  }
  return s;
}
function timPhieu(nk, rq) {
  const last = nk.getLastRow();
  if (last < 2) return [];
  const v = nk.getRange(2, 1, last - 1, 12).getValues(), kq = [];
  for (var i = 0; i < v.length; i++) if (String(v[i][1]) === rq) kq.push({ row: i + 2, v: v[i] });
  return kq;
}

// ---------- Bước 2: ghi vào Sheet + lưu hồ sơ ----------
function timDong(sh, b) {
  if (b.ma) {
    const co = maHang(sh);
    for (var r in co) if (co[r] === Number(b.ma)) return { row: Number(r), cach: 'ma' };
  }
  const v = sh.getRange(1, 1, sh.getLastRow(), 2).getDisplayValues();
  const ten = String(b.ten).trim(), stt = String(b.stt || '').trim();
  let row = 0, cung = [];
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][1]).trim() === ten) {
      cung.push(i + 1);
      if (String(v[i][0]).trim() === stt) { row = i + 1; break; }
    }
  }
  if (!row && cung.length === 1) row = cung[0];
  return { row: row, cach: 'ten' };
}
function ghi(b) {
  const m = Number(b.thang);
  const items = b.items && b.items.length ? b.items : [{ so: b.so, ghi_chu: b.ghi_chu }];
  if (!(m >= 1 && m <= 12)) return { ok: false, loi: 'Dữ liệu sai' };
  let tongYc = 0;
  for (var i = 0; i < items.length; i++) { if (!(Number(items[i].so) > 0)) return { ok: false, loi: 'Số tiền không hợp lệ' }; tongYc += Number(items[i].so); }
  const rq = String(b.rq || '');
  const nk = nhatKy();
  // Chống ghi trùng: cùng mã phiếu đã ghi rồi thì trả lại kết quả cũ, không cộng lần nữa
  if (rq) {
    const da = timPhieu(nk, rq);
    if (da.length) {
      if (da.some(function (x) { return String(x.v[11]).indexOf('ĐÃ HOÀN') === 0; })) return { ok: false, loi: 'Phiếu này đã được hoàn tác, hãy nhập lại' };
      const ok = da.filter(function (x) { return String(x.v[11]).indexOf('OK') === 0; });
      if (ok.length) {
        let t = 0; ok.forEach(function (x) { t += Number(x.v[6]); });
        if (Number(ok[0].v[5]) !== m || Math.abs(t - tongYc) > 0.5) return { ok: false, loi: 'Mã phiếu đã dùng cho nội dung khác, bấm lại' };
        const sh0 = SpreadsheetApp.openById(FILE_ID).getSheetByName(TAB);
        return { ok: true, trung: true, dong: Number(ok[0].v[2]), moi: Number(sh0.getRange(Number(ok[0].v[2]), 8 + 2 * (m - 1)).getValue()), tong: t,
          links: ok.filter(function (x) { return x.v[9]; }).map(function (x) { return { ten: x.v[8], url: x.v[9] }; }) };
      }
    }
  }
  const sh = SpreadsheetApp.openById(FILE_ID).getSheetByName(TAB);
  const f = timDong(sh, b), row = f.row;
  if (!row) return { ok: false, loi: 'Không tìm thấy dòng "' + String(b.ten).trim() + '" trong Sheet' };
  const cell = sh.getRange(row, 8 + 2 * (m - 1));
  const fm = cell.getFormula(), cu = cell.getValue();
  let nen;
  if (fm) nen = fm; else if (cu === '' || cu === null) nen = '='; else if (typeof cu === 'number') nen = '=' + cu; else return { ok: false, loi: 'Ô tháng đang chứa chữ, không cộng được' };
  const truoc = typeof cu === 'number' ? cu : 0;

  const ngay = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
  let thuMuc = null, links = [], notes = [], tong = 0, lich = [];
  if (b.thu_muc && items.some(function (x) { return x.tam; })) thuMuc = con(goc(), b.thu_muc);
  items.forEach(function (x) {
    const so = Number(x.so); tong += so;
    const them = (nen === '=' ? '' : '+') + so;
    nen += them;
    let ct = x.ghi_chu || '', link = '', tenF = '';
    if (x.tam && thuMuc) {
      try {
        const file = DriveApp.getFileById(x.tam);
        file.moveTo(thuMuc);
        if (x.ten_file) file.setName(x.ten_file);
        link = file.getUrl(); tenF = file.getName(); links.push({ ten: tenF, url: link }); ct = tenF;
      } catch (er) { ct = (x.ten_file || '') + ' (lỗi lưu file: ' + er + ')'; }
    }
    notes.push(ngay + ' +' + so + (ct ? ' ' + ct : '') + (link ? ' ' + link : '') + (b.nguoi ? ' (' + b.nguoi + ')' : ''));
    lich.push([new Date(), rq, row, b.ma || '', String(b.ten).trim(), m, so, them, tenF || ct, link, b.nguoi || '', 'OK']);
  });
  cell.setFormula(nen);
  SpreadsheetApp.flush();
  const moi = Number(cell.getValue());
  const nc = cell.getNote();
  cell.setNote((nc ? nc + '\n' : '') + notes.join('\n'));
  const kiem = Math.abs(moi - truoc - tong) < 1;
  if (!kiem) lich.forEach(function (x) { x[11] = 'OK (lệch số: ô=' + moi + ')'; });
  // ghi nhật ký: định dạng text trước để "+123" không bị hiểu thành công thức
  const r0 = nk.getLastRow() + 1;
  nk.getRange(r0, 2, lich.length, 1).setNumberFormat('@');
  nk.getRange(r0, 8, lich.length, 1).setNumberFormat('@');
  nk.getRange(r0, 1, lich.length, 12).setValues(lich);
  return { ok: true, dong: row, cach: f.cach, moi: moi, tong: tong, links: links, kiem: kiem };
}

// ---------- Hoàn tác một phiếu (chỉ khi ô tháng chưa bị sửa tay sau phiếu đó) ----------
function hoan(b) {
  const rq = String(b.rq || '');
  if (!rq) return { ok: false, loi: 'Thiếu mã phiếu' };
  const nk = nhatKy();
  const da = timPhieu(nk, rq).filter(function (x) { return String(x.v[11]).indexOf('OK') === 0; });
  if (!da.length) return { ok: false, loi: 'Không thấy phiếu này, hoặc đã hoàn tác rồi' };
  const sh = SpreadsheetApp.openById(FILE_ID).getSheetByName(TAB);
  const m = Number(da[0].v[5]);
  let row = Number(da[0].v[2]);
  const ma = da[0].v[3] ? Number(da[0].v[3]) : 0;
  if (ma) { const co = maHang(sh); for (var r in co) if (co[r] === ma) { row = Number(r); break; } }
  if (String(sh.getRange(row, 2).getValue()).trim() !== String(da[0].v[4]).trim() && !ma) return { ok: false, loi: 'Dòng trong Sheet đã thay đổi, hãy sửa tay' };
  const cell = sh.getRange(row, 8 + 2 * (m - 1));
  let nen = cell.getFormula();
  for (var i = da.length - 1; i >= 0; i--) {
    const t = String(da[i].v[7]);
    if (!nen || nen.slice(-t.length) !== t) return { ok: false, loi: 'Ô tháng đã bị sửa sau phiếu này nên không tự hoàn tác được, hãy sửa tay trên Sheet' };
    nen = nen.slice(0, nen.length - t.length);
  }
  if (nen === '=' || nen === '') cell.clearContent(); else cell.setFormula(nen);
  SpreadsheetApp.flush();
  let tong = 0; da.forEach(function (x) { tong += Number(x.v[6]); });
  const ngay = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
  const nc = cell.getNote();
  cell.setNote((nc ? nc + '\n' : '') + ngay + ' HOÀN TÁC -' + tong + (b.nguoi ? ' (' + b.nguoi + ')' : ''));
  da.forEach(function (x) { nk.getRange(x.row, 12).setValue('ĐÃ HOÀN ' + ngay); });
  try { // đưa file hồ sơ sang _da_huy (không xóa); lỗi ở đây không ảnh hưởng việc hoàn tác
    const huy = con(goc(), '_da_huy');
    da.forEach(function (x) {
      const mm = String(x.v[9]).match(/[-\w]{25,}/);
      if (mm) { try { DriveApp.getFileById(mm[0]).moveTo(huy); } catch (e) {} }
    });
  } catch (e) {}
  return { ok: true, ma: ma || null, thang: m, moi: Number(cell.getValue()), tong: tong };
}

// ---------- Dọn file tạm ----------
function donTam() { // xóa file trong _tam quá 2 ngày (hồ sơ đã bấm Ghi thì đã được chuyển đi)
  const it = goc().getFoldersByName('_tam');
  if (!it.hasNext()) return 0;
  const han = new Date(Date.now() - 2 * 86400000), fs = it.next().getFiles();
  let n = 0;
  while (fs.hasNext()) { const f = fs.next(); if (f.getDateCreated() < han) { f.setTrashed(true); n++; } }
  return n;
}
// Chạy MỘT LẦN: đặt lịch tự dọn file tạm mỗi ngày lúc 2h sáng
function caiTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'donTam') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('donTam').timeBased().everyDays(1).atHour(2).create();
  return 'OK';
}
