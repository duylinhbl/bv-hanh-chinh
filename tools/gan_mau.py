#!/usr/bin/env python3
"""Biến file Word mẫu của bệnh viện thành "khung" có ô điền:
  {{SO}} {{NGAY}} {{THANG}} {{NAM}} {{VE_VIEC}}  và một đoạn {{NOI_DUNG}} thay cho toàn bộ phần thân.
Giữ nguyên quốc hiệu, bảng đầu trang, khối chữ ký, nơi nhận.
Xuất: <ra>/<ma>.docx (khung) và <ra>/<ma>.json (kiểu đoạn mẫu + văn bản mẫu để AI tham khảo).
Dùng: gan_mau.py <thư mục chứa file gốc> <thư mục ra>"""
import copy, json, re, sys, zipfile, os, shutil, io
from lxml import etree

W = 'http://schemas.openxmlformats-officedocument.wordprocessingml.document'.replace('officedocument.wordprocessingml.document', 'wordprocessingml/2006/main')
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
q = lambda t: '{%s}%s' % (W, t)

def ptext(p): return ''.join(p.xpath('.//w:t/text()', namespaces=NS))
def etext(el): return ''.join(el.xpath('.//w:t/text()', namespaces=NS))
def local(el): return etree.QName(el).localname

def replace_in_par(p, pattern, repl):
    """Thay theo regex trên chữ ghép của đoạn, giữ định dạng run đầu tiên bị trúng."""
    ts = p.xpath('.//w:t', namespaces=NS)
    full = ''.join(t.text or '' for t in ts)
    m = re.search(pattern, full)
    if not m: return False
    a, b = m.span()
    new = m.expand(repl) if callable(repl) is False else repl(m)
    pos = 0; placed = False
    for t in ts:
        s = t.text or ''; s0, s1 = pos, pos + len(s); pos = s1
        if s1 <= a or s0 >= b: continue
        lo, hi = max(a, s0) - s0, min(b, s1) - s0
        if not placed:
            t.text = s[:lo] + new + s[hi:]; placed = True
        else:
            t.text = s[:lo] + s[hi:]
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    return True

def first_rpr(p):
    r = p.find('.//w:r', NS)
    if r is None: return None
    rp = r.find('w:rPr', NS)
    return copy.deepcopy(rp) if rp is not None else None

def proto(p, text='§§', bold=None):
    """Đoạn mẫu: giữ pPr, một run duy nhất mang rPr của run đầu."""
    n = etree.Element(q('p'))
    ppr = p.find('w:pPr', NS)
    if ppr is not None: n.append(copy.deepcopy(ppr))
    r = etree.SubElement(n, q('r'))
    rp = first_rpr(p)
    if rp is None: rp = etree.Element(q('rPr'))
    for tag in ('b', 'bCs', 'i', 'iCs'):
        for e in rp.findall('w:' + tag, NS): rp.remove(e)
    if bold:
        rp.insert(0, etree.Element(q('b')))
    r.append(rp)
    t = etree.SubElement(r, q('t')); t.text = text
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    return etree.tostring(n, encoding='unicode')

LOAI_CAN_CU = re.compile(r'^Căn cứ|^Theo |^Xét ')

