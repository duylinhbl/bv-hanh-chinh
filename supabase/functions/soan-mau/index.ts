// Soạn văn bản theo mẫu của bệnh viện (Mức 2): Gemini viết nội dung, ghép vào khung Word gốc (giữ quốc hiệu, bảng, chữ ký).
// Khung mẫu (docx + json) nằm trong Drive thư mục "_mau", lấy qua Apps Script (action vb_mau_lay). Lưu vào Drive: action luu_van_ban.
// Cấu hình bi_mat: kh_script_url, kh_token, ai_model. Khóa: secret GEMINI_API_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { unzipSync, zipSync } from 'npm:fflate@0.8.2';

const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Content-Type': 'application/json' };
const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nghi = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const sach = (s: string, n = 80) => s.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

const HE_THONG = `Bạn là chuyên viên soạn thảo văn bản hành chính của Phòng Tổ chức Hành chính, Bệnh viện Đa khoa Cao su Dầu Tiếng. Soạn NỘI DUNG chính của một văn bản theo thể thức Nghị định 30/2020/NĐ-CP, văn phong hành chính chuẩn, ngắn gọn, đúng mẫu tham khảo của bệnh viện.
Quy tắc:
- Chỉ soạn phần THÂN văn bản. KHÔNG viết quốc hiệu, tên cơ quan, số/ký hiệu, ngày tháng, tiêu đề, dòng "Về việc", chữ ký, "Nơi nhận" (khung mẫu đã có sẵn).
- Tờ trình: bắt đầu bằng dòng "Kính gửi:" (các nơi nhận mỗi nơi một dòng bắt đầu bằng "- "), rồi các dòng "Căn cứ ...", nội dung trình, kết bằng "Trân trọng kính trình./." hoặc câu kết tương đương của mẫu.
- Quyết định (đúng mẫu BV): các dòng "Căn cứ ...;" (căn cứ Quyết định 73/QĐ-HĐTV-CSDT ngày 05/5/2017 đã có trong mẫu; thêm căn cứ liên quan trực tiếp nếu người soạn nêu), rồi "Xét đề nghị tại Tờ trình số [ ]/TTr-BVĐK-TCHC ngày [ ] của Phòng Tổ chức Hành chánh,", rồi "QUYẾT ĐỊNH:". Dùng cách viết "Hành chánh" như văn bản của BV. Điều cuối kết bằng "./." Bắt đầu bằng các dòng "Căn cứ ...", một dòng "QUYẾT ĐỊNH:", rồi "Điều 1: ...", "Điều 2: ..." (có dấu hai chấm sau số điều) ... Điều cuối là trách nhiệm thi hành / hiệu lực.
- Mỗi đoạn một dòng riêng, các đoạn cách nhau bằng ký tự xuống dòng (\\n): mỗi \"Căn cứ ...\", \"QUYẾT ĐỊNH:\", mỗi \"Điều N.\" là một dòng riêng; không viết cả văn bản thành một khối. Mục con dùng dấu "- " đầu dòng. Bảng viết mỗi hàng một dòng dạng "cột 1 | cột 2 | cột 3", hàng đầu là tiêu đề cột.
- Văn bản thuần, không markdown (không **, #). Số tiền ghi cả số và bằng chữ.
- Số liệu, tên người, số văn bản căn cứ lấy đúng từ yêu cầu và tệp đính kèm. Điều chưa biết thì để [ ] — tuyệt đối không bịa số, tên, ngày.
- Chỉ dùng căn cứ pháp lý có trong mẫu tham khảo hoặc người dùng cung cấp; không tự thêm điều luật.
- BẢNG: mỗi hàng một dòng riêng, tối đa 6 cột, ô ngắn gọn. Tuyệt đối không dán nguyên dữ liệu Excel vào một dòng. Dữ liệu dài (trên 15 dòng) thì chỉ nêu tổng hợp/nhóm chính trong văn bản và ghi "chi tiết theo Phụ lục kèm theo".
- Nội dung chính (Điều 1 / phần đề nghị) phải nói ĐÚNG đối tượng của việc được giao và ý của người soạn (VD: phê duyệt định mức thì viết định mức, không đổi thành kế hoạch hay việc khác). Chỉ dùng căn cứ liên quan trực tiếp, không chép căn cứ của việc khác. Theo cấu trúc chuẩn trong mẫu tham khảo.
Trả về JSON: {"ve_viec": "trích yếu ngắn, viết thường, không có chữ 'Về việc', không dấu chấm cuối", "noi_dung": "thân văn bản"}.`;

