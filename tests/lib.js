// Tiện ích dùng chung cho các bài kiểm thử (không cần cài thư viện nào)
const fs = require('fs'), path = require('path');
let loi = 0, dat = 0;
exports.kiem = (cond, ten) => { if (cond) { dat++; console.log('  ✓ ' + ten); } else { loi++; console.log('  ✗ ' + ten); } };
exports.ket = (ten) => { console.log((loi ? '✗ ' : '✓ ') + ten + ': ' + dat + ' đạt, ' + loi + ' lỗi'); process.exit(loi ? 1 : 0); };
exports.docGs = () => fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'CauNoi_BangThuChi.gs'), 'utf8');
