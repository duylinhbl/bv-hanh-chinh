// Kiểm thử phần thuần của báo cáo tuần (cần Node >= 22.6: chạy với --experimental-strip-types)
const { kiem, ket } = require('./lib');
const fs = require('fs'), path = require('path');
(async () => {
  const L = await import(path.join(__dirname, '..', 'supabase', 'functions', 'bao-cao-tuan', 'lib.ts'));
  console.log('Bao cao tuan');
  // Tuần: thứ 5 12/11/2026 15h VN (= 08:00 UTC)
  const t = L.tinhTuan(new Date('2026-11-12T08:00:00Z'));
  kiem(t.tb_tu === '2026-11-09' && t.tb_den === '2026-11-13', 'tuần báo cáo 09–13/11');
  kiem(t.kh_tu === '2026-11-16' && t.kh_den === '2026-11-20', 'tuần kế hoạch 16–20/11');
  kiem(t.hom_nay === '2026-11-12', 'hôm nay theo giờ VN');
  const t2 = L.tinhTuan(new Date('2026-11-12T20:00:00Z')); // 03h sáng thứ 6 VN
  kiem(t2.hom_nay === '2026-11-13' && t2.tb_tu === '2026-11-09', 'qua nửa đêm UTC vẫn đúng tuần VN');
  const t3 = L.tinhTuan(new Date('2026-12-31T08:00:00Z'));
  kiem(t3.tb_tu === '2026-12-28' && t3.kh_tu === '2027-01-04' && t3.kh_den === '2027-01-08', 'qua năm mới');
  kiem(L.tenFile('2026-11-09', '2026-11-13') === 'BAO CAO CONG TAC TUAN 09 thang 11 - 13 tháng 11 nam 2026.docx', 'tên file đúng mẫu');
  kiem(L.tieuDeMail() === 'Bệnh viện đa khoa' && !L.noiDungMail('2026-11-09', '2026-11-16').includes('đính chính'), 'thư thường');
  kiem(L.tieuDeMail(true).includes('đính chính') && L.noiDungMail('2026-11-09', '2026-11-16', true).includes('đính chính'), 'thư đính chính');
  // Rút gọn
  kiem(L.motDong('Tập huấn Online Bệnh án điện tử') === 'Tham dự Tập huấn Online Bệnh án điện tử.', 'sự kiện -> Tham dự');
  kiem(L.motDong('Tiêm vaccine toàn viện') === 'Thực hiện tiêm vaccine toàn viện.', 'việc -> Thực hiện');
  kiem(L.motDong('Tổ chức họp khoa\nThành phần: A, B') === 'Tổ chức họp khoa.', 'bỏ dòng thành phần');
  kiem(L.motDong('8h30: Hội nghị sơ kết quý III (Thành phần: BGĐ, trưởng khoa)') === 'Tham dự Hội nghị sơ kết quý III.', 'bỏ giờ + thành phần');
  kiem(L.motDong('   ') === '', 'rỗng -> bỏ');
  // Dòng
  const rows = [
    { ngay: '2026-11-11', gio_bd: '07:00:00', noi_dung: 'Tiêm vaccine toàn viện' },
    { ngay: '2026-11-10', gio_bd: '14:00:00', noi_dung: 'Tập huấn Online Bệnh án điện tử' },
    { ngay: '2026-11-10', gio_bd: '15:00:00', noi_dung: 'Tập huấn online bệnh án điện tử' },
  ];
  const cv = L.dongCongViec(rows);
  kiem(cv.length === 2 && cv[0].includes('Tập huấn') && cv[1].includes('vaccine'), 'xếp theo ngày + gộp trùng');
  kiem(L.dongCongViec([]).join() === L.DONG_DUY_TRI, 'tuần trống -> Duy trì');
  const kh = L.dongKeHoach([]);
  kiem(kh.length === 1 && kh[0] === L.DONG_DUY_TRI, 'kế hoạch trống -> Duy trì');
  const kh2 = L.dongKeHoach([{ ngay: '2026-11-17', noi_dung: 'Khám sức khỏe định kỳ khoa Sản' }]);
  kiem(kh2.length === 2 && kh2[1] === L.DONG_DUY_TRI, 'kế hoạch luôn kết thúc bằng Duy trì');
  // Điền mẫu thật
  const mau = path.join(__dirname, 'mau_bao_cao_tuan.xml');
  const xml = fs.readFileSync(mau, 'utf8');
  const kq = L.dienMau(xml, t, cv, kh2);
  kiem(!/\{\{/.test(kq), 'không còn ô {{}}');
  kiem(kq.includes('ngày </w:t>') || kq.includes('>12<'), 'ngày hôm nay 12');
  kiem(kq.includes('09/11/2026 đến 13/11/2026') && kq.includes('16/11/2026 đến 20/11/2026'), 'tiêu đề hai tuần');
  kiem((kq.match(/Duy trì công tác/g) || []).length === 1, 'Duy trì xuất hiện 1 lần');
  kiem(!/w14:paraId="66EED0EA"[\s\S]*w14:paraId="66EED0EA"/.test(kq), 'không trùng paraId');
  const kq2 = L.dienMau(xml, t, ['- A & B <C>.'], ['- x.']);
  kiem(kq2.includes('A &amp; B &lt;C&gt;.'), 'thoát ký tự đặc biệt XML');
  let loi = false; try { L.dienMau('<w:p w14:paraId="1">abc</w:p>', t, [], []); } catch (_) { loi = true; }
  kiem(loi, 'mẫu hỏng -> báo lỗi, không gửi');
  ket('bao_cao_tuan');
})().catch((e) => { console.error(e); process.exit(1); });
