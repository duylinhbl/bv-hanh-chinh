// Kiểm thử màn Tra cứu từ điển dữ liệu y tế – chạy: node tests/tra_cuu.test.js (cần playwright)
const { kiem, ket } = require('./lib');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('- bỏ qua tra_cuu: chưa cài playwright'); process.exit(0); }
const path = require('path'), root = path.join(__dirname, '..');

const LV = [
  { id: 1, ten: 'Bảo trợ xã hội', don_vi: 'Cục Bảo trợ xã hội', can_cu: 'QĐ 408/QĐ-BTXH', thu_tu: 1 }, // chưa nạp dữ liệu -> phải bị ẩn
  { id: 7, ten: 'Khám, chữa bệnh', don_vi: 'Cục Quản lý Khám, chữa bệnh', can_cu: 'QĐ 2628/QĐ-BYT', thu_tu: 7 },
  { id: 8, ten: 'Dược, mỹ phẩm', don_vi: 'Cục Quản lý Dược', can_cu: 'CV 1430/QLD-VP', thu_tu: 8 }];
const DL = [
  { id: 1, lv: 7, csdl: 'CSDL Khám chữa bệnh', nhom: 'Hành chính', ma_cn: 'BYT-KCB-001', cde: 'CDE001', ten: 'Họ và tên người bệnh', dinh_nghia: 'Họ tên đầy đủ theo giấy tờ', ngu_canh: 'Tiếp nhận', truong: 'HO_TEN', kieu: 'String', dai: '255', dinh_dang: '', can_cu: 'TT 46/2018', ghi_chu: '', trang: 120, kd: 'ho va ten nguoi benh ho_ten byt-kcb-001' },
  { id: 2, lv: 7, csdl: 'CSDL Khám chữa bệnh', nhom: 'Chẩn đoán', ma_cn: 'BYT-KCB-050', cde: '', ten: 'Mã bệnh chính (ICD-10)', dinh_nghia: 'Mã ICD-10 bệnh chính', ngu_canh: 'Ra viện', truong: 'MA_BENH', kieu: 'String', dai: '10', dinh_dang: 'Axx.x', can_cu: '', ghi_chu: '', trang: 155, kd: 'ma benh chinh icd-10 ma_benh byt-kcb-050' },
  { id: 3, lv: 8, csdl: 'CSDL Dược', nhom: 'Thuốc', ma_cn: 'BYT-DUOC-003', cde: 'CDE090', ten: 'Mã thuốc', dinh_nghia: 'Mã thuốc theo danh mục', ngu_canh: 'Kê đơn', truong: 'MA_THUOC', kieu: 'String', dai: '20', dinh_dang: '', can_cu: '', ghi_chu: '', trang: 280, kd: 'ma thuoc ma_thuoc byt-duoc-003' }];

const stub = `
window.chon=[];window.ghi=[];
const bang={tu_dien_linh_vuc:${JSON.stringify(LV)},tu_dien_dl:${JSON.stringify(DL)}};
function q(t){
  const f={t,loc:[],cot:null};
  const api={
    select(c){f.cot=c;return api},order(){return api},limit(n){f.gh=n;return api},
    ilike(c,v){f.loc.push(['ilike',c,v.replace(/%/g,'')]);return api},
    eq(c,v){f.loc.push(['eq',c,v]);return api},neq(c,v){f.loc.push(['neq',c,v]);return api},
    in(c,v){f.loc.push(['in',c,v]);return api},
    delete(){f.xoa=true;return api},
    upsert(o){window.ghi.push(o);window.chon.push(o);return Promise.resolve({error:null})},
    then(res){
      if(t==='tu_dien_chon'){
        if(f.xoa){const c=f.loc.find(x=>x[1]==='dl_id');window.chon=window.chon.filter(x=>x.dl_id!==c[2]);return res({data:[],error:null})}
        return res({data:window.chon.map(x=>({dl_id:x.dl_id,ghi_chu:x.ghi_chu})),error:null});
      }
      let d=bang[t]||[];
      f.loc.forEach(([op,c,v])=>{
        if(op==='ilike')d=d.filter(r=>String(r[c]||'').toLowerCase().includes(String(v).toLowerCase()));
        if(op==='eq')d=d.filter(r=>r[c]==v);
        if(op==='neq')d=d.filter(r=>r[c]!=v);
        if(op==='in')d=d.filter(r=>v.includes(r.id));
      });
      window.lastQ={t,loc:f.loc,n:d.length};
      return res({data:d.slice(0,f.gh||999),error:null});
    }};
  return api;
}
window.BVAPP={sb:{from:q},$:s=>document.querySelector(s),esc:s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),toast:m=>{window.lastToast=m},ban:(b,on=true)=>{if(b){b.disabled=!!on;on?b.setAttribute('aria-busy','true'):b.removeAttribute('aria-busy')}return b},me:{id:'u1'}};
`;

