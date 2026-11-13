// Trợ lý AI trên file đính kèm (Gemini). Khóa: Edge Function Secret GEMINI_API_KEY.
// Cấu hình tùy chọn trong bảng bi_mat: ai_model (mặc định gemini-2.5-flash), ai_code ('0' để tắt tự chạy mã tính toán), ai_tat ('1' để tắt hẳn).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { unzipSync } from 'npm:fflate@0.8.2';
import * as XLSX from 'npm:xlsx@0.18.5';
import { AlignmentType, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'npm:docx@9.0.2';

const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Content-Type': 'application/json' };
const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
const MAX_CHARS = 250000;

const HE_THONG = `Bạn là trợ lý AI của nhân viên khối văn phòng Bệnh viện Đa khoa Cao su Dầu Tiếng. Người dùng đang xem một tệp Word/Excel do đồng nghiệp gửi để hoàn thành một công việc được giao.
Việc của bạn: đọc và phân tích tệp, tính toán số liệu, tìm số liệu bất thường, viết công thức Excel, tóm tắt, và soạn văn bản hành chính (tờ trình, quyết định, báo cáo, công văn) theo thể thức Nghị định 30/2020/NĐ-CP khi được yêu cầu.
Quy tắc:
- Trả lời bằng tiếng Việt, ngắn gọn, đi thẳng vào việc.
- Số liệu phải lấy đúng từ tệp. Cần tính toán thì dùng công cụ chạy mã để tính, không nhẩm. Không bịa số; thiếu thông tin thì nói rõ cần bổ sung gì.
- Dòng trong tệp Excel được đánh số theo dạng "r12|" (r = số dòng thật trong Excel), cột ghi ở đầu mỗi sheet. Khi viết công thức, ghi rõ địa chỉ ô thật, công thức dùng dấu phẩy ngăn cách tham số (nếu máy dùng dấu chấm phẩy thì đổi lại).
- Khi soạn văn bản: để trống hoặc ghi [ ] cho những mục chưa biết (số văn bản, ngày, tên cơ quan chủ quản, người ký), không tự bịa.
- Chỉ dùng văn bản thuần, không dùng ký hiệu markdown như ** hoặc #. Tiêu đề viết chữ IN HOA trên một dòng riêng. Danh sách dùng dấu "-". Bảng dùng dạng "cột 1 | cột 2 | cột 3" mỗi hàng một dòng.`;

function docxText(buf: Uint8Array): string {
  const z = unzipSync(buf, { filter: (f) => f.name === 'word/document.xml' });
  if (!z['word/document.xml']) throw new Error('Tệp Word không đúng định dạng');
  return new TextDecoder().decode(z['word/document.xml'])
    .replace(/<\/w:tc>/g, ' | ').replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n');
}

function xlsxText(buf: Uint8Array): string {
  const wb = XLSX.read(buf, { type: 'array' });
  let s = '';
  for (const n of wb.SheetNames) {
    const ws = wb.Sheets[n];
    if (!ws['!ref']) { s += `### Sheet "${n}": trống\n\n`; continue; }
    const r = XLSX.utils.decode_range(ws['!ref']);
    const cot = Array.from({ length: r.e.c - r.s.c + 1 }, (_, i) => XLSX.utils.encode_col(r.s.c + i)).join(',');
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: true }).split('\n');
    s += `### Sheet "${n}" (vùng ${ws['!ref']}; các cột theo thứ tự: ${cot})\n`;
    csv.forEach((l, i) => { if (l.replace(/,/g, '').trim()) s += `r${r.s.r + i + 1}|${l}\n`; });
    s += '\n';
  }
  return s;
}

