// Soạn văn bản theo mẫu của bệnh viện (Mức 2): Gemini viết nội dung, ghép vào khung Word gốc (giữ quốc hiệu, bảng, chữ ký).
// BẢNG đã chốt trong chat AI thì MÁY CHỦ tự dựng phụ lục, không bắt Gemini chép lại.
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
- BẢNG: khi nội dung là danh mục/bảng số liệu từ Excel thì dựng bảng ĐẦY ĐỦ: giữ ĐÚNG và ĐỦ các cột, đúng thứ tự và tên cột của Excel (tối đa 8 cột; tuyệt đối không bỏ cột nào, đặc biệt các cột định mức/số km, kể cả cột định mức của bệnh viện nếu có trong Excel hoặc trong yêu cầu), giữ ĐỦ các hàng (đến 100 hàng), mỗi hàng một dòng riêng dạng "ô 1 | ô 2 | ô 3", ô ngắn gọn. Không dán nguyên dữ liệu Excel vào một dòng.
- Quyết định KHÔNG có dòng "Kính gửi".
- KINH PHÍ: CHỈ đưa mục "Kinh phí và nguồn kinh phí" khi việc này THỰC SỰ CHI TIỀN (mua sắm, sửa chữa, thuê dịch vụ, chi hỗ trợ, thanh toán, phê duyệt dự toán) hoặc người soạn có nêu số tiền. Việc ban hành/phê duyệt định mức, danh mục, quy trình, quy chế, cơ cấu tổ chức, kế hoạch công tác, báo cáo, nhân sự thì TUYỆT ĐỐI KHÔNG có mục kinh phí và KHÔNG đưa "Phòng Tài chính Kế toán" vào phần Kính gửi. Không bao giờ bịa câu "chi từ nguồn kinh phí hoạt động thường xuyên".
- CĂN CỨ phải nêu RÕ văn bản: số, ngày tháng năm, cơ quan ban hành, trích yếu. Căn cứ Điều lệ bệnh viện ghi nguyên văn: "Căn cứ Quyết định số 73/QĐ-HĐTV-CSDT ngày 05 tháng 5 năm 2017 của Hội đồng thành viên Công ty TNHH MTV Cao su Dầu Tiếng về việc ban hành Điều lệ tổ chức và hoạt động của Bệnh viện đa khoa Cao su Dầu Tiếng;". Cấm viết căn cứ chung chung kiểu "Căn cứ Điều lệ tổ chức và hoạt động của Bệnh viện đã được phê duyệt". Chưa biết số/ngày thì để [ ], không bỏ trống cũng không bịa.
- PHỤ LỤC: khi người soạn yêu cầu tách phụ lục, hoặc bảng dài quá 10 hàng, thì KHÔNG để bảng trong thân văn bản. Thân văn bản chỉ dẫn chiếu "(chi tiết theo Phụ lục đính kèm)". Đặt phụ lục ở CUỐI, bắt đầu bằng một dòng chỉ có chữ "PHỤ LỤC", dòng kế là tên phụ lục, rồi dòng "(Đính kèm Tờ trình số [ ] ngày [ ] tháng [ ] năm [ ] của Bệnh viện Đa khoa Cao su Dầu Tiếng)", rồi mới đến bảng. Hệ thống sẽ tự tách phần từ chữ "PHỤ LỤC" trở đi thành MỘT FILE WORD RIÊNG. Đã nhắc "Phụ lục đính kèm" trong thân văn bản thì BẮT BUỘC phải có phần PHỤ LỤC ở cuối với BẢNG ĐỦ CỘT ĐỦ HÀNG; tuyệt đối không nhắc phụ lục rồi bỏ trống. RIÊNG trường hợp lời nhắc nói rõ hệ thống đã có sẵn bảng và tự đưa vào Phụ lục thì bạn KHÔNG viết bảng và KHÔNG viết phần PHỤ LỤC, chỉ dẫn chiếu trong thân văn bản; khi đó trả thêm trường ten_phu_luc là tên danh mục viết hoa (VD: "DANH MỤC ĐỊNH MỨC TUYẾN ĐƯỜNG CHUYỂN VIỆN VÀ CÔNG TÁC").
- Nội dung chính (Điều 1 / phần đề nghị) phải nói ĐÚNG đối tượng của việc được giao và ý của người soạn (VD: phê duyệt định mức thì viết định mức, không đổi thành kế hoạch hay việc khác). Chỉ dùng căn cứ liên quan trực tiếp, không chép căn cứ của việc khác. Theo cấu trúc chuẩn trong mẫu tham khảo.
- ve_viec là TRÍCH YẾU của văn bản (viết sau chữ "V/v"), VD "phê duyệt định mức tuyến đường chuyển viện và công tác". Không chép lại tên việc được giao nếu tên đó là lời nhắc việc ("ghi lại tất cả các vị trí...").
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