def build(src, ma, ra):
    zin = zipfile.ZipFile(src)
    xml = zin.read('word/document.xml')
    root = etree.fromstring(xml)
    body = root.find('w:body', NS)
    kids = list(body)

    # Có file chứa 2 văn bản nối nhau: lấy văn bản sau cùng nếu có cờ
    # (xử lý riêng ở ngoài, qua cắt trước khi gọi)

    # 1) Số văn bản
    for p in root.xpath('//w:p', namespaces=NS):
        if re.search(r'Số\s*:', ptext(p)):
            if replace_in_par(p, r'Số\s*:\s*[\w]*\s*(?=/)', 'Số: {{SO}}'):
                break
    # 2) Ngày tháng
    for p in root.xpath('//w:p', namespaces=NS):
        if re.search(r'ngày\s+\d+\s+tháng\s+\d+\s+năm\s+\d{4}', ptext(p)):
            replace_in_par(p, r'ngày\s+\d+\s+tháng\s+\d+\s+năm\s+\d{4}', 'ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}')
            break
    # 3) Về việc (+ các dòng nối tiếp cùng khối)
    BIEN = re.compile(r'^(Kính gửi|GIÁM ĐỐC BỆNH VIỆN|Căn cứ)')
    for p in root.xpath('//w:p', namespaces=NS):
        if ptext(p).strip().startswith('Về việc'):
            full = ptext(p)
            # thay toàn bộ chữ của đoạn bằng "Về việc {{VE_VIEC}}"
            replace_in_par(p, r'^.*$', 'Về việc {{VE_VIEC}}') if '\n' not in full else None
            nxt = p.getnext()
            while nxt is not None and local(nxt) == 'p':
                tx = etext(nxt).strip().replace('\xa0', '')
                if BIEN.match(tx) or tx == '':
                    if tx == '': nxt = nxt.getnext(); continue
                    break
                dead = nxt; nxt = nxt.getnext(); dead.getparent().remove(dead)
            break

    # 4) Vùng thân
    kids = list(body)
    def top_text(el): return etext(el).strip()
    start = None
    for i, el in enumerate(kids):
        if local(el) == 'p' and re.match(r'^Kính gửi', top_text(el)): start = i; break
    if start is None:
        for i, el in enumerate(kids):
            if local(el) == 'p' and re.match(r'^Căn cứ', top_text(el)): start = i; break
    assert start is not None, 'không thấy điểm bắt đầu thân: ' + ma
    end = None
    for i in range(start + 1, len(kids)):
        el = kids[i]; tx = top_text(el)
        if local(el) == 'tbl' and ('GIÁM ĐỐC' in tx or 'P. TỔ CHỨC' in tx): end = i; break
        if local(el) == 'p' and (tx.replace('\xa0', '').strip() in ('GIÁM ĐỐC', 'TỔNG GIÁM ĐỐC') or tx.startswith('Nơi nhận')): end = i; break
    assert end is not None, 'không thấy điểm kết thúc thân: ' + ma
    region = kids[start:end]
    # chừa lại các đoạn trống cuối vùng (khoảng cách trước chữ ký)
    while region and local(region[-1]) == 'p' and etext(region[-1]).strip() == '': region.pop()

    paras = [e for e in region if local(e) == 'p' and etext(e).strip()]
    def find(rx):
        for e in paras:
            if re.match(rx, etext(e).strip()): return e
    def pick(*cs):
        for c in cs:
            if c is not None: return c
    p_th = pick(find(r'^Căn cứ'), paras[0])
    p_dieu = pick(find(r'^Điều\s*\d'), find(r'^[IVX]+\.'), find(r'^\d+\.'), p_th)
    p_muc = pick(find(r'^[-–]'), p_th)
    p_kg = pick(find(r'^Kính gửi'), p_th)
    protos = {'thuong': proto(p_th), 'dieu': proto(p_dieu, bold=True), 'muc': proto(p_muc), 'kg': proto(p_kg)}
    rp = first_rpr(p_th)
    protos['rpr'] = etree.tostring(rp, encoding='unicode') if rp is not None else ''
    mau_text = '\n'.join(etext(e).strip() for e in paras)

    # 5) thay vùng bằng đoạn đánh dấu
    marker = copy.deepcopy(p_th)
    for r in marker.findall('w:r', NS): marker.remove(r)
    for e in list(marker):
        if local(e) not in ('pPr',): marker.remove(e)
    r = etree.SubElement(marker, q('r')); t = etree.SubElement(r, q('t')); t.text = '{{NOI_DUNG}}'
    anchor = region[0]
    anchor.addprevious(marker)
    for e in region: body.remove(e)

    # ghi docx mới
    os.makedirs(ra, exist_ok=True)
    out = os.path.join(ra, ma + '.docx')
    zout = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
    for it in zin.infolist():
        if it.filename.endswith('/'): continue
        data = zin.read(it.filename)
        if it.filename == 'word/document.xml':
            data = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
        zout.writestr(it.filename, data)
    zout.close()
    json.dump({'protos': protos, 'mau_text': mau_text}, open(os.path.join(ra, ma + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print('OK', ma, len(region), 'phần tử thân,', len(mau_text), 'ký tự mẫu')

if __name__ == '__main__':
    src_dir, ra = sys.argv[1], sys.argv[2]
    for f in sorted(os.listdir(src_dir)):
        if f.endswith('.docx'): build(os.path.join(src_dir, f), f[:-5], ra)