(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setContent('<div id="app"><div id="nd"></div><div id="toast"></div></div>');
  await p.addScriptTag({ content: stub });
  await p.addScriptTag({ path: path.join(root, 'tc.js') });
  await p.evaluate(() => window.TRACUU.ve());

  await p.waitForSelector('.tcnav');
  kiem(/Tra cứu từ điển dữ liệu y tế/.test(await p.textContent('#nd')), 'màn Tra cứu mở được');
  kiem(/3600\/QĐ-BYT/.test(await p.textContent('#nd')), 'nêu rõ căn cứ QĐ 3600/QĐ-BYT');

  // Tầng 1: danh sách lĩnh vực có số lượng trường
  await p.waitForSelector('[data-lv]');
  kiem((await p.$$('[data-lv]')).length === 2, 'chỉ hiện lĩnh vực đã nạp dữ liệu, ẩn lĩnh vực rỗng');
  kiem(await p.$('[data-lv="1"]') === null && (await p.$$('#tclv option')).length === 0, 'lĩnh vực chưa nạp không hiện ở thẻ');
  kiem(/2 trường/.test(await p.textContent('[data-lv="7"]')), 'đếm đúng số trường của lĩnh vực');

  // Bấm lĩnh vực là nhảy sang Tìm, lọc sẵn theo lĩnh vực đó
  await p.click('[data-lv="8"]');
  await p.waitForSelector('#tckq .card.v');
  kiem((await p.$$('#tckq .card.v')).length === 1, 'lọc đúng lĩnh vực vừa bấm');

  // Tìm không dấu
  await p.selectOption('#tclv', ''); await p.fill('#tcq', 'ma benh'); await p.click('#tcgo');
  await p.waitForFunction(() => document.querySelectorAll('#tckq .card.v').length === 1 && /ICD-10/.test(document.querySelector('#tckq').textContent), null, { timeout: 3000 });
  kiem(true, 'gõ không dấu "ma benh" ra đúng trường Mã bệnh chính (ICD-10)');
  const lq = await p.evaluate(() => window.lastQ);
  kiem(lq.loc.some(x => x[0] === 'ilike' && x[1] === 'kd'), 'tìm bằng cột kd (không dấu) trên máy chủ, không tải cả bảng');

  // Lọc chỉ trường có mã CDE
  await p.fill('#tcq', ''); await p.check('#tccde'); await p.click('#tcgo');
  await p.waitForFunction(() => document.querySelectorAll('#tckq .card.v').length === 2, null, { timeout: 3000 });
  kiem(true, 'lọc "chỉ trường có mã CDE" còn 2 trường');

  // Chi tiết một trường
  await p.click('#tckq .card.v'); await p.waitForSelector('#tcct');
  const ct = await p.textContent('#tcct');
  kiem(/Họ tên đầy đủ theo giấy tờ/.test(ct), 'chi tiết có định nghĩa');
  kiem(/HO_TEN/.test(ct) && /String \(255\)/.test(ct), 'chi tiết có tên kỹ thuật, kiểu và độ dài');
  kiem(/Trang 120/.test(ct), 'chi tiết chỉ rõ trang của phụ lục để đối chiếu bản gốc');

  // Lưu vào bộ của bệnh viện kèm cột HIS
  await p.fill('#tcgc', 'BENHNHAN.HOTEN');
  await p.click('#tcsao'); await p.waitForTimeout(400);
  const g = await p.evaluate(() => window.ghi);
  kiem(g.length === 1 && g[0].dl_id === 1 && g[0].ghi_chu === 'BENHNHAN.HOTEN', 'lưu đúng trường kèm cột tương ứng trong HIS');
  kiem(/Bộ của BV \(1\)/.test(await p.textContent('.tcnav')), 'số đếm bộ của bệnh viện tăng lên 1');

  // Tab Bộ của BV
  await p.click('.tcnav button[data-m="bo"]');
  await p.waitForSelector('#tccsv');
  kiem(/BENHNHAN\.HOTEN/.test(await p.textContent('#tcnd')), 'bộ của bệnh viện hiện cột HIS đã ghi');

  // Bỏ khỏi bộ
  await p.click('#tcnd .card.v'); await p.waitForSelector('#tcsao');
  kiem(/Bỏ khỏi bộ/.test(await p.textContent('#tcsao')), 'trường đã lưu thì nút đổi thành Bỏ khỏi bộ');
  await p.click('#tcsao'); await p.waitForTimeout(400);
  kiem(/Bộ của BV \(0\)/.test(await p.textContent('.tcnav')), 'bỏ được khỏi bộ của bệnh viện');

  kiem(errs.length === 0, 'không có lỗi JS: ' + errs.join(' | '));
  await b.close(); ket('tra_cuu');
})();