function bangXml(rows: string[][], _pr: any, W: number): string {
  const n = Math.max(...rows.map((r) => r.length));
  const h0 = rows[0].map((c) => c.toLowerCase());
  const hep = (c: string) => /^(stt|tt|số tt|stt\.?)$/.test(c.trim());
  const w0 = hep(h0[0]) ? 700 : 0;
  const cw = (i: number) => w0 ? (i === 0 ? w0 : Math.floor((W - w0) / (n - 1))) : Math.floor(W / n);
  const tot = Array.from({ length: n }, (_, i) => cw(i)).reduce((a, b) => a + b, 0);
  const ro = (b: boolean) => `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${b ? '<w:b/><w:bCs/>' : '<w:b w:val="0"/><w:bCs w:val="0"/>'}<w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="nl-NL"/></w:rPr>`;
  const soCot = (c: string) => /^[\d.,\s-]+$/.test(c.trim());
  const tr = rows.map((r, ri) => '<w:tr>' + (ri === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>') + Array.from({ length: n }, (_, i) => {
    const t = r[i] || '', ctr = ri === 0 || i === 0 || soCot(t);
    return `<w:tc><w:tcPr><w:tcW w:w="${cw(i)}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/><w:ind w:left="0" w:right="0" w:firstLine="0"/><w:jc w:val="${ctr ? 'center' : 'left'}"/></w:pPr><w:r>${ro(ri === 0)}<w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p></w:tc>`;
  }).join('') + '</w:tr>').join('');
  const bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${tot}" w:type="dxa"/><w:jc w:val="center"/><w:tblInd w:w="0" w:type="dxa"/><w:tblBorders>${bd}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${Array.from({ length: n }, (_, i) => `<w:gridCol w:w="${cw(i)}"/>`).join('')}</w:tblGrid>${tr}</w:tbl>`;
}

