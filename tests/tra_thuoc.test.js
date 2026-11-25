// Kiểm thử tách tên thuốc từ tên tệp PDF của kho tờ hướng dẫn sử dụng
// (lấy thẳng hàm tachTen trong supabase/functions/thuoc-dong-bo/index.ts)
const { kiem, ket } = require('./lib');
const fs = require('fs'), path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/thuoc-dong-bo/index.ts'), 'utf8');
const i = src.indexOf('const LIEU =');
const j = src.indexOf('\n}', src.indexOf('export function tachTen')) + 2;
const ts = src.slice(i, j).replace(/export /g, '').replace(/\(tenTep: string\)/, '(tenTep)');
const tachTen = new Function(ts + '; return tachTen;')();

const t1 = tachTen('Kacerin (Cetirizin dihydroclorid 10mg).pdf');
kiem(t1.ten === 'Kacerin', 'lấy đúng tên biệt dược (được: ' + t1.ten + ')');
kiem(t1.hoat_chat === 'Cetirizin dihydroclorid', 'lấy đúng hoạt chất (được: ' + t1.hoat_chat + ')');
kiem(t1.ham_luong === '10mg', 'lấy đúng hàm lượng (được: ' + t1.ham_luong + ')');

const t2 = tachTen('Kim tiền thảo.pdf');
kiem(t2.ten === 'Kim tiền thảo' && !t2.hoat_chat && !t2.ham_luong, 'tên không có ngoặc thì giữ nguyên, không bịa hoạt chất');

const t3 = tachTen('Kalimate (Polystyren 5g).pdf');
kiem(t3.ten === 'Kalimate' && t3.hoat_chat === 'Polystyren' && t3.ham_luong === '5g', 'dạng gam');

const t4 = tachTen('Kidmin 200ml.pdf');
kiem(t4.ten === 'Kidmin' && t4.ham_luong === '200ml', 'hàm lượng nằm ngay trong tên, không có ngoặc');

const t5 = tachTen('Augmentin (Amoxicilin/Acid clavulanic 500mg/125mg).pdf');
kiem(t5.ten === 'Augmentin' && t5.hoat_chat === 'Amoxicilin/Acid clavulanic' && t5.ham_luong === '500mg/125mg',
  'thuốc phối hợp: giữ cả hai hoạt chất và cả hai hàm lượng (được: ' + t5.hoat_chat + ' | ' + t5.ham_luong + ')');

const t6 = tachTen('Khang minh tỷ viêm nang.pdf');
kiem(t6.ten === 'Khang minh tỷ viêm nang', 'thuốc đông y tên dài, không ngoặc');

const t7 = tachTen('Natri clorid 0,9% 500ml.pdf');
kiem(t7.ten === 'Natri clorid 0,9%' && t7.ham_luong === '500ml', 'số thập phân dùng dấu phẩy không làm hỏng việc tách');

const t8 = tachTen('  Kenmag .pdf');
kiem(t8.ten === 'Kenmag', 'cắt khoảng trắng thừa');

const t9 = tachTen('Insulin (Insulatard 100IU/ml).pdf');
kiem(t9.ham_luong.toLowerCase() === '100iu/ml', 'đơn vị IU/ml (được: ' + t9.ham_luong + ')');

ket('tra_thuoc');
