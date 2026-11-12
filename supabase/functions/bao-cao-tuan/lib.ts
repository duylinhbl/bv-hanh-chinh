// Phần thuần (không gọi mạng) của báo cáo công tác tuần – kiểm thử được bằng Node: tests/bao_cao_tuan.test.js
export type Lich = { ngay: string; gio_bd?: string | null; noi_dung: string; dia_diem?: string | null };

const pad = (n: number) => String(n).padStart(2, '0');
// Giờ Việt Nam (UTC+7) của một thời điểm
export function ngayVN(d: Date): Date { return new Date(d.getTime() + 7 * 3600e3); }
const iso = (d: Date) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
const dmy = (s: string) => s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
const cong = (d: Date, n: number) => new Date(d.getTime() + n * 86400e3);

// Tuần báo cáo = thứ 2–thứ 6 của tuần chứa "hôm nay"; tuần kế hoạch = thứ 2–thứ 6 tuần sau.
export function tinhTuan(now: Date) {
  const vn = ngayVN(now);
  const t2 = cong(new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate())), -((vn.getUTCDay() + 6) % 7));
  const t = { tb_tu: iso(t2), tb_den: iso(cong(t2, 4)), kh_tu: iso(cong(t2, 7)), kh_den: iso(cong(t2, 11)), hom_nay: iso(vn) };
  return { ...t, dmy };
}

const NN = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
// Từ đầu câu cho biết cần đặt động từ "Tham dự" (sự kiện) hay đã là động từ
const SU_KIEN = /^(tap huan|hoi nghi|hoi thao|hop|hoi chan|lop|khoa hoc|sinh hoat|le |dai hoi|dien dan|toa dam|giao ban)/;
const DONG_TU = /^(tham du|thuc hien|to chuc|dua|don|tiep|kiem tra|giam sat|trien khai|lam viec|du |phoi hop|ho tro|ra soat|danh gia|nghiem thu|ky |trao|khai mac|bao cao|xay dung|hoan thien)/;

// Một lịch -> MỘT dòng gạch đầu dòng ngắn gọn (bỏ giờ giấc, thành phần, rút còn một câu)
export function motDong(noiDung: string): string {
  let s = String(noiDung || '').replace(/\r/g, '').split('\n')[0];
  s = s.replace(/^\s*[-•*–]+\s*/, '').replace(/^\s*\d{1,2}\s*(h|giờ|:)\s*\d{0,2}\s*(-|–|đến)?\s*(\d{1,2}\s*(h|giờ|:)\s*\d{0,2})?\s*[:,-]?\s*/i, '');
  s = s.replace(/\s*\(?\s*(thành phần|tp)\s*[:：].*$/i, '').replace(/\s*[;]\s*.*$/, '');
  s = s.replace(/\s*(,|–|-)?\s*(lúc|vào lúc)\s+\d{1,2}\s*(h|giờ)\s*\d{0,2}.*$/i, '');
  s = s.replace(/\s+/g, ' ').trim().replace(/[.;,:]+$/, '');
  if (!s) return '';
  const n = NN(s);
  if (!DONG_TU.test(n)) s = SU_KIEN.test(n) ? 'Tham dự ' + s : 'Thực hiện ' + s.charAt(0).toLowerCase() + s.slice(1);
  else s = s.charAt(0).toUpperCase() + s.slice(1);
  return s + '.';
}

export const DONG_DUY_TRI = '- Duy trì công tác tiếp nhận cấp cứu, khám chữa bệnh.';

// Danh sách dòng cho một tuần (đã xếp theo ngày, giờ; gộp trùng nội dung)
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

export const tieuDeMail = 'Bệnh viện đa khoa';
export const noiDungMail = (tuTB: string, tuKH: string) =>
  `Bệnh viện đa khoa kính gửi VPCTY báo cáo tuần ${dmy(tuTB)} và phương hướng tuần ${dmy(tuKH)}\n\nTrân trọng,`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Điền mẫu word/document.xml: thay ô {{...}} và nhân đoạn {{CONG_VIEC}} / {{KE_HOACH}} cho mỗi dòng (giữ định dạng đoạn của mẫu)
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
