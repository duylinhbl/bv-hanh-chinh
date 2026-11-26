// Quét kho tờ hướng dẫn sử dụng thuốc trên Drive, dựng danh mục tra cứu trong bảng `thuoc`.
//
// Hai nguyên tắc:
//  1. CHỈ lưu tên và id tệp, không chép nội dung PDF — khoa Dược sửa tệp nào là app thấy ngay tệp đó,
//     không bao giờ có hai phiên bản lệch nhau.
//  2. KHÔNG tách tên ở đây. Tên biệt dược / hoạt chất / hàm lượng / cột tìm không dấu do trigger
//     `tr_thuoc_tu_tach` trong CSDL sinh ra (xem supabase/sql/thuoc.sql). Một bộ tách duy nhất,
//     không có bản thứ hai để lệch.
//
// Đi qua cầu nối Apps Script sẵn có (routes dc_con / dc_ds trong DoiChieu.gs) nên không cần dán thêm gì.
import { createClient } from 'npm:@supabase/supabase-js@2';

const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-push-key', 'Content-Type': 'application/json' };
const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });

type Tep = { id: string; ten: string; mime: string; size: number; sua: string };
type ThuMuc = { id: string; ten: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: H });
  const url = Deno.env.get('SUPABASE_URL')!;
  const sv = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: bm } = await sv.from('bi_mat').select('k,v');
  const cfg: Record<string, string> = Object.fromEntries((bm || []).map((x: { k: string; v: string }) => [x.k, x.v]));

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

  // Một hạn chót duy nhất tính từ lúc nhận yêu cầu, thấp hơn mức nền tảng cắt (150s),
  // để quét dở còn kịp trả lời thay vì bị cắt giữa đường.
  const batDau = Date.now();
  const HAN = 120_000;
  const conKip = () => Date.now() - batDau < HAN;

  async function cau(body: Record<string, unknown>) {
    const res = await fetch(cfg.kh_script_url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, redirect: 'follow',
      body: JSON.stringify({ token: cfg.kh_token, ...body }),
    });
    const tx = await res.text();
    try { return JSON.parse(tx) } catch (_) { throw new Error('Cầu nối Apps Script trả lỗi HTTP ' + res.status) }
  }

  try {
    const goc = cfg.thuoc_thu_muc;
    if (!goc) throw new Error('Chưa cấu hình bi_mat.thuoc_thu_muc (id thư mục kho trên Drive)');
    if (!cfg.kh_script_url || !cfg.kh_token) throw new Error('Chưa cấu hình cầu nối Apps Script');

    // Tầng 1: các thư mục con (kho khoa Dược xếp theo chữ cái) + tệp nằm ngay ở gốc
    const r0 = await cau({ action: 'dc_con', folder_id: goc, goc: [goc] });
    if (!r0.ok) throw new Error(r0.chua_chia_se
      ? 'Chưa mở được thư mục kho — khoa Dược cần chia sẻ cho tài khoản chạy script (quyền Người xem)'
      : (r0.loi || 'Không đọc được thư mục kho'));

    const hang: Record<string, unknown>[] = [];
    const quetLuc = new Date().toISOString();
    const them = (f: Tep, chuCai: string) => {
      if (f.mime !== 'application/pdf') return;
      hang.push({ drive_id: f.id, ten_tep: f.ten, chu_cai: chuCai, byte: f.size, sua_luc: f.sua, quet_luc: quetLuc });
    };

    (r0.files as Tep[] || []).forEach((f) => them(f, (f.ten || '?').charAt(0).toUpperCase()));

    // Tầng 2: từng thư mục chữ cái. `cat` = thư mục vượt trần 400 tệp của cầu nối.
    const thu = (r0.thu_muc as ThuMuc[]) || [];
    let thieu = 0;
    for (const t of thu) {
      if (!conKip()) { thieu += 1; continue }
      const r = await cau({ action: 'dc_ds', folder_id: t.id, goc: [t.id] });
      if (!r.ok) { thieu += 1; continue }
      if (r.cat) thieu += 1;
      (r.files as Tep[] || []).forEach((f) => them(f, t.ten));
    }

    if (!hang.length) throw new Error('Kho không có tệp PDF nào');

    for (let i = 0; i < hang.length; i += 500) {
      const { error } = await sv.from('thuoc').upsert(hang.slice(i, i + 500), { onConflict: 'drive_id' });
      if (error) throw error;   // bv_dung và ghi_chu do khoa Dược đánh dấu được giữ nguyên
    }

    // Chỉ gỡ tệp không còn trong kho khi đã quét ĐỦ — quét dở mà gỡ là xoá oan cả danh mục.
    let xoa = 0;
    if (!thieu) {
      const con = new Set(hang.map((h) => h.drive_id as string));
      const { data: cu } = await sv.from('thuoc').select('drive_id');
      const bo = (cu || []).map((x: { drive_id: string }) => x.drive_id).filter((id: string) => !con.has(id));
      if (bo.length) { await sv.from('thuoc').delete().in('drive_id', bo); xoa = bo.length }
    }

    return out({
      ok: true, so_thu_muc: thu.length, da_ghi: hang.length, da_xoa: xoa, thieu,
      giay: Math.round((Date.now() - batDau) / 1000),
    });
  } catch (e) {
    return out({ ok: false, loi: String((e as Error).message || e) }, 500);
  }
});
