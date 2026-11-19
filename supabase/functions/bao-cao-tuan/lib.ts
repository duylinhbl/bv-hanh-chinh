export type Lich = { ngay: string; gio_bd?: string | null; noi_dung: string; dia_diem?: string | null };

const pad = (n: number) => String(n).padStart(2, '0');
export function ngayVN(d: Date): Date { return new Date(d.getTime() + 7 * 3600e3); }
const iso = (d: Date) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
const dmy = (s: string) => s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
const cong = (d: Date, n: number) => new Date(d.getTime() + n * 86400e3);

export function tinhTuan(now: Date) {
  const vn = ngayVN(now);
  const t2 = cong(new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate())), -((vn.getUTCDay() + 6) % 7));
  const t = { tb_tu: iso(t2), tb_den: iso(cong(t2, 4)), kh_tu: iso(cong(t2, 7)), kh_den: iso(cong(t2, 11)), hom_nay: iso(vn) };
  return { ...t, dmy };
}

const NN = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
const SU_KIEN = /^(tap huan|hoi nghi|hoi thao|hop|hoi chan|lop|khoa hoc|sinh hoat|le |dai hoi|dien dan|toa dam|giao ban)/;
const DONG_TU = /^(tham du|thuc hien|to chuc|dua|don|tiep|kiem tra|giam sat|trien khai|lam viec|du |phoi hop|ho tro|ra soat|danh gia|nghiem thu|ky |trao|khai mac|bao cao|xay dung|hoan thien)/;
// Dòng phụ không phải nội dung công việc -> không đưa vào báo cáo
const BO_DONG = /^(thanh phan|tp|dia diem|thoi gian|luu y|ghi chu|chuan bi|nguoi chu tri|chu tri)\b/;

export function motDong(noiDung: string): string {
  const dong = String(noiDung || '').replace(/\r/g, '').split('\n').map((x) => x.trim()).filter(Boolean);
  let s = dong[0] || '';
  s = s.replace(/^\s*[-•*–]+\s*/, '').replace(/^\s*\d{1,2}\s*(h|giờ|:)\s*\d{0,2}\s*(-|–|đến)?\s*(\d{1,2}\s*(h|giờ|:)\s*\d{0,2})?\s*[:,-]?\s*/i, '');
  s = s.replace(/\s*\(?\s*(thành phần|tp)\s*[:：].*$/i, '');
  // dấu ; chỉ cắt khi phần sau là chú thích (thành phần, địa điểm…); còn lại là liệt kê -> đổi thành dấu phẩy
  s = s.split(';').map((x) => x.trim()).filter((x, i) => x && (i === 0 || !BO_DONG.test(NN(x)))).join(', ');
  s = s.replace(/\s*(,|–|-)?\s*(lúc|vào lúc)\s+\d{1,2}\s*(h|giờ)\s*\d{0,2}.*$/i, '');
  s = s.replace(/\s+/g, ' ').trim().replace(/[.;,:]+$/, '');
  if (!s) return '';
  const n = NN(s);
  if (!DONG_TU.test(n)) s = (SU_KIEN.test(n) ? 'Tham dự ' : 'Thực hiện ') + s.charAt(0).toLowerCase() + s.slice(1);
  else s = s.charAt(0).toUpperCase() + s.slice(1);

  // GIỮ các mục liệt kê ở những dòng sau (vd danh sách thiết bị, danh sách đơn vị):
  // báo cáo gửi Công ty phải nêu đủ, không được cụt như "Thực hiện nhận trang thiết bị y tế."
  const muc = dong.slice(1)
    .map((x) => x.replace(/^\s*(\d{1,2}\s*[.)]|[-•*–+])\s*/, '').replace(/\s+/g, ' ').replace(/[.;,:]+$/, '').trim())
    .filter((x) => x.length > 1 && x.length <= 120 && !BO_DONG.test(NN(x)));
  if (muc.length) {
    const HOA = (c: string) => !!c && c === c.toUpperCase() && c !== c.toLowerCase();
    // giữ nguyên chữ hoa nếu là tên riêng/viết tắt (BV, CSDT, TTYT…), còn lại viết thường cho liền câu
    const ds = muc.map((x) => (HOA(x.charAt(0)) && HOA(x.charAt(1)) ? x : x.charAt(0).toLowerCase() + x.slice(1)));
    s = s.replace(/[:.]+$/, '') + ': ' + ds.join(', ');
    if (s.length > 400) s = s.slice(0, 397).replace(/,[^,]*$/, '') + '…';
  }
  return s.replace(/[.]+$/, '') + '.';
}

export const DONG_DUY_TRI = '- Duy trì công tác tiếp nhận cấp cứu, khám chữa bệnh.';

export function dongTuan(rows: Lich[]): string[] {
  const xep = [...rows].sort((a, b) => (a.ngay + (a.gio_bd || '')).localeCompare(b.ngay + (b.gio_bd || '')));
  const thay = new Set<string>(), out: string[] = [];
  for (const r of xep) {
    const d = motDong(r.noi_dung);
    if (!d) continue;
    const k = NN(d);
    if (thay.has(k)) continue;
    thay.add(k); out.push('- ' + d);
  }
  return out;
}
export const dongCongViec = (rows: Lich[]) => { const d = dongTuan(rows); return d.length ? d : [DONG_DUY_TRI]; };
export const dongKeHoach = (rows: Lich[]) => [...dongTuan(rows), DONG_DUY_TRI];

export const tenFile = (tu: string, den: string) =>
  `BAO CAO CONG TAC TUAN ${tu.slice(8, 10)} thang ${tu.slice(5, 7)} - ${den.slice(8, 10)} tháng ${den.slice(5, 7)} nam ${den.slice(0, 4)}.docx`;

export const tieuDeMail = (dinhChinh = false) => dinhChinh ? 'Bệnh viện đa khoa (đính chính)' : 'Bệnh viện đa khoa';
export const noiDungMail = (tuTB: string, tuKH: string, dinhChinh = false) =>
  `Bệnh viện đa khoa kính gửi VPCTY báo cáo tuần ${dmy(tuTB)} và phương hướng tuần ${dmy(tuKH)}` +
  (dinhChinh ? ' (bản đính chính, thay thế bản đã gửi trước đó do có cập nhật bổ sung lịch công tác)' : '') + '\n\nTrân trọng,';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function dienMau(xml: string, t: ReturnType<typeof tinhTuan>, congViec: string[], keHoach: string[]): string {
  const nhan = (token: string, dong: string[]) => {
    const i = xml.indexOf('{{' + token + '}}');
    if (i < 0) throw new Error('Mẫu thiếu ô {{' + token + '}}');
    const a = xml.lastIndexOf('<w:p ', i), b = xml.indexOf('</w:p>', i) + 6;
    const mau = xml.slice(a, b).replace(/ w14:(paraId|textId)="[^"]*"/g, '');
    xml = xml.slice(0, a) + dong.map((d) => mau.replace('{{' + token + '}}', esc(d))).join('') + xml.slice(b);
  };
  nhan('CONG_VIEC', congViec);
  nhan('KE_HOACH', keHoach);
  const [y, m, d] = t.hom_nay.split('-');
  const v: Record<string, string> = { D: d, M: m, Y: y, TU_TB: dmy(t.tb_tu), DEN_TB: dmy(t.tb_den), TU_KH: dmy(t.kh_tu), DEN_KH: dmy(t.kh_den) };
  xml = xml.replace(/\{\{([A-Z_]+)\}\}/g, (_m, k) => { if (!(k in v)) throw new Error('Ô lạ {{' + k + '}}'); return v[k]; });
  return xml;
}
