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

ket('bang_phu_luc');
