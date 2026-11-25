// Đẩy bản sao lưu mới nhất ra Google Drive, để có bản nằm NGOÀI dự án Supabase.
// Chạy pg_cron mỗi tuần. Cần apps-script/SaoLuu.gs đã dán và triển khai phiên bản mới.
import { createClient } from 'npm:@supabase/supabase-js@2';

const b64 = (u: Uint8Array) => { let s=''; for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode(...u.subarray(i,i+0x8000)); return btoa(s) };

Deno.serve(async (req) => {
  const sv = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: bm } = await sv.from('bi_mat').select('k,v');
  const cfg: Record<string,string> = Object.fromEntries((bm||[]).map((x: {k:string;v:string}) => [x.k, x.v]));
  if (req.headers.get('x-push-key') !== cfg.push_key) return new Response('no', { status: 403 });

  try {
    if (!cfg.kh_script_url || !cfg.kh_token) throw new Error('Chưa cấu hình Apps Script (kh_script_url / kh_token)');

    // Bản sao lưu mới nhất trong bucket
    const { data: ds, error: e0 } = await sv.storage.from('sao-luu').list('', { limit: 200, sortBy: { column: 'name', order: 'desc' } });
    if (e0) throw e0;
    const ten = (ds||[]).map((x: {name:string}) => x.name).filter((n: string) => /\.json$/.test(n)).sort().reverse()[0];
    if (!ten) throw new Error('Chưa có bản sao lưu nào trong bucket');

    const { data: blob, error: e1 } = await sv.storage.from('sao-luu').download(ten);
    if (e1 || !blob) throw e1 || new Error('Không tải được bản sao lưu');
    const u = new Uint8Array(await blob.arrayBuffer());

    const res = await fetch(cfg.kh_script_url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, redirect: 'follow',
      body: JSON.stringify({ token: cfg.kh_token, action: 'sl_luu', ten, b64: b64(u) }),
    });
    const tx = await res.text();
    let r: {ok?: boolean; loi?: string; url?: string; con_lai?: number};
    try { r = JSON.parse(tx) } catch (_) { throw new Error('Apps Script trả lỗi HTTP ' + res.status + ' (chưa dán SaoLuu.gs?)') }
    if (!r.ok) throw new Error(r.loi || 'Apps Script không lưu được');

    await sv.from('sao_luu_log').insert({ ten: ten + ' → Drive', so_tep: 1, byte: u.length, ok: true,
      bo_qua: 'bản ngoài trên Drive, còn ' + (r.con_lai ?? '?') + ' bản' });
    return new Response(JSON.stringify({ ok: true, ten, byte: u.length, drive: r.url, con_lai: r.con_lai }),
      { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const loi = String((e as Error).message || e);
    await sv.from('sao_luu_log').insert({ ten: 'đẩy ra Drive', ok: false, loi: loi.slice(0,400) });
    try {
      const { data: ad } = await sv.from('nguoi_dung').select('id').eq('la_quan_tri', true).eq('hoat_dong', true);
      await fetch(Deno.env.get('SUPABASE_URL')! + '/functions/v1/gui-push', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-push-key': cfg.push_key },
        body: JSON.stringify({ nguoi: (ad||[]).map((x: {id:string}) => x.id), tieu: '⚠ Chưa đẩy được sao lưu ra Drive', noi: loi.slice(0,180), url: './', tag: 'sao-luu' }) });
    } catch (_) { /* bỏ qua */ }
    return new Response(JSON.stringify({ ok: false, loi }), { status: 500 });
  }
});
