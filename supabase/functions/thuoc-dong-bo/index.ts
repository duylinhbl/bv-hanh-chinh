// Quét kho tờ hướng dẫn sử dụng thuốc trên Drive, dựng danh mục tra cứu trong bảng `thuoc`.
// Chỉ lưu TÊN và ID tệp, không chép nội dung PDF: khoa Dược sửa tệp nào là app thấy ngay tệp đó.
import { createClient } from 'npm:@supabase/supabase-js@2';

const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-push-key', 'Content-Type': 'application/json' };
const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });

const kd = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();

// "Kacerin (Cetirizin dihydroclorid 10mg).pdf" -> ten, hoat_chat, ham_luong
// "Kim tiền thảo.pdf"                          -> chỉ có ten
const LIEU = /\s*(\d[\d.,]*\s*(?:mg\/ml|mcg\/ml|g\/ml|mg|mcg|g|ml|l|iu|ui|%)(?:\s*\/\s*\d*[\d.,]*\s*(?:mg|mcg|g|ml))?)\s*$/i;
export function tachTen(tenTep: string) {
  const t = tenTep.replace(/\.pdf$/i, '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.+?)\s*\(([^()]*)\)\s*$/);
  if (!m) {
    const d = t.match(LIEU);
    return d ? { ten: t.slice(0, d.index).trim(), hoat_chat: '', ham_luong: d[1].trim() }
             : { ten: t, hoat_chat: '', ham_luong: '' };
  }
  const ten = m[1].trim(); let trong = m[2].trim(); let ham = '';
  const d = trong.match(LIEU);
  if (d) { ham = d[1].trim(); trong = trong.slice(0, d.index).trim(); }
  return { ten, hoat_chat: trong, ham_luong: ham };
}

type Tep = { id: string; ten: string; chu_cai: string; byte: number; sua_luc: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: H });
  const url = Deno.env.get('SUPABASE_URL')!;
  const sv = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: bm } = await sv.from('bi_mat').select('k,v');
  const cfg: Record<string, string> = Object.fromEntries((bm || []).map((x: {k:string;v:string}) => [x.k, x.v]));

  // cron dùng x-push-key; người dùng phải là quản trị
  let quanTri = req.headers.get('x-push-key') === cfg.push_key;
  if (!quanTri) {
    const uc = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    const { data: u } = await uc.auth.getUser();
    if (u?.user) {
      const { data: nd } = await sv.from('nguoi_dung').select('la_quan_tri').eq('auth_id', u.user.id).maybeSingle();
      quanTri = !!nd?.la_quan_tri;
    }
  }
  if (!quanTri) return out({ loi: 'Không có quyền' }, 403);

  try {
    if (!cfg.thuoc_thu_muc) throw new Error('Chưa cấu hình bi_mat.thuoc_thu_muc (id thư mục kho trên Drive)');
    if (!cfg.kh_script_url || !cfg.kh_token) throw new Error('Chưa cấu hình Apps Script');

    const res = await fetch(cfg.kh_script_url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, redirect: 'follow',
      body: JSON.stringify({ token: cfg.kh_token, action: 'thuoc_quet', thu_muc: cfg.thuoc_thu_muc }),
    });
    const tx = await res.text();
    let r: { ok?: boolean; loi?: string; ds?: Tep[]; so_tep?: number; cat_bot?: boolean };
    try { r = JSON.parse(tx) } catch (_) { throw new Error('Apps Script trả lỗi HTTP ' + res.status + ' (chưa dán ThuocKho.gs?)') }
    if (!r.ok) throw new Error(r.loi || 'Apps Script không quét được kho');

    const ds = r.ds || [];
    const hang = ds.map((f) => {
      const t = tachTen(f.ten);
      return { drive_id: f.id, ten: t.ten, hoat_chat: t.hoat_chat, ham_luong: t.ham_luong,
        ten_tep: f.ten, chu_cai: f.chu_cai || t.ten.charAt(0).toUpperCase(),
        byte: f.byte, sua_luc: f.sua_luc, quet_luc: new Date().toISOString(),
        kd: kd([t.ten, t.hoat_chat, t.ham_luong].filter(Boolean).join(' ')) };
    });

    // cập nhật theo lô, giữ nguyên cột bv_dung và ghi_chu do khoa Dược đánh dấu
    for (let i = 0; i < hang.length; i += 500) {
      const { error } = await sv.from('thuoc').upsert(hang.slice(i, i + 500), { onConflict: 'drive_id' });
      if (error) throw error;
    }
    // tệp đã bị gỡ khỏi kho thì bỏ khỏi danh mục
    let xoa = 0;
    const con = new Set(ds.map((f) => f.id));
    const { data: cu } = await sv.from('thuoc').select('drive_id');
    const bo = (cu || []).map((x: {drive_id:string}) => x.drive_id).filter((id: string) => !con.has(id));
    if (bo.length && !r.cat_bot) { await sv.from('thuoc').delete().in('drive_id', bo); xoa = bo.length }

    return out({ ok: true, so_tep: ds.length, da_ghi: hang.length, da_xoa: xoa, cat_bot: !!r.cat_bot });
  } catch (e) {
    return out({ ok: false, loi: String((e as Error).message || e) }, 500);
  }
});
