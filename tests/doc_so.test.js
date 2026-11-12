// Kiểm thử đọc số tiền trên hồ sơ (timSo) – chạy: node tests/doc_so.test.js
const { kiem, ket, docGs } = require('./lib');
const { timSo, bangChu } = new Function(docGs() + ';return {timSo,bangChu}')();
console.log('Đọc số bằng chữ');
kiem(bangChu('Tám triệu năm trăm bốn mươi nghìn bảy trăm tám mươi đồng') === 8540780, '8.540.780');
kiem(bangChu('Một triệu không trăm linh năm nghìn đồng') === 1005000, '1.005.000 (linh/không trăm)');
kiem(bangChu('Mười hai triệu đồng chẵn') === 12000000, '12.000.000');
kiem(bangChu('Hai mươi mốt triệu') === 0 || bangChu('Hai mươi mốt triệu') >= 20000000, 'không sập khi gặp từ lạ');
console.log('Giấy đề nghị thanh toán trong hồ sơ nhiều chứng từ');
const dntt = [
  'CÔNG TY CAO SU ĐẦU TIẾNG', 'GIẤY ĐỀ NGHỊ THANH TOÁN', 'Kính gửi: Giám đốc', 'Nội dung | Số tiền',
  'Bảo trì xe máy | 8.540.780', 'Tổng cộng: 8.540.780',
  '(Số tiền bằng chữ: Tám triệu năm trăm bốn mươi nghìn bảy trăm tám mươi đồng)',
  'HÓA ĐƠN GTGT', 'Tổng cộng 8.610.000', 'SĐT liên hệ 0903123456'].join('\n');
let r = timSo(dntt);
kiem(r.best === 8540780, 'lấy 8.540.780 theo Giấy đề nghị, không lấy 8.610.000 của hóa đơn');
kiem(r.khop === true && /đề nghị/i.test(r.nguon), 'đánh dấu khớp số bằng chữ');
kiem(r.cands.indexOf(903123456) < 0 && r.cands.indexOf(3123456) < 0, 'bỏ qua số điện thoại');
console.log('OCR sai một ký tự');
r = timSo(dntt.replace('Tám triệu', 'Tém triệu').replace('nghìn', 'nghin'));
kiem(r.best === 8540780, 'vẫn đọc được khi OCR sai dấu/ký tự');
console.log('Không có Giấy đề nghị');
r = timSo('Hóa đơn\nThành tiền 2.000.000\nTổng cộng 2.200.000\n(Số tiền bằng chữ: Hai triệu hai trăm nghìn đồng)');
kiem(r.best === 2200000 && r.khop, 'dùng số bằng chữ khớp với số trong hồ sơ');
r = timSo('Thành tiền 1.500.000\nTổng cộng 1.650.000');
kiem(r.best === 1650000 && !r.khop, 'chỉ có "tổng cộng": lấy số đó nhưng không đánh dấu khớp');
r = timSo('');
kiem(r.best === 0, 'hồ sơ trống: trả 0, không sập');
ket('doc_so');
