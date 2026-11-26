// Kiểm thử các quy tắc giao diện đã áp theo Web Interface Guidelines (Vercel).
// Mục đích: sau này ai sửa làm mất một quy tắc thì bài này đỏ ngay, không phải phát hiện bằng mắt.
const { kiem, ket } = require('./lib');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const doc = f => fs.readFileSync(path.join(root, f), 'utf8');

const html = doc('index.html'), css = doc('style.css'), app = doc('app.js');

// ---- Không chặn phóng to, cỡ chữ ô nhập ≥16px (iPhone tự phóng khi nhỏ hơn) ----
kiem(/viewport-fit=cover/.test(html) && !/user-scalable=no|maximum-scale/.test(html),
  'không chặn người dùng phóng to trang');
kiem(/body\{[^}]*font:16px/.test(css), 'cỡ chữ nền 16px, ô nhập kế thừa nên iPhone không tự phóng');
kiem(/input,select,textarea\{[^}]*font:inherit/.test(css), 'ô nhập kế thừa cỡ chữ, không đặt nhỏ hơn');

// ---- Vùng chạm ----
kiem(/input,select,textarea\{[^}]*min-height:48px/.test(css), 'ô nhập cao tối thiểu 48px');
kiem(/\.chip\.them,\.mut a,a\.nho\{[^}]*min-height:44px/.test(css), 'liên kết nhỏ lẫn trong chữ vẫn đủ 44px để chạm');

