// Kiểm thử: tách bảng đã chốt trong hội thoại AI để máy chủ tự dựng phụ lục
// (lấy thẳng hàm bangTuKQ trong supabase/functions/soan-mau/index.ts, bỏ phần khai báo kiểu của TypeScript)
const { kiem, ket } = require('./lib');
const fs = require('fs'), path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/soan-mau/index.ts'), 'utf8');
const i = src.indexOf('function bangTuKQ');
const j = src.indexOf('\n}', i) + 2;
const ts = src.slice(i, j)
  .replace(/: string\[\]\[\]/g, '').replace(/: string/g, '')
  .replace(/let tot = \[\], cur = \[\];/, 'let tot = [], cur = [];');
const bangTuKQ = new Function(ts + '; return bangTuKQ;')();

const chat = `Đây là bảng định mức sau khi tính lại theo thực tế:

| STT | Tuyến đường | Số km thực tế | Định mức mới |
| --- | --- | --- | --- |
| 1 | BV - Bệnh viện Chợ Rẫy | 74 | 89 |
| 2 | BV - Bệnh viện Hồng Hưng | 72 | 86 |
| 3 | BV - Trung tâm Y tế Mỹ Phước | 76 | 91 |

Định mức mới = km thực tế + 20%, làm tròn.`;

const b = bangTuKQ(chat);
kiem(b.length === 4, 'lấy đủ hàng tiêu đề + 3 tuyến (được ' + b.length + ')');
kiem(b[0][0] === 'STT' && b[0][3] === 'Định mức mới', 'giữ đúng tên cột');
kiem(b[3][1] === 'BV - Trung tâm Y tế Mỹ Phước' && b[3][3] === '91', 'giữ đúng số liệu hàng cuối');
kiem(!b.some(r => r.join('').includes('---')), 'bỏ dòng kẻ của bảng markdown');
kiem(bangTuKQ('Chỉ là câu trả lời bình thường, không có bảng nào cả.').length === 0, 'không có bảng thì trả về rỗng (vẫn chạy luồng cũ)');

// bảng viết kiểu "a | b | c" không có dấu | ở đầu dòng
const b2 = bangTuKQ('STT | Nội dung | Số tiền\n1 | Mua giấy | 1.000.000\n2 | Mua mực | 2.000.000');
kiem(b2.length === 3 && b2[2][2] === '2.000.000', 'nhận cả bảng không có dấu | ở đầu dòng');

// ---- dựng văn bản theo mẫu khi AI bị chặn ----
const i2 = src.indexOf('function soanTheoMau');
const j2 = src.indexOf('\n}', src.indexOf('return { ve_viec: veViec', i2)) + 2;
const ts2 = src.slice(i2, j2).replace(/: \{ ve_viec: string; noi_dung: string \}/g, '').replace(/: string\[\]/g, '').replace(/: string/g, '').replace(/: boolean/g, '');
const soanTheoMau = new Function(ts2 + '; return soanTheoMau;')();

const tt = soanTheoMau('to_trinh', 'Ban hành định mức tuyến đường chuyển viện', 'Trình phê duyệt danh mục 33 vị trí.\nĐịnh mức mới = km thực tế + 20%.', true);
kiem(/^Kính gửi: Giám đốc Bệnh viện/.test(tt.noi_dung), 'tờ trình mở đầu bằng Kính gửi');
kiem(tt.noi_dung.includes('73/QĐ-HĐTV-CSDT ngày 05 tháng 5 năm 2017'), 'căn cứ Điều lệ ghi rõ số và ngày');
kiem(tt.noi_dung.includes('- Trình phê duyệt danh mục 33 vị trí.') && tt.noi_dung.includes('Phụ lục đính kèm'), 'đưa Ý chính của người dùng vào và dẫn chiếu phụ lục');
kiem(tt.noi_dung.trim().endsWith('Trân trọng kính trình./.'), 'kết đúng câu của tờ trình');
kiem(!/Kinh phí/i.test(tt.noi_dung), 'việc không chi tiền thì không tự thêm mục kinh phí');

const qd = soanTheoMau('quyet_dinh', 'Phê duyệt định mức tuyến đường', 'Phê duyệt danh mục 33 vị trí và định mức mới.', true);
kiem(qd.noi_dung.includes('QUYẾT ĐỊNH:') && qd.noi_dung.includes('Điều 1:') && qd.noi_dung.includes('Điều 3:'), 'quyết định đủ QUYẾT ĐỊNH: và các Điều');
kiem(!/Kính gửi/.test(qd.noi_dung), 'quyết định không có dòng Kính gửi');

ket('bang_phu_luc');