async function appsScript(sv: any, payload: Record<string, unknown>) {
  const { data } = await sv.from('bi_mat').select('k,v').in('k', ['kh_script_url', 'kh_token']);
  const c: Record<string, string> = Object.fromEntries((data || []).map((x: any) => [x.k, x.v]));
  if (!c.kh_script_url || !c.kh_token) throw new Error('Chưa cấu hình cầu nối Drive (kh_script_url / kh_token).');
  const r = await fetch(c.kh_script_url, { method: 'POST', body: JSON.stringify({ token: c.kh_token, ...payload }), redirect: 'follow', signal: AbortSignal.timeout(55000) });
  const t = await r.text();
  let j: any; try { j = JSON.parse(t); } catch (_) { throw new Error('Apps Script trả lời không đọc được (đã dán mã mới và triển khai lại chưa?)'); }
  if (!j.ok) throw new Error(j.loi || 'Apps Script báo lỗi');
  return j;
}

const cacheMau = new Map<string, { docx: Uint8Array; protos: any }>();
async function layMau(sv: any, ma: string) {
  const c = cacheMau.get(ma); if (c) return c;
  try {
    const base = 'https://duylinhbl.github.io/bv-hanh-chinh/mau/';
    const [a, jj] = await Promise.all([fetch(base + ma + '.docx', { signal: AbortSignal.timeout(20000) }), fetch(base + ma + '.json', { signal: AbortSignal.timeout(20000) })]);
    if (a.ok && jj.ok) { const m = { docx: new Uint8Array(await a.arrayBuffer()), protos: (await jj.json()).protos }; cacheMau.set(ma, m); return m; }
  } catch (_) { /* dùng Apps Script */ }
  const j = await appsScript(sv, { action: 'vb_mau_lay', ma });
  const m = { docx: unb64(j.docx_b64), protos: JSON.parse(j.json).protos };
  cacheMau.set(ma, m); return m;
}

function bangXml(rows: string[][], pr: any): string {
  const n = Math.max(...rows.map((r) => r.length)), W = 8787, cw = Math.floor(W / n);
  const rpr0: string = pr.rpr || '';
  const dam = rpr0 ? (/<w:rFonts[^>]*\/>/.test(rpr0) ? rpr0.replace(/(<w:rFonts[^>]*\/>)/, '$1<w:b/>') : rpr0.replace('<w:rPr>', '<w:rPr><w:b/>')) : '<w:rPr><w:b/></w:rPr>';
  const tr = rows.map((r, ri) => '<w:tr>' + Array.from({ length: n }, (_, i) =>
    `<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r>${ri === 0 ? dam : rpr0}<w:t xml:space="preserve">${esc(r[i] || '')}</w:t></w:r></w:p></w:tc>`).join('') + '</w:tr>').join('');
  const bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${cw * n}" w:type="dxa"/><w:tblBorders>${bd}</w:tblBorders></w:tblPr><w:tblGrid>${Array(n).fill(`<w:gridCol w:w="${cw}"/>`).join('')}</w:tblGrid>${tr}</w:tbl>`;
}

