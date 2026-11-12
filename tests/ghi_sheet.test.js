// Kiểm thử logic ghi Bảng thu chi (Apps Script) trên Sheet giả lập – chạy: node tests/ghi_sheet.test.js
const { kiem, ket, docGs } = require('./lib');
const cells = {}, names = {}, meta = [], nk = { rows: [] };
let khoa = false;
const ev = f => { try { return Function('return ' + f.slice(1))(); } catch (e) { return NaN; } };
const cellOf = (r, c) => { const k = r + ',' + c; cells[k] = cells[k] || { f: '', v: '', note: '' }; return cells[k]; };
const sheet = {
  getLastRow: () => 50,
  getRange(r, c, nr) {
    if (typeof r === 'string') return { addDeveloperMetadata: (k, v) => meta.push({ row: +r.split(':')[0], val: v }) };
    if (nr === undefined) {
      const o = cellOf(r, c);
      return { getFormula: () => o.f, getValue: () => c === 2 ? names[r] : (o.f ? ev(o.f) : o.v), setFormula: x => { o.f = x; }, clearContent: () => { o.f = ''; o.v = ''; }, getNote: () => o.note, setNote: x => { o.note = x; } };
    }
    const out = []; for (let i = 0; i < nr; i++) out.push(['', names[r + i] || '']);
    return { getDisplayValues: () => out };
  },
  createDeveloperMetadataFinder: () => ({ withKey: () => ({ find: () => meta.map(m => ({ getValue: () => m.val, getLocation: () => ({ getLocationType: () => 'ROW', getRow: () => ({ getRow: () => m.row }) }) })) }) }),
};
const nhatKy = {
  getLastRow() { return nk.rows.length + 1; },
  getRange(r, c, nr) { return { setNumberFormat() {}, setValues: v => v.forEach((x, i) => { nk.rows[r - 2 + i] = x; }), getValues: () => nk.rows.slice(r - 2, r - 2 + nr), setValue: x => { nk.rows[r - 2][c - 1] = x; } }; },
};
const ctx = {
  SpreadsheetApp: { openById: () => ({ getSheetByName: n => n === 'KH 2026' ? sheet : (n === 'Nhật ký app' ? nhatKy : null) }), flush() {}, DeveloperMetadataLocationType: { ROW: 'ROW' } },
  LockService: { getScriptLock: () => ({ tryLock: () => !khoa, releaseLock() {} }) },
  Utilities: { formatDate: () => '12/11/2026' }, ContentService: {},
  DriveApp: { getFoldersByName: () => ({ hasNext: () => true, next: () => ({ getFoldersByName: () => ({ hasNext: () => true, next: () => ({}) }) }) }), getFileById: () => ({ moveTo() {} }) },
};
const G = new Function(...Object.keys(ctx), docGs() + ';return {ghi,hoan,voKhoa,docBang}')(...Object.values(ctx));
names[10] = 'Điện thoại bàn'; names[11] = 'Khăn'; names[12] = 'Xăng';
const T = 8 + 2 * 10; // cột tháng 11
const f10 = () => cellOf(10, T).f;
const ghi = (o) => G.ghi(Object.assign({ thang: 11, ten: 'Điện thoại bàn', stt: '5.3', nguoi: 'Thảo' }, o));

console.log('Ghi cơ bản');
let r = ghi({ rq: 'A1', items: [{ so: 1000 }, { so: 500 }] });
kiem(r.ok && r.moi === 1500 && r.kiem, 'ghi 2 khoản liền: ô = 1500, kiểm lại số đạt');
kiem(f10() === '=1000+500', 'công thức cộng dồn =1000+500 (không ghi đè)');
kiem(/12\/11\/2026 \+1000/.test(cellOf(10, T).note), 'có ghi chú ô');
console.log('Chống ghi trùng');
r = ghi({ rq: 'A1', items: [{ so: 1000 }, { so: 500 }] });
kiem(r.ok && r.trung && r.moi === 1500 && f10() === '=1000+500', 'gửi lại cùng mã phiếu: không cộng đôi');
r = ghi({ rq: 'A1', items: [{ so: 999 }] });
kiem(!r.ok, 'cùng mã nhưng nội dung khác: từ chối');
console.log('Cộng tiếp & hoàn tác');
r = ghi({ rq: 'A2', items: [{ so: 200 }] });
kiem(r.ok && r.moi === 1700 && f10() === '=1000+500+200', 'phiếu 2 cộng tiếp vào cùng ô');
r = G.hoan({ rq: 'A1' });
kiem(!r.ok && f10() === '=1000+500+200', 'không hoàn tác phiếu cũ khi đã có phiếu sau (giữ nguyên ô)');
r = G.hoan({ rq: 'A2' });
kiem(r.ok && f10() === '=1000+500', 'hoàn tác phiếu 2');
r = G.hoan({ rq: 'A1' });
kiem(r.ok && f10() === '', 'hoàn tác phiếu 1: ô trống lại');
kiem(!G.hoan({ rq: 'A1' }).ok, 'hoàn tác lần 2 bị từ chối');
kiem(!ghi({ rq: 'A1', items: [{ so: 1000 }, { so: 500 }] }).ok, 'phiếu đã hoàn tác không ghi lại bằng mã cũ');
console.log('Dữ liệu xấu');
kiem(!ghi({ rq: 'B1', items: [{ so: 0 }] }).ok, 'số tiền 0 bị từ chối');
kiem(!ghi({ rq: 'B2', items: [{ so: -5 }] }).ok, 'số tiền âm bị từ chối');
kiem(!ghi({ rq: 'B3', thang: 13, items: [{ so: 5 }] }).ok, 'tháng 13 bị từ chối');
kiem(!ghi({ rq: 'B4', ten: 'Không có dòng này', items: [{ so: 5 }] }).ok, 'không tìm thấy dòng: từ chối, không ghi bừa');
cellOf(11, T).v = 'abc';
kiem(!ghi({ rq: 'B5', ten: 'Khăn', items: [{ so: 5 }] }).ok, 'ô tháng chứa chữ: từ chối');
console.log('Ô đang có số cố định');
cellOf(12, T).v = 700;
r = ghi({ rq: 'B6', ten: 'Xăng', items: [{ so: 300 }] });
kiem(r.ok && r.moi === 1000 && cellOf(12, T).f === '=700+300', 'số cũ 700 được giữ, cộng thêm 300');
console.log('Khóa & mã dòng cố định');
khoa = true; r = G.voKhoa(() => ({ ok: true }));
kiem(!r.ok && r.ban, 'đang có người ghi: báo bận, không ghi chồng');
khoa = false;
meta.push({ row: 11, val: '77' }); names[11] = 'Tên mới';
r = ghi({ rq: 'B7', ten: 'Tên cũ', stt: 'x', ma: 77, thang: 3, items: [{ so: 50 }] });
kiem(r.ok && r.dong === 11 && r.cach === 'ma', 'khớp theo mã dòng dù đổi tên/di chuyển');
console.log('Nhật ký');
kiem(nk.rows.length === 5 && nk.rows.every(x => x[1]), 'mọi lần ghi đều có dòng nhật ký kèm mã phiếu');
ket('ghi_sheet');
