// Kiểm thử: dòng báo cáo tuần phải GIỮ ĐỦ nội dung lịch công tác
// (lấy thẳng các hàm trong supabase/functions/bao-cao-tuan/lib.ts, bỏ phần khai báo kiểu của TypeScript)
const { kiem, ket } = require('./lib');
const fs = require('fs'), path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/bao-cao-tuan/lib.ts'), 'utf8');
const ts = src.slice(src.indexOf('const NN ='), src.indexOf('export const tenFile'))
  .replace(/export /g, '')
  .replace(/: Lich\[\]/g, '').replace(/: string\[\]/g, '').replace(/: Set<string>/g, '')
  .replace(/<string>/g, '').replace(/\(s: string\)/g, '(s)').replace(/\(c: string\)/g, '(c)')
  .replace(/noiDung: string/g, 'noiDung').replace(/\): string/g, ')');
const { motDong, dongCongViec, dongKeHoach, DONG_DUY_TRI } = new Function(ts + '; return {motDong,dongCongViec,dongKeHoach,DONG_DUY_TRI};')();

// ---- lỗi đã gặp thật 19/11/2026: lịch có 3 thiết bị nhưng báo cáo gửi Công ty chỉ ghi 1 dòng cụt ----
const tb = motDong('Nhận trang thiết bị y tế:\n1. Máy siêu âm màu xách tay 03 đầu dò\n2. Máy rửa dạ dày\n3. Máy điện tim 3 kênh');
kiem(/máy siêu âm màu xách tay 03 đầu dò/.test(tb), 'giữ thiết bị 1 (được: ' + tb + ')');
kiem(/máy rửa dạ dày/.test(tb) && /máy điện tim 3 kênh/.test(tb), 'giữ đủ thiết bị 2 và 3');
kiem(!/\d\./.test(tb) && tb.split(':').length === 2, 'gộp thành một câu, bỏ số thứ tự 1. 2. 3.');
kiem(tb.endsWith('.') && !tb.includes('..'), 'kết thúc bằng đúng một dấu chấm');

// ---- dấu ; là liệt kê thì phải giữ, không được cắt ----
const ksk = motDong('Khám sức khỏe công ty Leading; PTEC');
kiem(/Leading/.test(ksk) && /PTEC/.test(ksk), 'giữ cả hai công ty khi ngăn bằng dấu ; (được: ' + ksk + ')');

// ---- nhưng chú thích thì vẫn phải bỏ ----
kiem(!/BGĐ/.test(motDong('Tập huấn Bệnh án điện tử\nThành phần: BGĐ, các khoa phòng')), 'bỏ dòng Thành phần');
kiem(!/hội trường/i.test(motDong('Họp giao ban; Địa điểm: hội trường')), 'bỏ phần Địa điểm sau dấu ;');
kiem(motDong('Hội nghị cán bộ công chức').startsWith('Tham dự '), 'sự kiện thì thêm "Tham dự"');
kiem(motDong('8h00 - Họp giao ban tuần') === 'Tham dự họp giao ban tuần.', 'bỏ giờ ở đầu dòng');
kiem(motDong('Kiểm tra công tác phòng cháy') === 'Kiểm tra công tác phòng cháy.', 'đã có động từ thì giữ nguyên');

// ---- viết tắt phải giữ chữ hoa ----
kiem(/BHXH/.test(motDong('Làm việc với các đơn vị:\n- BHXH tỉnh\n- TTYT Dầu Tiếng')), 'giữ chữ hoa của tên viết tắt');

// ---- gom theo tuần ----
const cv = dongCongViec([{ ngay: '2026-11-18', gio_bd: '08:30', noi_dung: 'Tập huấn Bệnh án điện tử' }, { ngay: '2026-11-16', gio_bd: '09:30', noi_dung: 'Nhận trang thiết bị y tế:\n1. Máy rửa dạ dày' }]);
kiem(cv.length === 2 && /dạ dày/.test(cv[0]), 'xếp theo ngày và giữ chi tiết (được: ' + cv[0] + ')');
kiem(cv.every((x) => x.startsWith('- ')), 'mỗi dòng bắt đầu bằng gạch đầu dòng');
kiem(dongCongViec([]).length === 1 && dongCongViec([])[0] === DONG_DUY_TRI, 'tuần không có lịch thì vẫn có dòng duy trì');
kiem(dongKeHoach([]).pop() === DONG_DUY_TRI, 'kế hoạch luôn kết bằng dòng duy trì');

ket('bao_cao_tuan');