function ghepWord(mau: { docx: Uint8Array; protos: any }, veViec: string, noi: string, ngay: { d: string; m: string; y: string }, laTT = false): Uint8Array {
  const pr = mau.protos;
  const RP = '<ns0:rPr><ns0:b ns0:val="0"/><ns0:bCs ns0:val="0"/><ns0:i ns0:val="0"/><ns0:sz ns0:val="26"/><ns0:szCs ns0:val="26"/><ns0:lang ns0:val="nl-NL"/></ns0:rPr>';
  const RB = '<ns0:rPr><ns0:b/><ns0:bCs/><ns0:i ns0:val="0"/><ns0:sz ns0:val="26"/><ns0:szCs ns0:val="26"/><ns0:lang ns0:val="nl-NL"/></ns0:rPr>';
  const run = (t: string, b = false) => t ? `<ns0:r>${b ? RB : RP}<ns0:t xml:space="preserve">${esc(t)}</ns0:t></ns0:r>` : '';
  const jc = (p: string, v: string) => p.replace(/<ns0:jc [^>]*\/>/, '').replace(/(<ns0:pPr>[\s\S]*?)(<ns0:rPr>|<\/ns0:pPr>)/, `$1<ns0:jc ns0:val="${v}"/>$2`);
  const body = (k: string, runs: string, ind: string, v: string) => {
    let p = String(pr[k] || pr.thuong).replace(/<ns0:ind [^>]*\/>/, '').replace(/<ns0:tabs>[\s\S]*?<\/ns0:tabs>/, '');
    const sp0 = (p.match(/<ns0:spacing [^>]*\/>/) || ['<ns0:spacing ns0:before="60" ns0:after="60" ns0:line="300" ns0:lineRule="auto"/>'])[0];
    p = /<ns0:spacing [^>]*\/>/.test(p) ? p.replace(/<ns0:spacing [^>]*\/>/, sp0 + ind) : p.replace('<ns0:pPr>', '<ns0:pPr>' + sp0 + ind);
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
  const dm = (x0: string) => { const g = (r: RegExp) => Number((x0.match(r) || [])[1] || 0); const w = g(/<w:pgSz [^>]*w:w="(\d+)"/), l = g(/<w:pgMar [^>]*w:left="(\d+)"/), r2 = g(/<w:pgMar [^>]*w:right="(\d+)"/); return w && w - l - r2 > 5000 ? w - l - r2 : 9070; };
  const TW = dm(x);
  const ps: string[] = []; let tb: string[][] = [];
  let boKg = false;
  const flush = () => { if (!tb.length) return; ps.push(bangXml(tb, pr, TW), mk('thuong', '')); tb = []; };
  let nt = noi.replace(/\r/g, '');
  if ((nt.match(/\n/g) || []).length < 4) nt = nt.replace(/\s+(?=(Căn cứ |Xét đề nghị|QUYẾT ĐỊNH:|Điều\s*\d+[.:]\s|Kính gửi:|Trân trọng))/g, '\n');
  nt = nt.replace(/(QUYẾT ĐỊNH:)\s*/g, '$1\n').replace(/\.\[\.\/\.\]/g, '.');
  for (const ln of nt.split('\n')) {
    const s = ln.trim(); if (!s) continue;
    if (s.includes(' | ') || (s.startsWith('|') && s.endsWith('|'))) {
      if (/^[|\s:-]+$/.test(s)) continue;
      const cells = s.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      while (cells.length > 1 && cells[cells.length - 1] === '') cells.pop();
      if (cells.length >= 2 && cells.length <= 8 && cells.every((c) => c.length <= 200)) { if (tb.length < 120) tb.push(cells); continue; }
      flush(); ps.push(mk('thuong', cells.join('; ').slice(0, 1500))); continue; // dòng '|' bất thường: coi là văn bản, không dựng bảng
    }
    flush();
    if (!laTT) { if (/^Kính gửi/.test(s)) { boKg = true; continue; } if (boKg && /^[-–•]/.test(s)) continue; boKg = false; }
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

// Phụ lục in rời: dựng file Word tối giản (không quốc hiệu, không chữ ký) — bảng rộng thì xoay ngang
function phuLucDocx(noi: string): Uint8Array {
  const dong = noi.replace(/\r/g, '').split('\n').map((x) => x.trim()).filter(Boolean);
  const soCot = Math.max(0, ...dong.filter((l) => l.includes(' | ')).map((l) => l.split('|').length));
  const ngang = soCot >= 6;
  const W = ngang ? 14570 : 9638;
  const run = (t: string, b: boolean) => `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${b ? '<w:b/><w:bCs/>' : '<w:b w:val="0"/><w:bCs w:val="0"/>'}<w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
  const P = (t: string, giua: boolean, dam: boolean) => `<w:p><w:pPr><w:spacing w:before="60" w:after="60" w:line="300" w:lineRule="auto"/><w:jc w:val="${giua ? 'center' : 'both'}"/></w:pPr>${t ? run(t, dam) : ''}</w:p>`;
  const ps: string[] = []; let tb: string[][] = [];
  const flush = () => { if (tb.length) { ps.push(bangXml(tb, null, W)); tb = []; } };
  let dauBang = true;
  for (const l of dong) {
    if (l.includes(' | ')) {
      const c = l.replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
      if (c.length >= 2 && c.length <= 8) { if (tb.length < 200) tb.push(c); continue; }
    }
    flush();
    const tieu = dauBang && ps.length < 4;
    ps.push(P(l, tieu, tieu && /^(PH\u1ee4 L\u1ee4C|DANH|B\u1ea2NG)/i.test(l)));
    if (!/^\(/.test(l) && ps.length >= 3) dauBang = false;
  }
  flush();
  const sect = ngang
    ? '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'
    : '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1588" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${ps.join('')}${sect}</w:body></w:document>`;
  const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const e = new TextEncoder();
  return zipSync({ '[Content_Types].xml': e.encode(ct), '_rels/.rels': e.encode(rels), 'word/document.xml': e.encode(doc) }, { level: 6 });
}

// Tách TẤT CẢ phụ lục đã chốt trong kết quả chat AI: mỗi khối bảng (nhiều dòng có dấu |)
// kèm theo mấy dòng tiêu đề ngay phía trên nó ("PHỤ LỤC 2", "DANH MỤC ...", "(Đính kèm ...)").
// Máy chủ tự dựng file Word cho từng phụ lục, không bắt Gemini chép lại bảng.
function phuLucTuKQ(src: string): { tieu: string[]; rows: string[][] }[] {
  const dong = String(src || '').replace(/\r/g, '').split('\n');
  const hang = (l: string): string[] | null => {
    const t = l.trim();
    if (!t.includes('|')) return null;
    if (/^[|\s:\-\u2013\u2014+]+$/.test(t)) return null; // dòng kẻ của bảng markdown
    const c = t.replace(/^\||\|$/g, '').split('|').map((x) => x.replace(/\*\*/g, '').trim());
    return c.length >= 2 && c.length <= 8 && c.some((x) => x) ? c : null;
  };
  const ra: { tieu: string[]; rows: string[][] }[] = [];
  let cur: string[][] = [], dau = 0;
  const chot = () => {
    if (cur.length >= 3) {
      const tieu: string[] = [];
      for (let k = dau - 1; k >= 0 && tieu.length < 3; k--) {
        const t = dong[k].trim();
        if (!t) { if (tieu.length) break; else continue; }
        if (hang(t) || t.length > 200) break;
        tieu.unshift(t);
        if (/^PH[\u1ee4U]\s*L[\u1ee4U]C/i.test(t)) break;
      }
      const coTen = tieu.some((x) => /PH[\u1ee4U]\s*L[\u1ee4U]C|DANH M[\u1ee4U]C|B[\u1ea2A]NG/i.test(x));
      ra.push({ tieu: coTen ? tieu : [], rows: cur });
    }
    cur = [];
  };
  dong.forEach((l, i2) => {
    const t = l.trim();
    if (t.includes('|') && /^[|\s:\-\u2013\u2014+]+$/.test(t)) return; // dòng kẻ markdown: bỏ qua, KHÔNG ngắt bảng
    const h = hang(l);
    if (h) { if (!cur.length) dau = i2; cur.push(h); } else chot();
  });
  chot();
  return ra;
}

// Trích yếu ("V/v ...") rút từ Ý chính người dùng gõ: lấy mệnh đề sau động từ trình/duyệt.
// Tên việc lúc giao thường là lời nhắc việc ("ghi lại tất cả các vị trí..."), không dùng làm trích yếu được.
function trichYeu(yc: string, tieuDe: string): string {
  const d1 = String(yc || '').replace(/\r/g, '').split('\n').map((x) => x.trim()).filter(Boolean)[0] || '';
  const m = d1.match(/(?:ph\u00ea duy\u1ec7t|ban h\u00e0nh|ch\u1ea5p thu\u1eadn|cho ph\u00e9p|th\u00e0nh l\u1eadp|h\u1ed7 tr\u1ee3|c\u1eed|\u0111\u1ec1 ngh\u1ecb|thanh to\u00e1n|mua s\u1eafm|s\u1eeda ch\u1eefa)\s+.{8,}/i);
  let t = (m ? m[0] : d1).replace(/\s+/g, ' ').trim();
  t = t.replace(/\s*c\u1ee7a B\u1ec7nh vi\u1ec7n \u0110a khoa Cao su D\u1ea7u Ti\u1ebfng/gi, '').replace(/\s*tr\u1ef1c thu\u1ed9c B\u1ec7nh vi\u1ec7n.*$/i, '');
  t = t.split(/(?<=[a-z\u00e0-\u1ef9\d])\.\s/)[0].replace(/\.$/, '').trim();
  // c\u1eaft ph\u1ea7n ph\u1ee5 cho g\u1ecdn, mi\u1ec5n c\u00f2n \u0111\u1ee7 \u00fd
  const cat = t.replace(/\s+(k\u00e8m theo|cho c\u00e1c|\u0111\u1ec3 |t\u1eeb ng\u00e0y|\u00e1p d\u1ee5ng|l\u00e0m c\u01a1 s\u1edf)\b.*$/i, '').trim();
  if (cat.length >= 25) t = cat;
  if (t.length > 110) { const c = t.slice(0, 110); t = c.slice(0, Math.max(c.lastIndexOf(' '), 60)); }
  const td = String(tieuDe || '').replace(/^v\u1ec1 vi\u1ec7c\s*/i, '').replace(/\.$/, '').trim();
  return (t.length >= 12 ? t : td).toLowerCase();
}

// Dựng thân văn bản THEO MẪU, không cần AI. Dùng khi Gemini từ chối (RECITATION) hoặc quá tải:
// cấu trúc là cố định, nội dung riêng lấy từ "Ý chính" người dùng đã gõ.
function soanTheoMau(loai: string, tieuDe: string, yc: string, coBang: boolean): { ve_viec: string; noi_dung: string } {
  const CC73 = 'Căn cứ Quyết định số 73/QĐ-HĐTV-CSDT ngày 05 tháng 5 năm 2017 của Hội đồng thành viên Công ty TNHH MTV Cao su Dầu Tiếng về việc ban hành Điều lệ tổ chức và hoạt động của Bệnh viện đa khoa Cao su Dầu Tiếng;';
  const y = String(yc || '').replace(/\r/g, '').split('\n').map((x) => x.trim().replace(/^[-–•]\s*/, '')).filter(Boolean);
  const veViec = trichYeu(yc, tieuDe);
  const dan = coBang ? 'Chi tiết theo Phụ lục đính kèm văn bản này.' : '';
  const d: string[] = [];
  if (loai === 'to_trinh') {
    d.push('Kính gửi: Giám đốc Bệnh viện Đa khoa Cao su Dầu Tiếng;');
    d.push(CC73);
    d.push('Căn cứ nhu cầu thực tế của công tác chuyên môn tại Bệnh viện;');
    d.push('Phòng Tổ chức Hành chính kính trình Giám đốc xem xét, phê duyệt nội dung sau:');
    for (const x of y) d.push('- ' + x);
    if (dan) d.push('- ' + dan);
    d.push('Trân trọng kính trình./.');
  } else {
    d.push(CC73);
    d.push('Căn cứ nhu cầu thực tế của công tác chuyên môn tại Bệnh viện;');
    d.push('Xét đề nghị tại Tờ trình số [    ]/TTr-BVĐK-TCHC ngày [    ] của Phòng Tổ chức Hành chánh,');
    d.push('QUYẾT ĐỊNH:');
    d.push('Điều 1: ' + (y[0] || veViec) + (dan ? ' ' + dan : ''));
    for (const x of y.slice(1)) d.push('- ' + x);
    d.push('Điều 2: Quyết định này có hiệu lực kể từ ngày ký.');
    d.push('Điều 3: Trưởng các khoa, phòng Bệnh viện và các đơn vị liên quan chịu trách nhiệm thi hành Quyết định này./.');
  }
  return { ve_viec: veViec, noi_dung: d.join('\n') };
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

async function goiGemini(key: string, model: string, payload: any, hanChot = 0) {
  const t0 = Date.now(); let r!: Response;
  const conLai = () => (hanChot ? hanChot - Date.now() : 50000);
  for (let k = 0; ; k++) {
    if (conLai() < 8000) throw new Error('Gemini trả lời quá lâu, bồ bấm soạn lại.');
    try { r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload), signal: AbortSignal.timeout(Math.min(35000, Math.max(8000, conLai()))) }); }
    catch (_) { if (k >= 2 || Date.now() - t0 > 100000 || conLai() < 12000) throw new Error('Gemini trả lời quá lâu hoặc mất kết nối, bồ thử lại sau ít phút.'); continue; }
    if ((r.status === 503 || r.status === 500) && k < 4 && Date.now() - t0 < 90000 && conLai() > 20000) { await nghi(2500 * (k + 1)); continue; }
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
  const T0 = Date.now(); // Supabase cắt hàm (lỗi 546) khi chạy quá lâu -> mọi việc phải xong trước mốc này
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
    const { data: bm } = await sv.from('bi_mat').select('k,v').in('k', ['ai_model', 'ai_model_manh', 'ai_tat']);
    const cfg: Record<string, string> = Object.fromEntries((bm || []).map((x: any) => [x.k, x.v]));
    if (cfg.ai_tat === '1') return out({ loi: 'Trợ lý AI đang tạm tắt' }, 503);

    // Kết quả người dùng đã chốt khi làm việc với AI về tệp — đây mới là số liệu cuối, ưu tiên hơn tệp gốc
    const kqAI = String(b.ket_qua_ai || '').slice(0, 25000);

    // Các phụ lục đã chốt: máy chủ tự dựng file Word, chỉ gửi cho Gemini bản mô tả ngắn
    const dsPL = phuLucTuKQ(kqAI);
    const moTaPL = dsPL.map((x, k) => `${x.tieu[0] || 'PHỤ LỤC ' + (k + 1)}: ${x.rows.length} dòng, cột: ${x.rows[0].join(' | ')}`).join('; ');
    const kqGui = dsPL.length
      ? kqAI.split('\n').filter((l) => !l.includes('|')).join('\n').trim().slice(0, 4000) +
        `\n\n[\u0110\u00c3 CH\u1ed0T ${dsPL.length} PH\u1ee4 L\u1ee4C: ${moTaPL}. Hệ thống TỰ dựng các phụ lục này thành file Word riêng — tuyệt đối KHÔNG chép bảng vào thân văn bản, chỉ dẫn chiếu "(chi tiết theo Phụ lục ${dsPL.length > 1 ? '1, ' + dsPL.length : ''} đính kèm)".]`
      : kqAI;

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
        contents: [{ role: 'user', parts: [{ text: `VIỆC: ${v.tieu_de}${v.mo_ta ? '\nMô tả: ' + v.mo_ta : ''}\n\nDANH SÁCH LOẠI VĂN BẢN:\n${ls}${kqAI ? '\n\nSỐ LIỆU CHỐT (người dùng đã làm việc với AI về tệp này, DÙNG CÁI NÀY):\n' + kqAI : ''}\n\nDỮ LIỆU TỆP GỐC${kqAI ? ' (chỉ tham khảo, số liệu đã cũ)' : ''}:\n${tep.slice(0, 12000) || '(không đọc được tệp)'}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { mau_ma: { type: 'STRING' }, y_chinh: { type: 'STRING' } }, required: ['mau_ma', 'y_chinh'] } },
      }, T0 + 50000);
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
    const dungNguoi = (kemTep: boolean) => `LOẠI VĂN BẢN: ${m.ten}\nVIỆC ĐƯỢC GIAO: ${v.tieu_de}${v.mo_ta ? '\nMô tả: ' + v.mo_ta : ''}\n\nYÊU CẦU CỦA NGƯỜI SOẠN:\n${yc || '(không có, soạn theo việc được giao)'}\n\nMẪU THAM KHẢO CỦA BỆNH VIỆN (chỉ học văn phong, bố cục, căn cứ; không chép nguyên số liệu cũ):\n${m.mau_text || ''}${kqAI ? '\n\nSỐ LIỆU CHỐT — BẮT BUỘC DÙNG (người soạn đã làm việc với AI trên tệp này và chốt kết quả dưới đây; mọi con số, danh sách, tên gọi trong văn bản phải lấy từ đây, KHÔNG lấy số cũ trong tệp gốc):\n' + kqGui : ''}${tep && kemTep && !dsPL.length ? '\n\nTỆP GỐC' + (kqAI ? ' (chỉ để hiểu bối cảnh, số liệu trong đây ĐÃ CŨ, không đưa vào văn bản)' : ' (dữ liệu nguồn)') + ':\n' + tep : ''}${cu ? '\n\nVĂN BẢN ĐÃ SOẠN TRƯỚC ĐÓ (toàn văn, gồm cả phần khung đầu/cuối):\n' + cu + '\n\nĐây là yêu cầu CHỈNH SỬA: giữ nguyên phần đúng, chỉ sửa theo ý trong mục YÊU CẦU, trả về lại ĐẦY ĐỦ thân văn bản (không chỉ phần sửa).' : ''}`;
    // Ưu tiên model mạnh (bảng dài không bị cắt). Quá tải / hết hạn mức -> tụt xuống model nhẹ.
    // Gemini báo RECITATION (bản thảo giống nguyên văn tài liệu nguồn) -> thử lại: bỏ TỆP GỐC, tăng temperature, bắt diễn đạt lại.
    const mManh = cfg.ai_model_manh || 'gemini-flash-latest', mNhe = cfg.ai_model || 'gemini-flash-lite-latest';
    // Bảng đã do máy chủ dựng thì AI chỉ viết phần chữ ngắn -> dùng model nhẹ trước cho nhanh
    const dsModel = [...new Set(dsPL.length ? [mNhe, mManh] : [mManh, mNhe])];
    const THO = '\n\nTrả lời dạng VĂN BẢN THUẦN (không JSON): dòng đầu ghi "VE_VIEC: <trích yếu ngắn>", từ dòng thứ hai trở đi là thân văn bản, mỗi đoạn một dòng.';
    const DIEN_LAI = '\n\nLƯU Ý: hãy TỰ DIỄN ĐẠT bằng lời văn hành chính của bạn, không chép nguyên văn đoạn dài nào từ tài liệu nguồn. Số liệu trong bảng giữ nguyên, nhưng câu chữ phải do bạn viết.';
    const HAN_CHOT = T0 + 70000; // hết giờ thì dựng theo mẫu, KHÔNG để máy chủ cắt ngang (546)
    const soanMot = async (them: string) => {
      const lan: { mo: string; t: number; tep: boolean; nhac: string; tho?: boolean }[] = [];
      for (const mo of dsModel) { lan.push({ mo, t: 0.3, tep: true, nhac: '' }); lan.push({ mo, t: 0.9, tep: false, nhac: DIEN_LAI }); }
      lan.push({ mo: dsModel[0], t: 1, tep: false, nhac: DIEN_LAI + THO, tho: true });
      let loi: unknown = null;
      for (const l of lan) {
        if (HAN_CHOT - Date.now() < 10000) break;
        try {
          const gen: any = { temperature: l.t, maxOutputTokens: dsPL.length ? 6144 : 16384 };
          if (!l.tho) { gen.responseMimeType = 'application/json'; gen.responseSchema = { type: 'OBJECT', properties: { ve_viec: { type: 'STRING' }, noi_dung: { type: 'STRING' }, ten_phu_luc: { type: 'STRING' } }, required: ['ve_viec', 'noi_dung'] }; }
          const t = await goiGemini(key, l.mo, {
            systemInstruction: { parts: [{ text: HE_THONG }] }, contents: [{ role: 'user', parts: [{ text: dungNguoi(l.tep) + them + l.nhac }] }],
            generationConfig: gen,
          }, HAN_CHOT);
          if (!l.tho) return JSON.parse(t.replace(/^```json\s*|```$/g, ''));
          const mm = t.match(/VE_VIEC\s*:\s*(.*)/i);
          const nd = t.replace(/^[\s\S]*?VE_VIEC\s*:.*\n/i, '').trim();
          if (!nd) throw new Error('Gemini trả về rỗng');
          return { ve_viec: (mm ? mm[1] : '').trim(), noi_dung: nd };
        } catch (e) { loi = e; }
      }
      throw loi || new Error('Gemini soạn lâu quá nên máy chủ dừng, bồ bấm soạn lại.');
    };
    let kq: any = null, canhBao = '';
    try { kq = await soanMot(''); } catch (e) { canhBao = String((e as Error).message || e).slice(0, 160); }
    if (!kq || !String(kq.noi_dung || '').trim()) {
      if (!yc.trim()) return out({ loi: (canhBao || 'Gemini không soạn được') + ' — bồ gõ Ý chính rồi bấm soạn lại để hệ thống tự dựng theo mẫu.' }, 502);
      kq = soanTheoMau(m.loai, v.tieu_de, yc, dsPL.length > 0);
      canhBao = 'AI không soạn được (' + canhBao + '). Bản này do hệ thống tự dựng theo mẫu bệnh viện từ Ý chính của bồ — đọc kỹ lại câu chữ, phần căn cứ và số liệu trước khi trình.';
    } else canhBao = '';
    // Nhắc "Phụ lục đính kèm" mà không xuất bảng phụ lục: soạn lại MỘT lần
    const coPL = (x: string) => /^[\s]*PH[\u1ee4U] L[\u1ee4U]C\b/im.test(x);
    if (!dsPL.length && /phụ lục/i.test(String(kq.noi_dung)) && !coPL(String(kq.noi_dung)) && HAN_CHOT - Date.now() > 30000) {
      try {
        const k2 = await soanMot('\n\nSỬA LẠI: bản vừa soạn có nhắc "Phụ lục đính kèm" nhưng THIẾU hẳn phần phụ lục. Soạn lại toàn bộ, cuối noi_dung phải có một dòng chỉ gồm chữ "PHỤ LỤC", dòng tên phụ lục, rồi BẢNG ĐẦY ĐỦ các hàng lấy từ số liệu chốt (mỗi hàng một dòng "ô 1 | ô 2 | ô 3").');
        if (String(k2?.noi_dung || '').trim() && coPL(String(k2.noi_dung))) kq = k2;
      } catch (_) { /* giữ bản đầu */ }
    }

    const hn = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date());
    const g = (t: string) => hn.find((p) => p.type === t)!.value;
    let vViec = String(kq.ve_viec || '').replace(/^về việc\s*/i, '').trim();
    if (!vViec || vViec.toLowerCase() === String(v.tieu_de || '').trim().toLowerCase()) vViec = trichYeu(yc, v.tieu_de);
    let than = String(kq.noi_dung), pl = '';
    const iPL = than.search(/^[\s]*PH[\u1ee4U] L[\u1ee4U]C\b/im);
    if (iPL > 0) { const sau = than.slice(iPL).trim(); if (sau.length > 40) { than = than.slice(0, iPL).trimEnd(); pl = sau; } }
    // Mỗi phụ lục đã chốt thành MỘT file Word riêng: đủ dòng, đúng số, không qua Gemini
    const loaiTen = m.loai === 'to_trinh' ? 'Tờ trình' : 'Quyết định';
    const dsFile: { ten: string; noi: string }[] = [];
    if (dsPL.length) {
      const tenChung = String(kq.ten_phu_luc || '').trim() || ('DANH MỤC ' + vViec.toUpperCase());
      dsPL.forEach((x, k) => {
        const so = dsPL.length > 1 ? ' ' + (k + 1) : '';
        const tieu = x.tieu.length ? x.tieu.slice() : ['PHỤ LỤC' + so, tenChung];
        if (!tieu.some((t) => /^\(/.test(t))) tieu.push(`(Đính kèm ${loaiTen} số [    ] ngày [    ] tháng [    ] năm [    ] của Bệnh viện Đa khoa Cao su Dầu Tiếng)`);
        dsFile.push({ ten: sach('Phu luc' + so + ' - ' + vViec, 100) + '.docx', noi: tieu.concat(x.rows.map((r) => r.join(' | '))).join('\n') });
      });
      // thân văn bản không được chứa bảng nữa
      than = than.split('\n').filter((l) => !(l.includes(' | ') && l.split('|').length >= 3)).join('\n');
    } else if (pl) dsFile.push({ ten: sach('Phu luc - ' + vViec, 100) + '.docx', noi: pl });
    const docx = ghepWord(mau, vViec, than, { d: g('day'), m: g('month'), y: g('year') }, m.loai === 'to_trinh');
    const tf = sach(`${loaiTen} - ${vViec}`, 100) + '.docx';
    const p = `${viec_id}/vb-${crypto.randomUUID()}.docx`;
    const up = await sv.storage.from('anh').upload(p, docx, { contentType: MIME });
    if (up.error) return out({ loi: 'Không lưu được file Word: ' + up.error.message }, 500);
    const { data: row, error: e2 } = await sv.from('van_ban_viec').insert({ viec_id, mau_ma: m.ma, ten_file: tf, storage_path: p, yeu_cau: yc || null, nguoi_id: nd.id }).select('id').single();
    if (e2) return out({ loi: 'Không ghi được danh sách văn bản: ' + e2.message }, 500);
    const sg = await sv.storage.from('anh').createSignedUrl(p, 3600, { download: tf });
    const dsPhu: any[] = [];
    for (const f of dsFile) {
      try {
        const d2 = phuLucDocx(f.noi);
        const p2 = `${viec_id}/vb-${crypto.randomUUID()}.docx`;
        const u2 = await sv.storage.from('anh').upload(p2, d2, { contentType: MIME });
        if (u2.error) continue;
        const { data: r2 } = await sv.from('van_ban_viec').insert({ viec_id, mau_ma: m.ma, ten_file: f.ten, storage_path: p2, yeu_cau: 'Phụ lục kèm theo', nguoi_id: nd.id }).select('id').single();
        const s2 = await sv.storage.from('anh').createSignedUrl(p2, 3600, { download: f.ten });
        if (r2) dsPhu.push({ id: r2.id, ten: f.ten, url: s2.data?.signedUrl, text: f.noi.slice(0, 20000) });
      } catch (_) { /* phụ lục nào hỏng thì bỏ qua, thân văn bản vẫn có */ }
    }
    return out({ ok: true, id: row.id, ten: tf, url: sg.data?.signedUrl, mau: m.ten, text: docxText(docx).slice(0, 20000), phu_luc: dsPhu[0] || null, phu_lucs: dsPhu, canh_bao: canhBao || undefined });
  } catch (e) {
    return out({ loi: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
