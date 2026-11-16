// Đọc và sửa file Word (.docx) ở mức đoạn văn, giữ nguyên định dạng của mẫu.
import { unzipSync, zipSync } from 'npm:fflate@0.8.2';

const un = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const es = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const RE_P = /<w:p[ >][\s\S]*?<\/w:p>/g;
const RE_R = /<w:r[ >][\s\S]*?<\/w:r>/g;
const RE_T = /<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g;
const laDo = (rp: string) => {
  const m = rp.match(/<w:color [^>]*w:val="([0-9A-Fa-f]{6})"/);
  if (!m) return false;
  const r = parseInt(m[1].slice(0, 2), 16), g = parseInt(m[1].slice(2, 4), 16), b = parseInt(m[1].slice(4, 6), 16);
  return r >= 0xB0 && g <= 0x70 && b <= 0x70;
};

export function moDocx(buf: Uint8Array): { files: Record<string, Uint8Array>; xml: string } {
  const files = unzipSync(buf);
  if (!files['word/document.xml']) throw new Error('Tệp Word không đúng định dạng');
  return { files, xml: new TextDecoder().decode(files['word/document.xml']) };
}
export function dongDocx(files: Record<string, Uint8Array>, xml: string): Uint8Array {
  return zipSync({ ...files, 'word/document.xml': new TextEncoder().encode(xml) }, { level: 6 });
}

// Danh sách đoạn văn: chữ thuần + bản có đánh dấu ⟦ĐỎ: …⟧ cho AI đọc. Chỉ số p dùng lại khi thay.
export function doanVan(xml: string): { p: number; chu: string; hien: string }[] {
  const kq: { p: number; chu: string; hien: string }[] = [];
  let i = 0;
  for (const m of xml.matchAll(RE_P)) {
    const seg: { t: string; d: boolean }[] = [];
    for (const r of m[0].match(RE_R) || []) {
      const rp = (r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
      let t = '';
      for (const x of r.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br[^>]*\/>/g)) t += x[1] !== undefined ? un(x[1]) : ' ';
      if (!t) continue;
      const d = laDo(rp);
      if (seg.length && seg[seg.length - 1].d === d) seg[seg.length - 1].t += t; else seg.push({ t, d });
    }
    const chu = seg.map((x) => x.t).join('');
    if (chu.trim()) kq.push({ p: i, chu, hien: seg.map((x) => (x.d && x.t.trim() ? '⟦ĐỎ: ' + x.t + '⟧' : x.t)).join('') });
    i++;
  }
  return kq;
}
export function chuCoDo(xml: string): string {
  return doanVan(xml).map((d) => d.hien).join('\n');
}

const boDau = (s: string) => String(s || '').replace(/⟦ĐỎ:\s?|⟧/g, '');
const reTim = (cu: string) => new RegExp(cu.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'));

// Thay chữ trong từng đoạn. thay: [{p, cu, moi, chac}] -> {xml, ok: boolean[]}
export function thayDoan(xml: string, thay: { p: number; cu: string; moi: string; chac?: boolean }[]): { xml: string; ok: boolean[] } {
  const ps = [...xml.matchAll(RE_P)].map((m) => ({ a: m.index || 0, s: m[0] }));
  const ok = thay.map(() => false);
  const theoP = new Map<number, number[]>();
  thay.forEach((t, k) => { if (Number.isInteger(t.p) && t.p >= 0 && t.p < ps.length && boDau(t.cu).trim()) { if (!theoP.has(t.p)) theoP.set(t.p, []); theoP.get(t.p)!.push(k); } });
  for (const [p, ks] of theoP) {
    let s = ps[p].s;
    for (const k of ks) {
      const cu = boDau(thay[k].cu), moi = boDau(thay[k].moi ?? '');
      const nut = [...s.matchAll(RE_T)].map((m) => ({ a: m.index || 0, len: m[0].length, t: un(m[1]) }));
      let S = ''; const vt: number[] = [];
      for (const n of nut) { vt.push(S.length); S += n.t; }
      const mm = reTim(cu).exec(S);
      if (!mm || !mm[0]) continue;
      const A = mm.index, B = A + mm[0].length;
      let dau = true; const sua: { i: number; t: string }[] = [];
      nut.forEach((n, i) => {
        const a = vt[i], b = a + n.t.length;
        if (b <= A || a >= B) { if (!(a === A && A === B)) return; }
        if (n.t.length === 0) return;
        const truoc = n.t.slice(0, Math.max(0, A - a)), sau = n.t.slice(Math.max(0, Math.min(n.t.length, B - a)));
        sua.push({ i, t: truoc + (dau ? moi : '') + sau }); dau = false;
      });
      if (!sua.length) continue;
      // nếu chắc chắn: bỏ màu đỏ của run đầu tiên được thay (chữ đỏ = chỗ chờ điền)
      let boMau: { a: number; b: number } | null = null;
      if (thay[k].chac !== false) {
        const n0 = nut[sua[0].i];
        const ra = Math.max(s.lastIndexOf('<w:r>', n0.a), s.lastIndexOf('<w:r ', n0.a));
        if (ra >= 0) { const doan = s.slice(ra, n0.a); const c = doan.match(/<w:color [^>]*\/>/); if (c && laDo(doan)) boMau = { a: ra + (c.index || 0), b: ra + (c.index || 0) + c[0].length }; }
      }
      for (const x of sua.reverse()) { const n = nut[x.i]; s = s.slice(0, n.a) + '<w:t xml:space="preserve">' + es(x.t) + '</w:t>' + s.slice(n.a + n.len); }
      if (boMau) s = s.slice(0, boMau.a) + s.slice(boMau.b);
      ok[k] = true;
    }
    ps[p].s = s;
  }
  let out = '', con = 0;
  const goc = [...xml.matchAll(RE_P)];
  goc.forEach((m, i) => { out += xml.slice(con, m.index) + ps[i].s; con = (m.index || 0) + m[0].length; });
  return { xml: out + xml.slice(con), ok };
}