// ---- Focus thấy được bằng bàn phím ----
kiem(/:focus-visible\{outline:/.test(css), 'có viền focus rõ khi đi bằng bàn phím');
kiem(/\.boqua\{/.test(css) && /class="boqua" href="#nd"/.test(html), 'có liên kết "Bỏ qua, tới nội dung"');

// ---- Nút đang xử lý: GIỮ nhãn, thêm vòng xoay ----
kiem(/function ban\(b,on=true\)/.test(app), 'có hàm ban() dùng chung cho trạng thái đang xử lý');
kiem(/\[aria-busy="true"\]\{pointer-events:none/.test(css), 'nút đang xử lý thì chặn bấm tiếp');
kiem(/button\[aria-busy="true"\]::after/.test(css), 'nút đang xử lý có vòng xoay');
const doiNhan = /\.textContent\s*=\s*'Đang /.test(app) || /\.textContent\s*=\s*'Đang /.test(doc('kh.js'))
             || /\.textContent\s*=\s*'Đang /.test(doc('thuoc.js')) || /\.textContent\s*=\s*'Đang /.test(doc('tc.js'));
kiem(!doiNhan, 'không còn nút nào đổi nhãn thành "Đang…" khi chạy (mất chỗ bám của người dùng)');

// ---- Chuyển động ----
kiem(/@media \(prefers-reduced-motion:reduce\)/.test(css), 'tôn trọng người tắt hiệu ứng chuyển động');
kiem(!/transition:\s*all/.test(css), 'không dùng transition:all');

// ---- Màu nền và chế độ sáng/tối ----
kiem(/color-scheme:light dark/.test(css), 'khai báo color-scheme để ô nhập và thanh cuộn theo đúng chế độ');
kiem(/name="color-scheme"/.test(html), 'có thẻ meta color-scheme');
kiem(/theme-color" media="\(prefers-color-scheme: dark\)"/.test(html), 'màu thanh trạng thái có bản cho nền tối');
kiem(/select,select option\{background-color/.test(css), 'select đặt rõ nền và màu chữ (Windows hay lỗi trắng trên trắng)');

// ---- Số liệu thẳng cột ----
kiem(/font-variant-numeric:tabular-nums/.test(css), 'số dùng chữ số đều để xếp cột thẳng hàng');

// ---- Nút Back của điện thoại ----
kiem(/history\.pushState\(\{tab:t\}/.test(app), 'đổi tab có ghi vào lịch sử trình duyệt');
kiem(/addEventListener\('popstate'/.test(app), 'bấm Back quay lại tab trước thay vì thoát app');

// ---- Biểu mẫu ----
kiem(/<label for="sdt">/.test(app) && /<label for="mk">/.test(app), 'nhãn gắn với ô nhập, bấm nhãn là con trỏ nhảy vào ô');
kiem(/autocomplete="username"/.test(app) && /autocomplete="current-password"/.test(app), 'khai báo autocomplete cho trình quản lý mật khẩu');
kiem(/inputmode="tel"/.test(app), 'ô số điện thoại mở bàn phím số');
kiem(/\$\('#mk'\)\.onkeydown=e=>\{if\(e\.key==='Enter'\)/.test(app), 'Enter ở ô mật khẩu là đăng nhập luôn');
kiem(/id="loi" role="alert"/.test(app), 'báo lỗi đăng nhập có role=alert để trình đọc màn hình đọc lên');

// ---- Thông báo bất đồng bộ ----
kiem(/id="toast" role="status"/.test(html), 'toast có role=status (aria-live)');

// ---- Nút chỉ có biểu tượng phải có nhãn ----
kiem(/id="tcdong" aria-label="Đóng chi tiết"/.test(doc('tc.js')), 'nút đóng chỉ có dấu ✕ vẫn có aria-label');

// ---- Thẻ bấm được phải dùng được bằng bàn phím ----
kiem(/function nutHoa\(goc\)/.test(app) && /setAttribute\('role','button'\)/.test(app),
  'thẻ <div> bấm được tự được gắn role=button và tabindex');
kiem(/if\(e\.key!=='Enter'&&e\.key!==' '\)return;/.test(app), 'Enter và Space bấm được thẻ như chuột');

// ---- Cảm ứng và chữ ----
kiem(/touch-action:manipulation/.test(css), 'touch-action:manipulation để bỏ độ trễ 300ms khi chạm');
kiem(/text-wrap:balance/.test(css), 'tiêu đề cân dòng');

// ---- Ảnh ----
kiem(!/<img(?![^>]*alt=)[^>]*>/.test(app) && !/<img(?![^>]*alt=)[^>]*>/.test(doc('kh.js')), 'mọi thẻ ảnh đều có alt');
kiem(/loading="lazy"/.test(app), 'ảnh đính kèm tải trễ');
kiem(/class="lg" src="logo.png" alt="" width="36" height="36"/.test(app), 'logo khai báo kích thước, không gây nhảy bố cục');

// ---- Màu thương hiệu và tương phản (tính thẳng từ biến trong style.css) ----
const bien = kh => {
  const m = css.match(new RegExp('--' + kh + ':\\s*(#[0-9a-fA-F]{3,8})'));
  return m ? m[1] : null;
};
const bienToi = kh => {
  const khoi = css.slice(css.indexOf('@media (prefers-color-scheme:dark)'));
  const m = khoi.match(new RegExp('--' + kh + ':\\s*(#[0-9a-fA-F]{3,8})'));
  return m ? m[1] : null;
};
const sang = h => {
  h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join('');
  const v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const tuongPhan = (a, b) => { const [x, y] = [sang(a), sang(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) };

kiem(bien('pri2') === '#0B4A36' && bien('pri') === '#0B6B4B' && bien('gold') === '#F2B544',
  'dùng đúng màu thương hiệu bệnh viện (xanh đậm, xanh trung, vàng hổ phách)');
kiem(/'Be Vietnam Pro'/.test(css) && /family=Be\+Vietnam\+Pro/.test(html), 'một họ chữ Be Vietnam Pro cho tất cả');
kiem(!/--blue:|#7c3aed/.test(css), 'bỏ xanh dương và tím, chỉ còn thang màu của thương hiệu');
kiem(!/background:linear-gradient\(90deg,rgba\(192,54,44/.test(css), 'bỏ gradient trang trí trên thẻ quá hạn');
kiem(!/text-transform:uppercase/.test(css), 'không viết hoa toàn bộ cho nhãn');

const cap = [
  ['chữ trên nút xanh (nền sáng)', bien('pri-tx'), bien('pri')],
  ['chữ trên nút xanh (nền tối)', bienToi('pri-tx'), bienToi('pri')],
  ['chữ thường (nền sáng)', bien('tx'), bien('bg')],
  ['chữ thường (nền tối)', bienToi('tx'), bienToi('bg')],
  ['chữ mờ (nền sáng)', bien('mut'), bien('bg')],
  ['chữ mờ (nền tối)', bienToi('mut'), bienToi('bg')],
];
cap.forEach(([ten, a, b]) => {
  const v = a && b ? tuongPhan(a, b) : 0;
  kiem(v >= 4.5, `tương phản ${ten} đạt 4.5:1 (được ${v.toFixed(2)})`);
});

ket('giao_dien_chuan');