const hoa = (s: string) => s === s.toUpperCase() && /[A-ZÀ-Ỹ]/.test(s) && s.length < 120;
function toDocx(noi: string): Promise<Uint8Array> {
  const kids: (Paragraph | Table)[] = [];
  let tbl: string[][] = [];
  const F = 'Times New Roman';
  const flush = () => {
    if (!tbl.length) return;
    const n = Math.max(...tbl.map((r) => r.length)), W = 8787, cw = Math.floor(W / n);
    kids.push(new Table({
      width: { size: cw * n, type: WidthType.DXA }, columnWidths: Array(n).fill(cw),
      rows: tbl.map((r, ri) => new TableRow({ children: Array.from({ length: n }, (_, i) => new TableCell({ width: { size: cw, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: r[i] || '', font: F, size: 26, bold: ri === 0 })] })] })) })),
    }));
    kids.push(new Paragraph({ children: [] }));
    tbl = [];
  };
  for (const raw of noi.replace(/\r/g, '').split('\n')) {
    const s = raw.trim();
    if (s.includes(' | ') || (s.startsWith('|') && s.endsWith('|'))) {
      if (/^[|\s:-]+$/.test(s)) continue;
      tbl.push(s.replace(/^\||\|$/g, '').split('|').map((x) => x.trim()));
      continue;
    }
    flush();
    if (!s) { kids.push(new Paragraph({ children: [] })); continue; }
    if (hoa(s)) kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: s, font: F, size: 28, bold: true })] }));
    else kids.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 340 }, indent: s.startsWith('-') || s.length < 60 ? undefined : { firstLine: 567 }, children: [new TextRun({ text: s, font: F, size: 28 })] }));
  }
  flush();
  const doc = new Document({
    styles: { default: { document: { run: { font: F, size: 28 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1985, right: 1134 } } }, children: kids }],
  });
  return Packer.toBuffer(doc) as Promise<Uint8Array>;
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
    const { action, viec_id, file_path } = b;
    if (!viec_id || !file_path) return out({ loi: 'Thiếu thông tin việc/tệp' }, 400);

    // Quyền: người dùng phải xem được việc (RLS) và tệp phải thuộc việc đó
    const { data: v } = await uc.from('viec').select('id,tieu_de,mo_ta,file_path,file_ten').eq('id', viec_id).maybeSingle();
    if (!v) return out({ loi: 'Không có quyền với việc này' }, 403);
    let ten: string | null = v.file_path === file_path ? v.file_ten : null;
    if (!ten) {
      const { data: c } = await uc.from('cap_nhat_hien_trang').select('file_ten').eq('viec_id', viec_id).eq('file_path', file_path).limit(1);
      ten = c?.[0]?.file_ten || null;
    }
    if (!ten) return out({ loi: 'Tệp không thuộc việc này' }, 403);

    if (action === 'lich_su') {
      const { data } = await sv.from('file_chat').select('vai,noi_dung,tao_luc').eq('viec_id', viec_id).eq('file_path', file_path).eq('nguoi_id', nd.id).order('tao_luc', { ascending: true }).limit(200);
      return out({ ok: true, lich_su: data || [] });
    }
    if (action === 'xoa_lich_su') {
      await sv.from('file_chat').delete().eq('viec_id', viec_id).eq('file_path', file_path).eq('nguoi_id', nd.id);
      return out({ ok: true });
    }
    if (action === 'xuat_word') {
      const noi = String(b.noi_dung || '').slice(0, 60000);
      if (!noi.trim()) return out({ loi: 'Không có nội dung để xuất' }, 400);
      const buf = await toDocx(noi);
      const tf = String(b.ten_file || 'Van ban soan bang AI').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Van ban';
      const p = `${viec_id}/ai-${crypto.randomUUID()}.docx`;
      const up = await sv.storage.from('anh').upload(p, buf, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      if (up.error) return out({ loi: 'Không lưu được file Word: ' + up.error.message }, 500);
      const sg = await sv.storage.from('anh').createSignedUrl(p, 3600, { download: tf + '.docx' });
      return out({ ok: true, url: sg.data?.signedUrl, ten: tf + '.docx' });
    }
    if (action !== 'chat') return out({ loi: 'Thao tác không hợp lệ' }, 400);

    const hoi = String(b.cau_hoi || '').trim().slice(0, 4000);
    if (!hoi) return out({ loi: 'Chưa nhập câu hỏi' }, 400);
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return out({ loi: 'Chưa cài khóa Gemini. Quản trị vào Supabase → Edge Functions → Secrets, thêm GEMINI_API_KEY.' }, 503);
    const { data: bm } = await sv.from('bi_mat').select('k,v').in('k', ['ai_model', 'ai_code', 'ai_tat']);
    const cfg: Record<string, string> = Object.fromEntries((bm || []).map((x: any) => [x.k, x.v]));
    if (cfg.ai_tat === '1') return out({ loi: 'Trợ lý AI đang tạm tắt' }, 503);
    const model = cfg.ai_model || 'gemini-2.5-flash';

    const ext = (ten.split('.').pop() || '').toLowerCase();
    if (ext === 'doc' || ext === 'xls') return out({ loi: 'Tệp đời cũ (.doc/.xls) chưa đọc được. Hãy mở bằng Word/Excel rồi lưu thành .docx/.xlsx và gửi lại.' }, 422);
    const dl = await sv.storage.from('anh').download(file_path);
    if (dl.error || !dl.data) return out({ loi: 'Không tải được tệp từ kho' }, 500);
    const buf = new Uint8Array(await dl.data.arrayBuffer());
    let text = ext === 'xlsx' ? xlsxText(buf) : docxText(buf);
    let cat = false;
    if (text.length > MAX_CHARS) { text = text.slice(0, MAX_CHARS); cat = true; }

    const { data: ls } = await sv.from('file_chat').select('vai,noi_dung').eq('viec_id', viec_id).eq('file_path', file_path).eq('nguoi_id', nd.id).order('tao_luc', { ascending: false }).limit(30);
    const hist = (ls || []).reverse();
    const ngu = `Việc được giao: ${v.tieu_de}${v.mo_ta ? '\nMô tả: ' + v.mo_ta : ''}\nNgười đang hỏi: ${nd.ho_ten}\n\nNỘI DUNG TỆP "${ten}"${cat ? ' (đã cắt bớt vì quá dài, chỉ đọc được phần đầu)' : ''}:\n${text}`;
    const contents = [
      { role: 'user', parts: [{ text: ngu }] },
      { role: 'model', parts: [{ text: 'Đã đọc xong tệp. Anh/chị cần tôi làm gì?' }] },
      ...hist.map((h: any) => ({ role: h.vai, parts: [{ text: h.noi_dung }] })),
      { role: 'user', parts: [{ text: hoi }] },
    ];
    const payload: any = { systemInstruction: { parts: [{ text: HE_THONG }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: 8192 } };
    if (cfg.ai_code !== '0') payload.tools = [{ code_execution: {} }];

    const goi = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload) });
    let r = await goi();
    if (r.status === 503) { await new Promise((ok) => setTimeout(ok, 2500)); r = await goi(); }
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = String(j?.error?.message || r.status);
      if (r.status === 429) return out({ loi: 'Hết hạn mức miễn phí của Gemini trong lúc này, thử lại sau ít phút (hoặc sang ngày mới).' }, 429);
      if (r.status === 400 && /API key|API_KEY/i.test(m)) return out({ loi: 'Khóa Gemini không hợp lệ, quản trị cần kiểm tra lại GEMINI_API_KEY.' }, 502);
      if (r.status === 403 || /location|not supported/i.test(m)) return out({ loi: 'Gemini từ chối yêu cầu: ' + m.slice(0, 200) }, 502);
      return out({ loi: 'Gemini lỗi: ' + m.slice(0, 200) }, 502);
    }
    const parts = j?.candidates?.[0]?.content?.parts || [];
    const tra = parts.filter((p: any) => typeof p.text === 'string').map((p: any) => p.text).join('').trim();
    if (!tra) return out({ loi: 'Gemini không trả lời được (' + (j?.candidates?.[0]?.finishReason || j?.promptFeedback?.blockReason || 'không rõ lý do') + '). Thử hỏi lại cách khác.' }, 502);
    const tk = j?.usageMetadata?.totalTokenCount ?? null;
    await sv.from('file_chat').insert([
      { viec_id, file_path, nguoi_id: nd.id, vai: 'user', noi_dung: hoi },
      { viec_id, file_path, nguoi_id: nd.id, vai: 'model', noi_dung: tra, tokens: tk },
    ]);
    return out({ ok: true, tra_loi: tra, tokens: tk, cat });
  } catch (e) {
    return out({ loi: 'Lỗi hệ thống: ' + String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