function ghepWord(mau: { docx: Uint8Array; protos: any }, veViec: string, noi: string, ngay: { d: string; m: string; y: string }): Uint8Array {
  const pr = mau.protos;
  const RP = '<ns0:rPr><ns0:sz ns0:val="26"/><ns0:szCs ns0:val="26"/><ns0:lang ns0:val="nl-NL"/></ns0:rPr>';
  const RB = '<ns0:rPr><ns0:b/><ns0:sz ns0:val="26"/><ns0:szCs ns0:val="26"/><ns0:lang ns0:val="nl-NL"/></ns0:rPr>';
  const run = (t: string, b = false) => t ? `<ns0:r>${b ? RB : RP}<ns0:t xml:space="preserve">${esc(t)}</ns0:t></ns0:r>` : '';
  const jc = (p: string, v: string) => p.replace(/<ns0:jc [^>]*\/>/, '').replace(/(<ns0:pPr>[\s\S]*?)(<ns0:rPr>|<\/ns0:pPr>)/, `$1<ns0:jc ns0:val="${v}"/>$2`);
  const body = (k: string, runs: string, ind: string, v: string) => {
    let p = String(pr[k] || pr.thuong).replace(/<ns0:ind [^>]*\/>/, '').replace(/<ns0:tabs>[\s\S]*?<\/ns0:tabs>/, '');
    const sp = '<ns0:spacing ns0:before="60" ns0:after="60" ns0:line="300" ns0:lineRule="auto"/>' + ind;
    p = /<ns0:spacing [^>]*\/>/.test(p) ? p.replace(/<ns0:spacing [^>]*\/>/, sp) : p.replace('<ns0:pPr>', '<ns0:pPr>' + sp);
    p = jc(p, v);
    return p.replace(/<ns0:r>[\s\S]*<\/ns0:r>/, runs);
  };
  const IND1 = '<ns0:ind ns0:firstLine="709"/>';
  const mk = (k: string, t: string) => {
    if (k === 'dieu') { const m = t.match(/^(Điều\s*\d+[.:]?)\s*(.*)$/s); return body('thuong', m ? run(m[1] + ' ', true) + run(m[2]) : run(t, true), IND1, 'both'); }
    if (k === 'kg') return body('thuong', run(t), '<ns0:ind ns0:firstLine="709"/>', 'left');
    if (k === 'muc') return body('thuong', run(t), '<ns0:ind ns0:left="709" ns0:firstLine="0"/>', 'both');
    if (k === 'giua') return body('thuong', run(t, true), '', 'center');
    return body('thuong', run(t), IND1, 'both');
  };
  const z = unzipSync(mau.docx);
  let x = new TextDecoder().decode(z['word/document.xml']);
  const ps: string[] = []; let tb: string[][] = [];
  const flush = () => { if (!tb.length) return; ps.push(bangXml(tb, pr), mk('thuong', '')); tb = []; };
  let nt = noi.replace(/\r/g, '');
  if ((nt.match(/\n/g) || []).length < 4) nt = nt.replace(/\s+(?=(Căn cứ |Xét đề nghị|QUYẾT ĐỊNH:|Điều\s*\d+[.:]\s|Kính gửi:|Trân trọng))/g, '\n');
  nt = nt.replace(/(QUYẾT ĐỊNH:)\s*/g, '$1\n').replace(/\.\[\.\/\.\]/g, '.');
  for (const ln of nt.split('\n')) {
    const s = ln.trim(); if (!s) continue;
    if (s.includes(' | ') || (s.startsWith('|') && s.endsWith('|'))) {
      if (/^[|\s:-]+$/.test(s)) continue;
      const cells = s.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (cells.length >= 2 && cells.length <= 8 && cells.every((c) => c.length <= 160)) { if (tb.length < 80) tb.push(cells); continue; }
      flush(); ps.push(mk('thuong', cells.join('; ').slice(0, 1500))); continue; // dòng '|' bất thường: coi là văn bản, không dựng bảng
    }
    flush();
    if (/^QUYẾT ĐỊNH\s*:?$/i.test(s)) ps.push(mk('giua', 'QUYẾT ĐỊNH:'));
    else if (/^Điều\s*\d+/.test(s)) ps.push(mk('dieu', s));
    else if (/^Kính gửi/.test(s)) ps.push(mk('kg', s));
    else if (/^[-–•]/.test(s)) ps.push(mk('muc', s));
    else ps.push(mk('thuong', s));
  }
  flush();
  const i = x.indexOf('{{NOI_DUNG}}');
  if (i < 0) throw new Error('Khung mẫu thiếu vị trí nội dung');
  const a = Math.max(x.lastIndexOf('<w:p>', i), x.lastIndexOf('<w:p ', i));
  const e = x.indexOf('</w:p>', i) + 6;
  x = x.slice(0, a) + ps.join('') + x.slice(e);
  x = x.replaceAll('{{SO}}', '').replaceAll('{{NGAY}}', ngay.d).replaceAll('{{THANG}}', ngay.m).replaceAll('{{NAM}}', ngay.y).replaceAll('{{VE_VIEC}}', () => esc(veViec));
  z['word/document.xml'] = new TextEncoder().encode(x);
  return zipSync(z, { level: 6 });
}

