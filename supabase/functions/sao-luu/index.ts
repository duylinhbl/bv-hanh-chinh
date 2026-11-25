// Sao lưu đêm: TOÀN BỘ bảng (tự liệt kê, không viết cứng) + nội dung tệp đính kèm.
// Ghi kết quả vào sao_luu_log để bộ kiểm thử 03:30 và màn Sức khỏe hệ thống đọc được.
import { createClient } from 'npm:@supabase/supabase-js@2';

const TEP_TOI_DA = 3 * 1024 * 1024;   // bỏ qua tệp lớn hơn 3 MB
const TONG_TOI_DA = 40 * 1024 * 1024; // trần cho tổng số tệp nhúng vào một bản sao lưu
// Danh sách bảng dự phòng, chỉ dùng khi không gọi được ds_bang_sao_luu()
const DU_PHONG = ['nguoi_dung','khoa_phong','viec','cap_nhat_hien_trang','thong_bao','thong_bao_nguoi_nhan',
  'thong_bao_pham_vi','lich_cong_tac','lich_cong_tac_tp','lich_truc','lich_truc_ky','doi_truc','doi_truc_duyet',
  'nhom_truc','vi_tri_truc','cam_truc_chung','bao_cao','su_kien','nhat_ky_hoc','kh_dong','nhat_ky','kh_bo_log','loi_app'];

const b64 = (u: Uint8Array) => { let s=''; for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode(...u.subarray(i,i+0x8000)); return btoa(s) };

Deno.serve(async (req) => {
  const sv = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: k } = await sv.from('bi_mat').select('v').eq('k','push_key').maybeSingle();
  if (!k || req.headers.get('x-push-key') !== k.v) return new Response('no', { status: 403 });

  const ten = new Date(Date.now()+7*3600e3).toISOString().slice(0,10) + '.json';
  let soBang = 0, soDong = 0, soTep = 0, boQua: string[] = [];
  try {
    // 1) Bảng — lấy danh sách từ chính cơ sở dữ liệu, nên thêm bảng mới là tự có trong sao lưu
    let bang: string[] = DU_PHONG;
    const { data: ds, error: eDs } = await sv.rpc('ds_bang_sao_luu');
    if (!eDs && Array.isArray(ds) && ds.length) bang = ds.map((x: unknown) => typeof x === 'string' ? x : (x as {ds_bang_sao_luu: string}).ds_bang_sao_luu);

    const dump: Record<string, unknown> = { luc: new Date().toISOString(), bang_da_luu: bang };
    for (const t of bang) {
      const rows: unknown[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sv.from(t).select('*').range(from, from+999);
        if (error) { dump[t+'_loi'] = error.message; break }
        rows.push(...(data||[]));
        if (!data || data.length < 1000) break;
      }
      dump[t] = rows; soDong += rows.length; soBang++;
    }

    // 2) Tệp đính kèm — nội dung thật, không chỉ đường dẫn
    const tep: { ten: string; loai: string; b64: string }[] = [];
    let tongByte = 0, moCoi = 0;
    const coViec = new Set((dump.viec as {id: string}[] || []).map((v) => String(v.id)));
    const { data: thuMuc } = await sv.storage.from('anh').list('', { limit: 1000 });
    for (const tm of thuMuc || []) {
      if (tm.id) continue;                       // tệp nằm ngay gốc thì bỏ qua, mọi tệp đều trong thư mục của việc
      const { data: ds2 } = await sv.storage.from('anh').list(tm.name, { limit: 1000 });
      // Việc đã xóa mà tệp còn nằm lại: dọn luôn, đừng để tích tụ
      if (!coViec.has(tm.name)) {
        const bo = (ds2 || []).map((f) => tm.name + '/' + f.name);
        if (bo.length) { await sv.storage.from('anh').remove(bo); moCoi += bo.length }
        continue;
      }
      for (const f of ds2 || []) {
        const duong = tm.name + '/' + f.name;
        const co = Number(f.metadata?.size ?? 0);
        if (co > TEP_TOI_DA || tongByte + co > TONG_TOI_DA) { boQua.push(duong); continue }
        const { data: blob, error } = await sv.storage.from('anh').download(duong);
        if (error || !blob) { boQua.push(duong); continue }
        const u = new Uint8Array(await blob.arrayBuffer());
        tep.push({ ten: duong, loai: blob.type || 'application/octet-stream', b64: b64(u) });
        tongByte += u.length; soTep++;
      }
    }
    dump.tep_dinh_kem = tep;
    dump.tep_bo_qua = boQua;
    dump.tep_mo_coi_da_don = moCoi;

    const than = new Blob([JSON.stringify(dump)], { type: 'application/json' });
    const { error: e1 } = await sv.storage.from('sao-luu').upload(ten, than, { upsert: true, contentType: 'application/json' });
    if (e1) throw e1;

    // 3) Giữ 30 bản gần nhất
    const { data: cu } = await sv.storage.from('sao-luu').list('', { limit: 200, sortBy: { column: 'name', order: 'desc' } });
    const xoa = (cu||[]).map((x: {name:string}) => x.name).filter((n: string) => /\.json$/.test(n)).sort().reverse().slice(30);
    if (xoa.length) await sv.storage.from('sao-luu').remove(xoa);

    await sv.from('sao_luu_log').insert({ ten, so_bang: soBang, so_dong: soDong, so_tep: soTep,
      byte: than.size, bo_qua: boQua.slice(0,20).join(', ') || null, ok: true });
    return new Response(JSON.stringify({ ok: true, ten, so_bang: soBang, so_dong: soDong, so_tep: soTep, byte: than.size, bo_qua: boQua, tep_mo_coi_da_don: moCoi }),
      { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const loi = String((e as Error).message || e);
    await sv.from('sao_luu_log').insert({ ten, so_bang: soBang, so_dong: soDong, so_tep: soTep, ok: false, loi: loi.slice(0,400) });
    return new Response(JSON.stringify({ ok: false, loi }), { status: 500 });
  }
});
