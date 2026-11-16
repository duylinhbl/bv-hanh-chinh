// Đối chiếu báo cáo (file Word đính kèm việc) với hồ sơ trong thư mục Google Drive.
// Hồ sơ được đọc qua Apps Script, mỗi file chỉ lưu bản TÓM TẮT ngắn vào bảng dc_ho_so (không lưu file) nên DB không phình.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { unzipSync } from 'npm:fflate@0.8.2';

const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Content-Type': 'application/json' };
const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
const nghi = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

const layMaThuMuc = (s: string) => {
  s = String(s || '').trim();
  const m = s.match(/folders\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/) || (/^[A-Za-z0-9_-]{15,}$/.test(s) ? [s, s] : null);
  return m ? m[1] : '';
};

// Văn bản Word kèm đánh dấu chữ đỏ ⟦ĐỎ: …⟧ (chỗ người rà soát bôi đỏ cần xác minh/điền)
function wordCoDo(buf: Uint8Array): string {
  const z = unzipSync(buf, { filter: (f) => f.name === 'word/document.xml' });
  if (!z['word/document.xml']) throw new Error('Tệp Word không đúng định dạng');
  let xml = new TextDecoder().decode(z['word/document.xml']);
  xml = xml.replace(/<\/w:tc>/g, '<w:r><w:t xml:space="preserve"> | </w:t></w:r></w:tc>');
  const un = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const laDo = (rp: string) => {
    const m = rp.match(/<w:color [^>]*w:val="([0-9A-Fa-f]{6})"/);
    if (!m) return false;
    const r = parseInt(m[1].slice(0, 2), 16), g = parseInt(m[1].slice(2, 4), 16), b = parseInt(m[1].slice(4, 6), 16);
    return r >= 0xB0 && g <= 0x70 && b <= 0x70;
  };
  const dong: string[] = [];
  for (const p of xml.split('</w:p>')) {
    const seg: { t: string; d: boolean }[] = [];
    for (const r of p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) || []) {
      const rp = (r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
      let t = '';
      for (const x of r.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br[^>]*\/>/g)) t += x[1] !== undefined ? un(x[1]) : (x[0].startsWith('<w:tab') ? '\t' : '\n');
      if (!t) continue;
      const d = laDo(rp);
      if (seg.length && seg[seg.length - 1].d === d) seg[seg.length - 1].t += t; else seg.push({ t, d });
    }
    const s = seg.map((x) => (x.d && x.t.trim() ? '⟦ĐỎ: ' + x.t + '⟧' : x.t)).join('');
    if (s.trim()) dong.push(s);
  }
  return dong.join('\n').replace(/\n{3,}/g, '\n\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: H });
  const url = Deno.env.get('SUPABASE_URL')!;
  const uc = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
  const sv = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    const { data: u } = await uc.auth.getUser();
    if (!u?.user) return out({ loi: 'Chưa đăng nhập' }, 401);
    const { data: nd } = await sv.from('nguoi_dung').select('id,ho_ten,hoat_dong').eq('auth_id', u.user.id).maybeSingle();
    if (!nd || !nd.hoat_dong) return out({ loi: 'Tài khoản không được phép' }, 403);
    let b: any = {}; try { b = await req.json(); } catch (_) { /* rỗng */ }
    const { action, viec_id } = b;

    const { data: bm } = await sv.from('bi_mat').select('k,v').in('k', ['kh_script_url', 'kh_token', 'ai_model']);
    const cfg: Record<string, string> = Object.fromEntries((bm || []).map((x: any) => [x.k, x.v]));
    const goi = async (body: any, ms = 100000) => {
      if (!cfg.kh_script_url) return { ok: false, loi: 'Chưa cấu hình Apps Script' };
      try {
        const res = await fetch(cfg.kh_script_url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ token: cfg.kh_token, ...body }), redirect: 'follow', signal: AbortSignal.timeout(ms) });
        const t = await res.text();
        try { return JSON.parse(t); } catch (_) { return { ok: false, loi: 'Apps Script chưa cập nhật mã DoiChieu.gs hoặc trả lỗi (HTTP ' + res.status + ')' }; }
      } catch (e) { return { ok: false, loi: 'Không gọi được Apps Script: ' + String(e).slice(0, 100) }; }
    };

    if (action === 'who') {
      const j = await goi({ action: 'dc_who' }, 30000);
      return out(j.ok ? { ok: true, email: j.email } : { loi: j.loi || 'Không lấy được tài khoản' }, j.ok ? 200 : 502);
    }

    if (!viec_id) return out({ loi: 'Thiếu việc' }, 400);
    const { data: v } = await uc.from('viec').select('id,tieu_de,mo_ta,file_path,file_ten,thu_muc_dc').eq('id', viec_id).maybeSingle();
    if (!v) return out({ loi: 'Không có quyền với việc này' }, 403);
    const key = Deno.env.get('GEMINI_API_KEY');
    const model = cfg.ai_model || 'gemini-2.5-flash';
    const gem = async (parts: any[], json = false, maxOut = 4096) => {
      if (!key) throw new Error('Chưa cài khóa Gemini');
      const body: any = { contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, maxOutputTokens: maxOut, ...(json ? { responseMimeType: 'application/json' } : {}) } };
      let loi = '';
      for (let k = 0; k < 3; k++) {
        try {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
          const j: any = await r.json().catch(() => ({}));
          if (r.ok) { const t = (j?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim(); if (t) return t; loi = 'AI không trả lời'; }
          else { loi = String(j?.error?.message || r.status); if (r.status === 429) loi = 'Hết hạn mức Gemini, thử lại sau ít phút'; if (r.status < 500 && r.status !== 429) break; }
        } catch (e) { loi = String(e).slice(0, 80); }
        await nghi(2000 * (k + 1));
      }
      throw new Error(loi || 'Gemini lỗi');
    };

    const tenTep = async (fp: string) => {
      let ten: string | null = v.file_path === fp ? v.file_ten : null;
      if (!ten) { const { data: c } = await uc.from('cap_nhat_hien_trang').select('file_ten').eq('viec_id', viec_id).eq('file_path', fp).limit(1); ten = c?.[0]?.file_ten || null; }
      return ten;
    };

    // 0) AI gợi ý loại việc từ văn bản vừa thả vào
    if (action === 'goi_y_loai') {
      const fp = String(b.file_path || '');
      const ten = await tenTep(fp);
      if (!ten) return out({ loi: 'Tệp không thuộc việc này' }, 403);
      const { data: ds } = await sv.from('loai_viec').select('id,nhom,ten,goi_y').eq('hoat_dong', true).order('thu_tu');
      if (!ds?.length) return out({ loi: 'Chưa có danh mục loại việc' }, 400);
      const parts: any[] = [];
      const dl = await sv.storage.from('anh').download(fp);
      let nd = '';
      if (!dl.error && dl.data) {
        const buf = new Uint8Array(await dl.data.arrayBuffer());
        try {
          if (/\.docx$/i.test(ten)) nd = wordCoDo(buf).slice(0, 9000);
          else if (/\.pdf$/i.test(ten) && buf.length < 8e6) { let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192)); parts.push({ inline_data: { mime_type: 'application/pdf', data: btoa(s) } }); }
        } catch (_) { /* bỏ qua, dùng tiêu đề */ }
      }
      const dm = ds.map((x: any) => `${x.id} | ${x.nhom} | ${x.ten} | từ khóa: ${x.goi_y || ''}`).join('\n');
      const lenh = `Bạn giúp phòng Tổ chức Hành chính của bệnh viện xếp văn bản nhận được vào đúng LOẠI VIỆC để xử lý.
Việc: "${v.tieu_de}". ${v.mo_ta ? 'Mô tả: ' + String(v.mo_ta).slice(0, 500) + '.' : ''} Tên tệp: ${ten}.
DANH MỤC LOẠI VIỆC (id | nhóm | tên | từ khóa):
${dm}
Chọn 1 đến 3 loại việc phù hợp nhất với văn bản, xếp loại phù hợp nhất lên đầu. Chỉ dùng id có trong danh mục. Nếu không loại nào phù hợp trả mảng rỗng.
Trả JSON: {"goi_y":[{"id":số,"ly_do":"1 câu ngắn tiếng Việt nêu căn cứ trong văn bản"}]}`;
      parts.unshift({ text: lenh + (nd ? '\n\nNỘI DUNG VĂN BẢN:\n' + nd : '') });
      let kq: any;
      try { kq = JSON.parse((await gem(parts, true, 1024)).replace(/^```json\s*|```$/g, '')); } catch (e) { return out({ loi: 'AI chưa gợi ý được: ' + String((e as Error).message || e).slice(0, 100) }, 502); }
      const hop = new Map(ds.map((x: any) => [x.id, x]));
      const gy = (kq.goi_y || []).filter((g: any) => hop.has(Number(g.id))).slice(0, 3).map((g: any) => ({ id: Number(g.id), nhom: (hop.get(Number(g.id)) as any).nhom, ten: (hop.get(Number(g.id)) as any).ten, ly_do: String(g.ly_do || '').slice(0, 200) }));
      return out({ ok: true, goi_y: gy });
    }

    const fid = layMaThuMuc(v.thu_muc_dc || '');
    if (!fid) return out({ loi: 'Việc này chưa gắn thư mục hồ sơ đối chiếu' }, 400);

    // 1) Quét thư mục: cập nhật danh sách file
    if (action === 'quet') {
      const j = await goi({ action: 'dc_ds', folder_id: fid });
      if (!j.ok) return out({ loi: j.loi || 'Không đọc được thư mục', chua_chia_se: !!j.chua_chia_se }, 502);
      const files: any[] = j.files || [];
      const { data: cu } = await sv.from('dc_ho_so').select('file_id,sua_luc,doc_sua_luc').eq('folder_id', fid);
      const cm = new Map((cu || []).map((x: any) => [x.file_id, x]));
      const hien = new Set(files.map((f) => f.id));
      const bo = (cu || []).filter((x: any) => !hien.has(x.file_id)).map((x: any) => x.file_id);
      if (bo.length) await sv.from('dc_ho_so').delete().eq('folder_id', fid).in('file_id', bo);
      const rows = files.map((f) => ({ folder_id: fid, file_id: f.id, ten: String(f.ten).slice(0, 200), duong_dan: String(f.duong_dan || '').slice(0, 300), mime: f.mime, kich_thuoc: f.size, sua_luc: f.sua, cap_nhat: new Date().toISOString() }));
      for (let i = 0; i < rows.length; i += 100) await sv.from('dc_ho_so').upsert(rows.slice(i, i + 100), { onConflict: 'folder_id,file_id' });
      const can = files.filter((f) => { const c: any = cm.get(f.id); return !c || !c.doc_sua_luc || new Date(c.doc_sua_luc) < new Date(f.sua); }).length;
      return out({ ok: true, ten_thu_muc: j.ten, tong: files.length, can_doc: can, cat: !!j.cat });
    }

    // 2) Đọc dần vài file chưa có tóm tắt
    if (action === 'doc') {
      const n = Math.min(Math.max(Number(b.n) || 3, 1), 4);
      const { data: ds } = await sv.from('dc_ho_so').select('file_id,ten,duong_dan,mime,kich_thuoc,sua_luc,doc_sua_luc').eq('folder_id', fid).order('kich_thuoc', { ascending: true });
      const cho = (ds || []).filter((x: any) => !x.doc_sua_luc || new Date(x.doc_sua_luc) < new Date(x.sua_luc));
      let xong = 0;
      for (const f of cho.slice(0, n)) {
        const upd: any = { doc_sua_luc: f.sua_luc, cap_nhat: new Date().toISOString(), tom_tat: null, loi: null };
        try {
          const l = await goi({ action: 'dc_lay', file_id: f.file_id }, 100000);
          if (!l.ok) throw new Error(l.loi || 'Không đọc được file');
          if (l.kieu === 'bo_qua') upd.loi = l.ly_do;
          else {
            const lenh = 'Đọc hồ sơ này của bệnh viện và tóm tắt để đối chiếu với báo cáo. Ghi ngắn gọn, đủ: loại giấy tờ; số hiệu; ngày cấp/ký; cơ quan cấp; hiệu lực đến; đối tượng (tên người, thiết bị, số seri, phòng); kết luận/kết quả; số liệu quan trọng (liều, suất liều, mức đo). Tối đa 900 ký tự, tiếng Việt, văn bản thuần. Chỗ không đọc rõ ghi [không rõ]. Tuyệt đối không bịa. Tên file: ' + f.ten;
            const parts: any[] = [{ text: lenh }];
            if (l.kieu === 'text') parts.push({ text: '\nNỘI DUNG:\n' + String(l.text || '').slice(0, 30000) });
            else parts.push({ inline_data: { mime_type: l.mime, data: l.b64 } });
            upd.tom_tat = (await gem(parts, false, 700)).slice(0, 1500);
          }
        } catch (e) { upd.loi = String((e as Error).message || e).slice(0, 200); upd.doc_sua_luc = null; }
        await sv.from('dc_ho_so').update(upd).eq('folder_id', fid).eq('file_id', f.file_id);
        if (!upd.loi || upd.doc_sua_luc) xong++;
      }
      return out({ ok: true, da_doc: xong, con_lai: Math.max(cho.length - n, 0) });
    }

    // 3) Đối chiếu
    if (action === 'doi_chieu') {
      const fp = String(b.file_path || '');
      let ten: string | null = v.file_path === fp ? v.file_ten : null;
      if (!ten) { const { data: c } = await uc.from('cap_nhat_hien_trang').select('file_ten').eq('viec_id', viec_id).eq('file_path', fp).limit(1); ten = c?.[0]?.file_ten || null; }
      if (!ten) return out({ loi: 'Tệp không thuộc việc này' }, 403);
      if (!/\.docx$/i.test(ten)) return out({ loi: 'Hiện chỉ đối chiếu được báo cáo dạng Word (.docx)' }, 422);
      const dl = await sv.storage.from('anh').download(fp);
      if (dl.error || !dl.data) return out({ loi: 'Không tải được báo cáo' }, 500);
      let bao = wordCoDo(new Uint8Array(await dl.data.arrayBuffer()));
      let cat = false; if (bao.length > 60000) { bao = bao.slice(0, 60000); cat = true; }
      const { data: hs } = await sv.from('dc_ho_so').select('ten,duong_dan,sua_luc,tom_tat,loi').eq('folder_id', fid).order('duong_dan').order('ten');
      const co = (hs || []).filter((x: any) => x.tom_tat), khong = (hs || []).filter((x: any) => !x.tom_tat);
      if (!co.length) return out({ loi: 'Chưa có hồ sơ nào được đọc. Bấm quét và đọc hồ sơ trước.' }, 400);
      const homNay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      const cc = co.map((x: any, i: number) => `[H${i + 1}] ${x.duong_dan ? x.duong_dan + '/' : ''}${x.ten}\n${x.tom_tat}`).join('\n\n');
      const lenh = `Bạn là chuyên viên rà soát hồ sơ an toàn bức xạ của Bệnh viện Đa khoa Cao su Dầu Tiếng. Hôm nay là ${homNay}.
Nhiệm vụ: đối chiếu BÁO CÁO với HỒ SƠ CĂN CỨ (bản tóm tắt từng file trong thư mục).
Quy tắc:
- Lấy từng dữ kiện cụ thể trong báo cáo (số giấy phép/chứng nhận/biên bản, ngày cấp, hiệu lực, tên người, số seri thiết bị, kết quả đo, kết quả khám) rồi dò trong hồ sơ. Ưu tiên các đoạn đánh dấu ⟦ĐỎ: …⟧ và các chỗ còn để trống dạng [ … ] hoặc [ghi nếu có].
- ket_qua: "khop" (hồ sơ xác nhận đúng), "lech" (hồ sơ khác báo cáo), "thieu_can_cu" (không có hồ sơ nào nói về dữ kiện này), "can_dien" (báo cáo để trống/chờ điền nhưng hồ sơ có dữ liệu để điền), "het_han" (giấy tờ đã hết hiệu lực so với hôm nay hoặc kỳ báo cáo).
- Chỉ dựa vào hồ sơ đã cho. Không có thì ghi thieu_can_cu. Tuyệt đối không bịa số hay ngày. Trích đúng số hiệu/ngày từ hồ sơ.
- can_cu: tên file [Hn] và nội dung hồ sơ ghi gì. de_xuat: nên sửa/điền gì (nếu cần), ngắn.
- Tối đa 40 mục, đưa mục lech/het_han/can_dien/thieu_can_cu và các mục đánh dấu đỏ lên trước. Mục khop chỉ giữ những mục quan trọng.
Trả JSON: {"tong_quan": "2-3 câu", "muc": [{"muc": "tên dữ kiện", "bao_cao_ghi": "...", "ket_qua": "...", "can_cu": "...", "de_xuat": "...", "do": true/false}]}`;
      let txt: string;
      try { txt = await gem([{ text: lenh + `\n\nBÁO CÁO "${ten}"${cat ? ' (đã cắt bớt)' : ''}:\n${bao}\n\nHỒ SƠ CĂN CỨ:\n${cc}` }], true, 8192); } catch (e) { return out({ loi: String((e as Error).message || e) }, 502); }
      let kq: any; try { kq = JSON.parse(txt.replace(/^```json\s*|```$/g, '')); } catch (_) { return out({ loi: 'AI trả kết quả không đúng dạng, bấm đối chiếu lại' }, 502); }
      return out({ ok: true, ...kq, so_ho_so: co.length, ho_so_khong_doc: khong.map((x: any) => ({ ten: x.ten, ly_do: x.loi || 'chưa đọc' })), cat });
    }
    return out({ loi: 'Thao tác không hợp lệ' }, 400);
  } catch (e) {
    return out({ loi: 'Lỗi hệ thống: ' + String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
