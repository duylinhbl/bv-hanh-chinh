// Edge Function: tự lập & gửi BÁO CÁO CÔNG TÁC TUẦN cho Văn phòng Công ty (15h thứ 5 hằng tuần, pg_cron 08:00 UTC).
// Nguồn: bảng lich_cong_tac (huy=false, rieng_tu=false). Mẫu Word nằm trong Drive, lấy qua Apps Script; thư mail gửi qua Apps Script.
// Gọi: header x-push-key (cron) hoặc đăng nhập quản trị. Tham số body: { dry:true } chỉ xem trước, { ngay:'YYYY-MM-DD' } giả lập ngày, { force:true } gửi lại dù tuần này đã gửi.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { unzipSync, zipSync } from 'npm:fflate@0.8.2';
import { dienMau, dongCongViec, dongKeHoach, ngayVN, noiDungMail, tenFile, tieuDeMail, tinhTuan } from './lib.ts';

const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-push-key', 'Content-Type': 'application/json' };
const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
const b64d = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64e = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: H });
  const url = Deno.env.get('SUPABASE_URL')!;
  const sv = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  let body: any = {}; try { body = await req.json(); } catch (_) { /* không có body */ }
  const { data: bm } = await sv.from('bi_mat').select('k,v');
  const cfg: Record<string, string> = Object.fromEntries((bm || []).map((x: any) => [x.k, x.v]));

  // Quyền: cron (x-push-key) hoặc quản trị đăng nhập
  let nguon = '';
  const key = req.headers.get('x-push-key');
  if (key && key === cfg.push_key) nguon = 'cron';
  else {
    const uc = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    const { data: u } = await uc.auth.getUser();
    const { data: nd } = u?.user ? await sv.from('nguoi_dung').select('la_quan_tri').eq('auth_id', u.user.id).maybeSingle() : { data: null };
    if (!nd?.la_quan_tri) return out({ loi: 'Không có quyền' }, 403);
    nguon = 'quan tri';
  }

  const now = body.ngay ? new Date(body.ngay + 'T08:00:00Z') : new Date();
  const t = tinhTuan(now);
  const dry = !!body.dry;
  let buoc = 'khởi tạo';
  const ghiLog = async (ok: boolean, soViec: number, loi?: string) => {
    try { await sv.from('bc_tuan_log').insert({ tu: t.tb_tu, nguon, ok, dry, so_viec: soViec, loi: loi?.slice(0, 400) }); } catch (_) { /* bỏ qua */ }
  };
  const baoAdmin = async (tieu: string, noi: string) => {
    try {
      const { data: ad } = await sv.from('nguoi_dung').select('id').eq('la_quan_tri', true).eq('hoat_dong', true);
      await fetch(url + '/functions/v1/gui-push', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-push-key': cfg.push_key }, body: JSON.stringify({ nguoi: (ad || []).map((x: any) => x.id), tieu, noi, url: './', tag: 'bc-tuan' }) });
    } catch (_) { /* bỏ qua */ }
  };
  try {
    if (!dry && nguon === 'cron' && cfg.bc_tuan_tat === '1') return out({ ok: true, bo_qua: 'Đang tắt (bi_mat.bc_tuan_tat=1)' });
    if (!dry && !body.force) { // chống gửi trùng khi cron thử lại
      const { data: da } = await sv.from('bc_tuan_log').select('id').eq('tu', t.tb_tu).eq('ok', true).eq('dry', false).limit(1);
      if (da?.length) return out({ ok: true, bo_qua: 'Tuần ' + t.tb_tu + ' đã gửi rồi' });
    }
    buoc = 'đọc lịch công tác';
    const lay = async (tu: string, den: string) => {
      const { data, error } = await sv.from('lich_cong_tac').select('ngay,gio_bd,noi_dung,dia_diem').eq('huy', false).eq('rieng_tu', false).gte('ngay', tu).lte('ngay', den).order('ngay').order('gio_bd');
      if (error) throw new Error(error.message);
      return data || [];
    };
    const [tb, kh] = await Promise.all([lay(t.tb_tu, t.tb_den), lay(t.kh_tu, t.kh_den)]);
    const cv = dongCongViec(tb), kq = dongKeHoach(kh);
    if (dry && !body.mau) return out({ ok: true, dry: true, tuan: t, cong_viec: cv, ke_hoach: kq, ten_file: tenFile(t.tb_tu, t.tb_den) });

    if (!cfg.kh_script_url || !cfg.kh_token) throw new Error('Chưa cấu hình Apps Script (kh_script_url / kh_token)');
    const goi = async (b: any) => {
      const res = await fetch(cfg.kh_script_url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ token: cfg.kh_token, ...b }), redirect: 'follow' });
      const tx = await res.text();
      try { return JSON.parse(tx); } catch (_) { throw new Error('Apps Script trả lỗi HTTP ' + res.status + ' (chưa cập nhật mã BaoCaoTuan.gs?)'); }
    };
    buoc = 'lấy mẫu Word từ Drive';
    const m = await goi({ action: 'bc_mau' });
    if (!m.ok || !m.b64) throw new Error(m.loi || 'Không lấy được mẫu Word');
    buoc = 'lập file Word';
    const zip = unzipSync(b64d(m.b64));
    if (!zip['word/document.xml']) throw new Error('Mẫu Word không đúng định dạng');
    const xml = dienMau(new TextDecoder().decode(zip['word/document.xml']), t, cv, kq);
    zip['word/document.xml'] = new TextEncoder().encode(xml);
    const docx = zipSync(zip, { level: 6 });
    const ten = tenFile(t.tb_tu, t.tb_den);
    if (dry) return out({ ok: true, dry: true, tuan: t, cong_viec: cv, ke_hoach: kq, ten_file: ten, kich_thuoc: docx.length });

    buoc = 'gửi thư cho Văn phòng Công ty';
    const to = cfg.bc_tuan_to || 'vanphong@caosudautieng.com.vn';
    const r = await goi({ action: 'bc_gui', to, bcc: cfg.bc_tuan_bcc || 'duylinhbl@gmail.com', reply_to: 'duylinhbl@gmail.com', subject: tieuDeMail, body: noiDungMail(t.tb_tu, t.kh_tu), filename: ten, b64: b64e(docx), mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    if (!r.ok) throw new Error(r.loi || 'Apps Script không gửi được thư');
    await ghiLog(true, cv.length + kq.length - 1);
    const gio = ngayVN(new Date()).toISOString().slice(11, 16);
    await baoAdmin('✓ Đã gửi báo cáo tuần cho VP Công ty', `${ten.replace('.docx', '')} · ${gio}${r.luu_drive ? '' : ' · (chưa lưu được vào Drive)'}`);
    return out({ ok: true, da_gui_den: to, ten_file: ten, cong_viec: cv, ke_hoach: kq, luu_drive: !!r.luu_drive });
  } catch (e) {
    const loi = String((e as Error).message || e);
    await ghiLog(false, 0, buoc + ': ' + loi);
    if (!dry) await baoAdmin('⚠ Báo cáo tuần chưa gửi được', `Lỗi ở bước "${buoc}": ${loi}. Anh tự gửi tay, hoặc sửa lỗi rồi gọi lại (force).`.slice(0, 220));
    return out({ ok: false, buoc, loi }, 500);
  }
});
