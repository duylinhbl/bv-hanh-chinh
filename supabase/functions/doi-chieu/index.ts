// Trợ lý việc: AI gợi ý loại việc, duyệt Drive (chỉ đọc), soạn báo cáo từ mẫu kỳ trước + hồ sơ căn cứ, đối chiếu báo cáo.
// Hồ sơ đọc qua Apps Script; mỗi file chỉ lưu bản TÓM TẮT ngắn vào bảng dc_ho_so (không lưu file) nên DB không phình.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { chuCoDo, doanVan, dongDocx, moDocx, thayDoan } from './docx.ts';

const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Content-Type': 'application/json' };
const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
const nghi = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

const layMaThuMuc = (s: string) => {
  s = String(s || '').trim();
  const m = s.match(/folders\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/) || (/^[A-Za-z0-9_-]{15,}$/.test(s) ? [s, s] : null);
  return m ? m[1] : '';
};

const wordCoDo = (buf: Uint8Array) => chuCoDo(moDocx(buf).xml);
const b64Bytes = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const bytesB64 = (buf: Uint8Array) => { let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192)); return btoa(s); };
const boQuaTen = (t: string) => /^\s*bỏ[\s._-]/i.test(t) || /(^|[\s._-])cũ([\s._-]|$)/i.test(t);
const JS = (t: string) => JSON.parse(t.replace(/^```json\s*|```$/g, ''));

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

    const { data: bm } = await sv.from('bi_mat').select('k,v').in('k', ['kh_script_url', 'kh_token', 'ai_model', 'ai_model_manh']);
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
    const { data: v } = await uc.from('viec').select('id,tieu_de,mo_ta,file_path,file_ten,thu_muc_dc,loai_viec_id,mau_file_id').eq('id', viec_id).maybeSingle();
    if (!v) return out({ loi: 'Không có quyền với việc này' }, 403);
    const key = Deno.env.get('GEMINI_API_KEY');
    const model = cfg.ai_model || 'gemini-2.5-flash';
    const gem1 = async (model: string, parts: any[], json: boolean, maxOut: number, ms: number, lan: number) => {
      if (!key) throw new Error('Chưa cài khóa Gemini');
      const body: any = { contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, maxOutputTokens: maxOut, ...(json ? { responseMimeType: 'application/json' } : {}) } };
      let loi = '';
      for (let k = 0; k < lan; k++) {
        try {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
          const j: any = await r.json().catch(() => ({}));
          if (r.ok) { const t = (j?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim(); if (t) return t; loi = 'AI không trả lời'; }
          else { loi = String(j?.error?.message || r.status); if (r.status === 429) loi = 'Hết hạn mức Gemini, thử lại sau ít phút'; if (r.status < 500 && r.status !== 429) break; }
        } catch (e) { loi = String(e).slice(0, 80); }
        if (k < lan - 1) await nghi(2000 * (k + 1));
      }
      throw new Error(loi || 'Gemini lỗi');
    };
    const gem = (parts: any[], json = false, maxOut = 4096) => gem1(model, parts, json, maxOut, 60000, 3);
    // Việc khó (soạn, đối chiếu): thử model mạnh trước, không được thì dùng model thường
    const manh = cfg.ai_model_manh || 'gemini-flash-latest';
    const gemManh = async (parts: any[], maxOut: number) => {
      const t0 = Date.now();
      if (manh !== model) { try { return await gem1(manh, parts, true, maxOut, 85000, 1); } catch (_) { /* dùng model thường */ } }
      return await gem1(model, parts, true, maxOut, Math.max(20000, 125000 - (Date.now() - t0)), 1);
    };

    const tenTep = async (fp: string) => {
      if (!fp) return null;
      let ten: string | null = v.file_path === fp ? v.file_ten : null;
      if (!ten) { const { data: c } = await uc.from('cap_nhat_hien_trang').select('file_ten').eq('viec_id', viec_id).eq('file_path', fp).limit(1); ten = c?.[0]?.file_ten || null; }
      if (!ten) { const { data: c } = await uc.from('cap_nhat_hien_trang').select('id').eq('viec_id', viec_id).eq('anh_path', fp).limit(1); if (c?.length) ten = 'anh.jpg'; }
      return ten;
    };
    // Văn bản đề nghị (tệp của việc) -> parts cho Gemini
    const docVanBan = async (fp: string, ten: string, gioiHan = 12000): Promise<{ text: string; parts: any[] }> => {
      const dl = await sv.storage.from('anh').download(fp);
      if (dl.error || !dl.data) return { text: '', parts: [] };
      const buf = new Uint8Array(await dl.data.arrayBuffer());
      try {
        if (/\.docx$/i.test(ten)) return { text: wordCoDo(buf).slice(0, gioiHan), parts: [] };
        if (/\.pdf$/i.test(ten) && buf.length < 8e6) return { text: '', parts: [{ inline_data: { mime_type: 'application/pdf', data: bytesB64(buf) } }] };
        if (/\.(jpe?g|png|webp)$/i.test(ten) && buf.length < 8e6) return { text: '', parts: [{ inline_data: { mime_type: /\.png$/i.test(ten) ? 'image/png' : /\.webp$/i.test(ten) ? 'image/webp' : 'image/jpeg', data: bytesB64(buf) } }] };
      } catch (_) { /* dùng tiêu đề */ }
      return { text: '', parts: [] };
    };
    const { data: dsLoai } = await sv.from('loai_viec').select('id,nhom,ten,goi_y,thu_muc_goc,hoat_dong').order('thu_tu');
    const goc = [...new Set((dsLoai || []).map((x: any) => layMaThuMuc(x.thu_muc_goc || '')).filter(Boolean))];

    // 0) AI gợi ý loại việc từ văn bản (tệp của việc) hoặc từ nội dung gõ tay
    if (action === 'goi_y_loai') {
      const fp = String(b.file_path || '');
      const ten = await tenTep(fp);
      if (fp && !ten) return out({ loi: 'Tệp không thuộc việc này' }, 403);
      const ds = (dsLoai || []).filter((x: any) => x.hoat_dong);
      if (!ds.length) return out({ loi: 'Chưa có danh mục loại việc' }, 400);
      const vb = ten ? await docVanBan(fp, ten, 9000) : { text: '', parts: [] };
      const go = String(b.van_ban || '').slice(0, 3000);
      const dm = ds.map((x: any) => `${x.id} | ${x.nhom} | ${x.ten} | từ khóa: ${x.goi_y || ''}`).join('\n');
      const lenh = `Bạn giúp phòng Tổ chức Hành chính của bệnh viện xếp việc vào đúng LOẠI VIỆC để xử lý.
Việc: "${v.tieu_de}". ${v.mo_ta ? 'Mô tả: ' + String(v.mo_ta).slice(0, 500) + '.' : ''}${ten ? ' Tên tệp: ' + ten + '.' : ''}${go ? '\nNgười làm ghi: ' + go : ''}
DANH MỤC LOẠI VIỆC (id | nhóm | tên | từ khóa):
${dm}
Chọn 1 đến 3 loại việc phù hợp nhất, xếp loại phù hợp nhất lên đầu. Chỉ dùng id có trong danh mục. Không loại nào phù hợp thì trả mảng rỗng.
Trả JSON: {"goi_y":[{"id":số,"ly_do":"1 câu ngắn tiếng Việt nêu căn cứ"}]}`;
      let kq: any;
      try { kq = JS(await gem([{ text: lenh + (vb.text ? '\n\nNỘI DUNG VĂN BẢN:\n' + vb.text : '') }, ...vb.parts], true, 1024)); } catch (e) { return out({ loi: 'AI chưa gợi ý được: ' + String((e as Error).message || e).slice(0, 100) }, 502); }
      const hop = new Map(ds.map((x: any) => [x.id, x]));
      const gy = (kq.goi_y || []).filter((g: any) => hop.has(Number(g.id))).slice(0, 3).map((g: any) => ({ id: Number(g.id), ly_do: String(g.ly_do || '').slice(0, 200) }));
      return out({ ok: true, goi_y: gy });
    }

    // Duyệt Drive 1 tầng (chỉ đọc, chỉ trong các thư mục của danh mục loại việc)
    if (action === 'duyet') {
      const lv = (dsLoai || []).find((x: any) => x.id === v.loai_viec_id);
      const id = layMaThuMuc(String(b.folder_id || '')) || layMaThuMuc(lv?.thu_muc_goc || '');
      if (!id) return out({ loi: 'Loại việc này chưa gắn thư mục Drive. Nhờ trưởng phòng gắn trong Danh mục loại việc.' }, 400);
      const j = await goi({ action: 'dc_con', folder_id: id, goc }, 60000);
      if (!j.ok) return out({ loi: j.loi || 'Không đọc được thư mục', chua_chia_se: !!j.chua_chia_se }, 502);
      return out({ ok: true, id: j.id, ten: j.ten, thu_muc: j.thu_muc || [], files: j.files || [], la_goc: goc.includes(j.id) });
    }

    const fid = layMaThuMuc(v.thu_muc_dc || '');
    const canFid = () => fid ? null : out({ loi: 'Chưa chọn thư mục hồ sơ căn cứ' }, 400);

    // 1) Quét thư mục căn cứ: cập nhật danh sách file
    if (action === 'quet') {
      const e0 = canFid(); if (e0) return e0;
      const j = await goi({ action: 'dc_ds', folder_id: fid, goc });
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

    // 2) Đọc dần vài file chưa có tóm tắt. File lỗi được đánh dấu để KHÔNG chặn các file sau.
    if (action === 'doc' || action === 'doc_lai') {
      const e0 = canFid(); if (e0) return e0;
      if (action === 'doc_lai') { await sv.from('dc_ho_so').update({ doc_sua_luc: null, loi: null }).eq('folder_id', fid).is('tom_tat', null); return out({ ok: true }); }
      const n = Math.min(Math.max(Number(b.n) || 2, 1), 4), t0 = Date.now();
      const { data: ds } = await sv.from('dc_ho_so').select('file_id,ten,duong_dan,mime,kich_thuoc,sua_luc,doc_sua_luc').eq('folder_id', fid).order('kich_thuoc', { ascending: true });
      const cho = (ds || []).filter((x: any) => !x.doc_sua_luc || new Date(x.doc_sua_luc) < new Date(x.sua_luc));
      let lam = 0, loiN = 0;
      for (const f of cho.slice(0, n)) {
        if (lam && Date.now() - t0 > 70000) break;
        lam++;
        const upd: any = { doc_sua_luc: f.sua_luc, cap_nhat: new Date().toISOString(), tom_tat: null, loi: null };
        try {
          if (boQuaTen(f.ten)) upd.loi = 'Bỏ qua vì tên file ghi "bỏ"/"cũ"';
          else {
            const l = await goi({ action: 'dc_lay', file_id: f.file_id, goc }, 90000);
            if (!l.ok) throw new Error(l.loi || 'Không đọc được file');
            if (l.kieu === 'bo_qua') upd.loi = l.ly_do;
            else {
              const lenh = 'Đọc hồ sơ này của bệnh viện và tóm tắt để làm căn cứ soạn/đối chiếu báo cáo. Ghi ngắn gọn, đủ: loại giấy tờ; số hiệu; ngày cấp/ký; cơ quan cấp; hiệu lực đến; đối tượng (tên người, thiết bị, số seri, phòng); kết luận/kết quả; số liệu quan trọng (liều, suất liều, mức đo, số lượng). Tối đa 900 ký tự, tiếng Việt, văn bản thuần. Chỗ không đọc rõ ghi [không rõ]. Tuyệt đối không bịa. Tên file: ' + f.ten;
              const parts: any[] = [{ text: lenh }];
              if (l.kieu === 'text') parts.push({ text: '\nNỘI DUNG:\n' + String(l.text || '').slice(0, 30000) });
              else if (l.kieu === 'docx') parts.push({ text: '\nNỘI DUNG:\n' + wordCoDo(b64Bytes(l.b64)).slice(0, 30000) });
              else parts.push({ inline_data: { mime_type: l.mime, data: l.b64 } });
              upd.tom_tat = (await gem1(model, parts, false, 2048, 60000, 2)).slice(0, 1500);
            }
          }
        } catch (e) { upd.loi = 'Lỗi đọc: ' + String((e as Error).message || e).slice(0, 180); loiN++; }
        await sv.from('dc_ho_so').update(upd).eq('folder_id', fid).eq('file_id', f.file_id);
      }
      return out({ ok: true, da_doc: lam, so_loi: loiN, con_lai: Math.max(cho.length - lam, 0) });
    }

    // Danh sách hồ sơ căn cứ đã quét (để hiện cho người dùng)
    if (action === 'ds') {
      const e0 = canFid(); if (e0) return e0;
      const { data: hs } = await sv.from('dc_ho_so').select('file_id,ten,duong_dan,tom_tat,loi,doc_sua_luc').eq('folder_id', fid).order('duong_dan').order('ten');
      return out({ ok: true, files: (hs || []).map((x: any) => ({ id: x.file_id, ten: x.ten, duong_dan: x.duong_dan, tt: x.tom_tat ? 'ok' : x.loi ? 'loi' : 'cho', ghi: x.tom_tat ? String(x.tom_tat).slice(0, 220) : x.loi })) });
    }

    const layCanCu = async () => {
      if (!fid) return { co: [] as any[], khong: [] as any[] };
      const { data: hs } = await sv.from('dc_ho_so').select('ten,duong_dan,sua_luc,tom_tat,loi').eq('folder_id', fid).order('duong_dan').order('ten');
      return { co: (hs || []).filter((x: any) => x.tom_tat), khong: (hs || []).filter((x: any) => !x.tom_tat) };
    };
    const homNay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ghepCanCu = (co: any[]) => co.map((x: any, i: number) => `[H${i + 1}] ${x.duong_dan ? x.duong_dan + '/' : ''}${x.ten}\n${x.tom_tat}`).join('\n\n');

    // 3) AI soạn báo cáo: lấy MẪU (báo cáo năm trước) trong Drive, thay căn cứ + số liệu theo hồ sơ, giữ nguyên định dạng
    if (action === 'soan_bc') {
      const mauId = layMaThuMuc(String(b.mau_file_id || v.mau_file_id || ''));
      if (!mauId) return out({ loi: 'Chưa chọn file mẫu' }, 400);
      const m = await goi({ action: 'dc_tho', file_id: mauId, goc }, 90000);
      if (!m.ok) return out({ loi: m.loi || 'Không lấy được file mẫu' }, 502);
      const { files, xml } = moDocx(b64Bytes(m.b64));
      const dv = doanVan(xml);
      let mau = dv.map((d) => `[${d.p}] ${d.hien}`).join('\n'), cat = false;
      if (mau.length > 70000) { mau = mau.slice(0, 70000); cat = true; }
      const { co, khong } = await layCanCu();
      const fp = String(b.file_path || ''), tenVb = await tenTep(fp);
      const vb = tenVb ? await docVanBan(fp, tenVb) : { text: '', parts: [] };
      const yc = String(b.yeu_cau || '').slice(0, 3000), sua = String(b.sua || '').slice(0, 3000);
      const cu = Array.isArray(b.thay_cu) ? b.thay_cu.slice(0, 150).map((t: any) => ({ p: t.p, cu: t.cu, moi: t.moi })) : [];
      const lenh = `Bạn là chuyên viên phòng Tổ chức Hành chính, Bệnh viện Đa khoa Cao su Dầu Tiếng. Hôm nay là ${homNay}.
Việc được giao: "${v.tieu_de}". ${v.mo_ta ? 'Mô tả: ' + String(v.mo_ta).slice(0, 600) : ''}
Nhiệm vụ: lập văn bản KỲ MỚI bằng cách kế thừa MẪU (văn bản kỳ trước, mỗi đoạn có số [p]). Giữ nguyên bố cục và văn phong của mẫu, CHỈ thay những chỗ cần đổi:
- kỳ/năm báo cáo, ngày tháng lập văn bản;
- căn cứ: số hiệu, ngày cấp, hiệu lực của giấy phép, chứng chỉ, biên bản kiểm định/kiểm xạ, hợp đồng;
- số liệu thực: nhân sự, thiết bị, kết quả đo, kết quả khám…;
- các chỗ mẫu để trống dạng [ … ] hoặc đánh dấu ⟦ĐỎ: …⟧ (chỗ chờ điền/xác minh).
Quy tắc bắt buộc:
- Mọi giá trị mới phải lấy từ HỒ SƠ CĂN CỨ, VĂN BẢN ĐỀ NGHỊ hoặc yêu cầu của người làm. Tuyệt đối không bịa số, ngày, tên.
- Dữ kiện mà hồ sơ xác nhận vẫn đúng như mẫu thì KHÔNG đưa vào danh sách thay.
- Dữ kiện cần đổi theo kỳ mới nhưng không có căn cứ: không thay, ghi vào "thieu" (nêu rõ thiếu hồ sơ gì, ở đoạn nào).
- "cu" phải là chuỗi chép NGUYÊN VĂN từ đúng đoạn [p] của mẫu, càng ngắn càng tốt (chỉ phần cần đổi, đủ để không trùng chỗ khác trong đoạn), không kèm ký hiệu ⟦ĐỎ: ⟧. "moi" là chữ thay vào.
- "chac": true khi căn cứ rõ ràng; false khi suy ra hoặc còn nghi ngờ (người làm sẽ kiểm).
- "can_cu": tên file [Hn] hoặc "văn bản đề nghị"/"yêu cầu người làm" và trích ngắn nội dung làm căn cứ.
Trả JSON: {"ten_file":"tên file kỳ mới (không đuôi)","tom_tat":"2-3 câu: đã cập nhật gì, còn thiếu gì","thay":[{"p":số,"cu":"...","moi":"...","can_cu":"...","chac":true}],"thieu":["..."]}`;
      const than = `\n\nMẪU "${m.ten}"${cat ? ' (đã cắt bớt phần cuối)' : ''}:\n${mau}\n\nHỒ SƠ CĂN CỨ${co.length ? '' : ' (chưa có hồ sơ nào được đọc)'}:\n${ghepCanCu(co)}`
        + (vb.text ? `\n\nVĂN BẢN ĐỀ NGHỊ "${tenVb}":\n${vb.text}` : '') + (yc ? `\n\nYÊU CẦU CỦA NGƯỜI LÀM:\n${yc}` : '')
        + (sua ? `\n\nBẢN SOẠN TRƯỚC đã thay các chỗ sau:\n${JSON.stringify(cu)}\nNGƯỜI LÀM YÊU CẦU CHỈNH: ${sua}\nHãy trả lại TOÀN BỘ danh sách thay (đã điều chỉnh theo yêu cầu chỉnh), vẫn tính trên MẪU gốc.` : '');
      let kq: any;
      try { kq = JS(await gemManh([{ text: lenh + than }, ...vb.parts], 16000)); } catch (e) { return out({ loi: 'AI chưa soạn được: ' + String((e as Error).message || e).slice(0, 150) }, 502); }
      const thay = (Array.isArray(kq.thay) ? kq.thay : []).slice(0, 200).map((t: any) => ({ p: Number(t.p), cu: String(t.cu || ''), moi: String(t.moi ?? ''), can_cu: String(t.can_cu || '').slice(0, 300), chac: t.chac !== false }));
      const r = thayDoan(xml, thay);
      const tenRa = (String(kq.ten_file || '').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 120) || m.ten.replace(/\.docx$/i, '') + ' (soạn mới)') + '.docx';
      const path = `${viec_id}/nhap-bc-${nd.id}.docx`;
      const up = await sv.storage.from('anh').upload(path, dongDocx(files, r.xml), { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: true });
      if (up.error) return out({ loi: 'Không lưu được bản nháp: ' + up.error.message }, 500);
      const su = await sv.storage.from('anh').createSignedUrl(path, 3600);
      await uc.from('viec').update({ mau_file_id: mauId, mau_ten: m.ten }).eq('id', viec_id);
      if (v.loai_viec_id) await sv.from('loai_viec').update({ mau_file_id: mauId, mau_ten: m.ten, can_cu: fid || null }).eq('id', v.loai_viec_id);
      const chu = new Map(dv.map((d) => [d.p, d.chu]));
      return out({ ok: true, url: su.data?.signedUrl, ten: tenRa, mau: m.ten, tom_tat: String(kq.tom_tat || ''), thay: thay.map((t: any, i: number) => ({ ...t, ok: r.ok[i], doan: String(chu.get(t.p) || '').slice(0, 160) })), thieu: (Array.isArray(kq.thieu) ? kq.thieu : []).slice(0, 40).map((x: any) => String(x).slice(0, 300)), so_ho_so: co.length, khong_doc: khong.length, cat });
    }

    // 4) Đối chiếu một báo cáo có sẵn với hồ sơ căn cứ
    if (action === 'doi_chieu') {
      const e0 = canFid(); if (e0) return e0;
      const fp = String(b.file_path || '');
      const ten = await tenTep(fp);
      if (!ten) return out({ loi: 'Tệp không thuộc việc này' }, 403);
      if (!/\.docx$/i.test(ten)) return out({ loi: 'Hiện chỉ đối chiếu được báo cáo dạng Word (.docx)' }, 422);
      const dl = await sv.storage.from('anh').download(fp);
      if (dl.error || !dl.data) return out({ loi: 'Không tải được báo cáo' }, 500);
      let bao = wordCoDo(new Uint8Array(await dl.data.arrayBuffer()));
      let cat = false; if (bao.length > 60000) { bao = bao.slice(0, 60000); cat = true; }
      const { co, khong } = await layCanCu();
      if (!co.length) return out({ loi: 'Chưa có hồ sơ nào được đọc. Bấm quét và đọc hồ sơ trước.' }, 400);
      const lenh = `Bạn là chuyên viên rà soát hồ sơ của Bệnh viện Đa khoa Cao su Dầu Tiếng. Hôm nay là ${homNay}.
Nhiệm vụ: đối chiếu BÁO CÁO với HỒ SƠ CĂN CỨ (bản tóm tắt từng file trong thư mục).
Quy tắc:
- Lấy từng dữ kiện cụ thể trong báo cáo (số giấy phép/chứng nhận/biên bản, ngày cấp, hiệu lực, tên người, số seri thiết bị, kết quả đo, kết quả khám) rồi dò trong hồ sơ. Ưu tiên các đoạn đánh dấu ⟦ĐỎ: …⟧ và các chỗ còn để trống dạng [ … ] hoặc [ghi nếu có].
- ket_qua: "khop" (hồ sơ xác nhận đúng), "lech" (hồ sơ khác báo cáo), "thieu_can_cu" (không có hồ sơ nào nói về dữ kiện này), "can_dien" (báo cáo để trống/chờ điền nhưng hồ sơ có dữ liệu để điền), "het_han" (giấy tờ đã hết hiệu lực so với hôm nay hoặc kỳ báo cáo).
- Chỉ dựa vào hồ sơ đã cho. Không có thì ghi thieu_can_cu. Tuyệt đối không bịa số hay ngày. Trích đúng số hiệu/ngày từ hồ sơ.
- can_cu: tên file [Hn] và nội dung hồ sơ ghi gì. de_xuat: nên sửa/điền gì (nếu cần), ngắn.
- Tối đa 40 mục, đưa mục lech/het_han/can_dien/thieu_can_cu và các mục đánh dấu đỏ lên trước. Mục khop chỉ giữ những mục quan trọng.
Trả JSON: {"tong_quan": "2-3 câu", "muc": [{"muc": "tên dữ kiện", "bao_cao_ghi": "...", "ket_qua": "...", "can_cu": "...", "de_xuat": "...", "do": true/false}]}`;
      let kq: any;
      try { kq = JS(await gemManh([{ text: lenh + `\n\nBÁO CÁO "${ten}"${cat ? ' (đã cắt bớt)' : ''}:\n${bao}\n\nHỒ SƠ CĂN CỨ:\n${ghepCanCu(co)}` }], 8192)); } catch (e) { return out({ loi: 'AI chưa đối chiếu được, bấm chạy lại: ' + String((e as Error).message || e).slice(0, 120) }, 502); }
      return out({ ok: true, ...kq, so_ho_so: co.length, ho_so_khong_doc: khong.map((x: any) => ({ ten: x.ten, ly_do: x.loi || 'chưa đọc' })), cat });
    }
    return out({ loi: 'Thao tác không hợp lệ' }, 400);
  } catch (e) {
    return out({ loi: 'Lỗi hệ thống: ' + String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