function docxText(buf: Uint8Array): string {
  const z = unzipSync(buf, { filter: (f) => f.name === 'word/document.xml' });
  if (!z['word/document.xml']) return '';
  return new TextDecoder().decode(z['word/document.xml']).replace(/<\/w:tc>/g, ' | ').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n');
}
async function xlsxText(buf: Uint8Array): Promise<string> {
  const XLSX = await import('npm:xlsx@0.18.5');
  const wb = XLSX.read(buf, { type: 'array', sheetRows: 300, cellStyles: false });
  let s = '';
  for (const n of wb.SheetNames.slice(0, 3)) {
    const ws = wb.Sheets[n]; if (!ws['!ref']) continue;
    const r = XLSX.utils.decode_range(ws['!ref']); if (r.e.c > r.s.c + 19) r.e.c = r.s.c + 19; ws['!ref'] = XLSX.utils.encode_range(r);
    s += `### ${n}\n` + XLSX.utils.sheet_to_csv(ws).split('\n').filter((l: string) => l.replace(/,/g, '').trim()).join('\n') + '\n';
  }
  return s;
}

async function goiGemini(key: string, model: string, payload: any) {
  const t0 = Date.now(); let r!: Response;
  for (let k = 0; ; k++) {
    try { r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload), signal: AbortSignal.timeout(50000) }); }
    catch (_) { if (k >= 2 || Date.now() - t0 > 100000) throw new Error('Gemini trả lời quá lâu hoặc mất kết nối, bồ thử lại sau ít phút.'); continue; }
    if ((r.status === 503 || r.status === 500) && k < 4 && Date.now() - t0 < 90000) { await nghi(2500 * (k + 1)); continue; }
    break;
  }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = String(j?.error?.message || r.status);
    if (r.status === 429) throw new Error('Hết hạn mức miễn phí của Gemini lúc này, thử lại sau ít phút.');
    if (r.status === 503) throw new Error('Gemini đang quá tải, bồ bấm lại sau ít phút.');
    throw new Error('Gemini lỗi: ' + m.slice(0, 200));
  }
  const t = (j?.candidates?.[0]?.content?.parts || []).filter((p: any) => typeof p.text === 'string').map((p: any) => p.text).join('').trim();
  if (!t) throw new Error('Gemini không trả lời được (' + (j?.candidates?.[0]?.finishReason || 'không rõ lý do') + ').');
  return t;
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
    const { action } = b;

    if (action === 'luu') {
      const { data: vb } = await uc.from('van_ban_viec').select('id,viec_id,ten_file,storage_path,mau_ma').eq('id', b.van_ban_id).maybeSingle();
      if (!vb) return out({ loi: 'Không tìm thấy văn bản' }, 404);
      const { data: v } = await uc.from('viec').select('tieu_de,loai_cv').eq('id', vb.viec_id).maybeSingle();
      if (!v) return out({ loi: 'Không có quyền với việc này' }, 403);
      const { data: lc } = await sv.from('loai_cong_viec').select('ten,drive_folder_id').eq('ma', v.loai_cv || 'khac').maybeSingle();
      const dl = await sv.storage.from('anh').download(vb.storage_path);
      if (dl.error || !dl.data) return out({ loi: 'Không tải được file Word đã soạn' }, 500);
      const buf = new Uint8Array(await dl.data.arrayBuffer());
      const now = new Date().toISOString();
      try {
        const j = await appsScript(sv, { action: 'luu_van_ban', ten_file: vb.ten_file, b64: b64(buf), mime: MIME, loai_ten: lc?.ten || 'Khác', folder_id: lc?.drive_folder_id || '', viec_ten: sach(v.tieu_de, 60) });
        await sv.from('van_ban_viec').update({ drive_url: j.url, luu_luc: now }).eq('id', vb.id);
        return out({ ok: true, drive: true, url: j.url, thu_muc: j.thu_muc });
      } catch (e) {
        await sv.from('van_ban_viec').update({ luu_luc: now }).eq('id', vb.id);
        return out({ ok: true, drive: false, canh: String((e as Error).message || e).slice(0, 200) });
      }
    }
    if (action === 'tai') {
      const { data: vb } = await uc.from('van_ban_viec').select('ten_file,storage_path').eq('id', b.van_ban_id).maybeSingle();
      if (!vb) return out({ loi: 'Không tìm thấy văn bản' }, 404);
      const sg = await sv.storage.from('anh').createSignedUrl(vb.storage_path, 3600, { download: vb.ten_file });
      return out({ ok: true, url: sg.data?.signedUrl });
    }
    if (action !== 'soan' && action !== 'goi_y') return out({ loi: 'Thao tác không hợp lệ' }, 400);

    const { viec_id, mau_ma } = b;
    const yc = String(b.yeu_cau || '').trim().slice(0, 4000);
    const { data: v } = await uc.from('viec').select('id,tieu_de,mo_ta,file_path,file_ten').eq('id', viec_id).maybeSingle();
    if (!v) return out({ loi: 'Không có quyền với việc này' }, 403);
    let m: any = null;
    if (action === 'soan') {
      const r0 = await sv.from('mau_van_ban').select('ma,ten,loai,mau_text,hoat_dong').eq('ma', mau_ma).maybeSingle();
      m = r0.data; if (!m || !m.hoat_dong) return out({ loi: 'Không tìm thấy mẫu văn bản' }, 404);
    }
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return out({ loi: 'Chưa cài khóa Gemini (GEMINI_API_KEY).' }, 503);
    const { data: bm } = await sv.from('bi_mat').select('k,v').in('k', ['ai_model', 'ai_tat']);
    const cfg: Record<string, string> = Object.fromEntries((bm || []).map((x: any) => [x.k, x.v]));
    if (cfg.ai_tat === '1') return out({ loi: 'Trợ lý AI đang tạm tắt' }, 503);

    // Tệp đính kèm của việc (nếu có) làm dữ liệu nguồn
    let tep = '';
    const fp = b.file_path || v.file_path;
    if (fp) {
      const ok = fp === v.file_path || (await uc.from('cap_nhat_hien_trang').select('file_ten').eq('viec_id', viec_id).eq('file_path', fp).limit(1)).data?.length;
      const ext = String(fp).split('.').pop()?.toLowerCase();
      if (ok && (ext === 'docx' || ext === 'xlsx')) {
        const dl = await sv.storage.from('anh').download(fp);
        if (!dl.error && dl.data) { const bf = new Uint8Array(await dl.data.arrayBuffer()); try { tep = (ext === 'xlsx' ? await xlsxText(bf) : docxText(bf)).slice(0, 30000); } catch (_) { /* bỏ qua */ } }
      }
    }
    if (action === 'goi_y') {
      const { data: ds } = await sv.from('mau_van_ban').select('ma,ten,mo_ta').eq('hoat_dong', true).order('thu_tu');
      const ls = (ds || []).map((x: any) => `- ${x.ma}: ${x.ten} (${x.mo_ta || ''})`).join('\n');
      const tx = await goiGemini(key, cfg.ai_model || 'gemini-flash-lite-latest', {
        systemInstruction: { parts: [{ text: 'Bạn là trợ lý của Phòng Tổ chức Hành chính bệnh viện. Đọc việc được giao và dữ liệu tệp, chọn loại văn bản cần soạn phù hợp nhất trong danh sách, và viết sẵn y_chinh: 2-4 câu tóm tắt ý chính cần trình/quyết định (nội dung, số liệu chính lấy từ tệp, đối tượng, thời gian; chỗ chưa rõ ghi [ ]). Không bịa số. Chỉ trả JSON.' }] },
        contents: [{ role: 'user', parts: [{ text: `VIỆC: ${v.tieu_de}${v.mo_ta ? '\nMô tả: ' + v.mo_ta : ''}\n\nDANH SÁCH LOẠI VĂN BẢN:\n${ls}\n\nDỮ LIỆU TỆP:\n${tep || '(không đọc được tệp)'}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { mau_ma: { type: 'STRING' }, y_chinh: { type: 'STRING' } }, required: ['mau_ma', 'y_chinh'] } },
      });
      let g: any = {}; try { g = JSON.parse(tx.replace(/^```json\s*|```$/g, '')); } catch (_) { /* bỏ qua */ }
      const hop = (ds || []).some((x: any) => x.ma === g.mau_ma);
      return out({ ok: true, mau_ma: hop ? g.mau_ma : '', y_chinh: String(g.y_chinh || '') });
    }
    let cu = '';
    if (b.van_ban_cu) {
      const { data: o } = await uc.from('van_ban_viec').select('storage_path,viec_id').eq('id', b.van_ban_cu).maybeSingle();
      if (o && o.viec_id === viec_id) { const dl = await sv.storage.from('anh').download(o.storage_path); if (!dl.error && dl.data) cu = docxText(new Uint8Array(await dl.data.arrayBuffer())).slice(0, 20000); }
    }
    const mau = await layMau(sv, m.ma);
    const nguoi = `LOẠI VĂN BẢN: ${m.ten}\nVIỆC ĐƯỢC GIAO: ${v.tieu_de}${v.mo_ta ? '\nMô tả: ' + v.mo_ta : ''}\n\nYÊU CẦU CỦA NGƯỜI SOẠN:\n${yc || '(không có, soạn theo việc được giao)'}\n\nMẪU THAM KHẢO CỦA BỆNH VIỆN (chỉ học văn phong, bố cục, căn cứ; không chép nguyên số liệu cũ):\n${m.mau_text || ''}${tep ? '\n\nDỮ LIỆU TỪ TỆP ĐÍNH KÈM:\n' + tep : ''}${cu ? '\n\nVĂN BẢN ĐÃ SOẠN TRƯỚC ĐÓ (toàn văn, gồm cả phần khung đầu/cuối):\n' + cu + '\n\nĐây là yêu cầu CHỈNH SỬA: giữ nguyên phần đúng, chỉ sửa theo ý trong mục YÊU CẦU, trả về lại ĐẦY ĐỦ thân văn bản (không chỉ phần sửa).' : ''}`;
    const txt = await goiGemini(key, cfg.ai_model || 'gemini-flash-lite-latest', {
      systemInstruction: { parts: [{ text: HE_THONG }] }, contents: [{ role: 'user', parts: [{ text: nguoi }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { ve_viec: { type: 'STRING' }, noi_dung: { type: 'STRING' } }, required: ['ve_viec', 'noi_dung'] } },
    });
    let kq: any; try { kq = JSON.parse(txt.replace(/^```json\s*|```$/g, '')); } catch (_) { return out({ loi: 'Gemini trả về sai định dạng, bồ bấm soạn lại.' }, 502); }
    if (!String(kq.noi_dung || '').trim()) return out({ loi: 'Gemini không soạn được nội dung, thử bổ sung yêu cầu.' }, 502);

    const hn = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date());
    const g = (t: string) => hn.find((p) => p.type === t)!.value;
    const vViec = String(kq.ve_viec || v.tieu_de).replace(/^về việc\s*/i, '').trim();
    const docx = ghepWord(mau, vViec, String(kq.noi_dung), { d: g('day'), m: g('month'), y: g('year') });
    const tf = sach(`${m.loai === 'to_trinh' ? 'Tờ trình' : 'Quyết định'} - ${vViec}`, 100) + '.docx';
    const p = `${viec_id}/vb-${crypto.randomUUID()}.docx`;
    const up = await sv.storage.from('anh').upload(p, docx, { contentType: MIME });
    if (up.error) return out({ loi: 'Không lưu được file Word: ' + up.error.message }, 500);
    const { data: row, error: e2 } = await sv.from('van_ban_viec').insert({ viec_id, mau_ma: m.ma, ten_file: tf, storage_path: p, yeu_cau: yc || null, nguoi_id: nd.id }).select('id').single();
    if (e2) return out({ loi: 'Không ghi được danh sách văn bản: ' + e2.message }, 500);
    const sg = await sv.storage.from('anh').createSignedUrl(p, 3600, { download: tf });
    return out({ ok: true, id: row.id, ten: tf, url: sg.data?.signedUrl, mau: m.ten, text: docxText(docx).slice(0, 20000) });
  } catch (e) {
    return out({ loi: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
