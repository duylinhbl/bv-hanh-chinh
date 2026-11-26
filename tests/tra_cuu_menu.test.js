// Kiểm thử menu TRA CỨU (tracuu.js): đầu mối 4 nhánh + màn tra cứu ICD-10.
// Chạy: node tests/tra_cuu_menu.test.js   (cần playwright)
const { kiem, ket } = require('./lib');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('- bỏ qua tra_cuu_menu: chưa cài playwright'); process.exit(0); }
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');

// ---- Đấu nối trong app ----
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
kiem(/<span>Tra cứu<\/span>/.test(app), 'nút điều hướng đổi nhãn thành "Tra cứu" (không còn là "Thuốc")');
kiem(/tc:\(\)=>window\.TRACUU\.ve\(\)/.test(app), "tab 'tc' mở menu Tra cứu");
kiem(/tracuu\.js/.test(html) && /'tracuu\.js'/.test(sw), 'tracuu.js có trong index.html và trong danh sách cache của service worker');
kiem(/id="tlen"/.test(fs.readFileSync(path.join(root, 'thuoc.js'), 'utf8')), 'màn Thuốc có nút quay về menu Tra cứu');

const NGUON = [
  { ma_dm: 'icd10', ban: 'QĐ 4469/QĐ-BYT ngày 28/10/2020', cap_nhat: '2026-11-26T06:00:00Z', so_dong: 12239 },
  { ma_dm: 'thuoc', ban: 'Báo cáo DUC034 kỳ 28/08/2025–28/08/2026', cap_nhat: '2026-11-26T06:00:00Z', so_dong: 307 },
  { ma_dm: 'phac_do', ban: null, cap_nhat: null, so_dong: 0 },
  { ma_dm: 'quy_trinh_kt', ban: null, cap_nhat: null, so_dong: 0 },
];
const ICD = [
  { ma: 'K59.1', ten: 'Tiêu chảy chức năng', nhom: 'Bệnh khác của ruột', man_tinh: false, khong_bh: false, ten_khac: null, kd: 'k59.1 tieu chay chuc nang' },
  { ma: 'I10', ten: 'Tăng huyết áp vô căn (nguyên phát)', nhom: 'Bệnh tăng huyết áp', man_tinh: true, khong_bh: false, ten_khac: 'Cao huyết áp', kd: 'i10 tang huyet ap vo can (nguyen phat) cao huyet ap' },
  { ma: 'Z41.1', ten: 'Phẫu thuật thẩm mỹ', nhom: 'Khác', man_tinh: false, khong_bh: true, ten_khac: null, kd: 'z41.1 phau thuat tham my' },
];

const stub = `
window.lastQ=null; window.daMoThuoc=false;
const NGUON=${JSON.stringify(NGUON)}, ICD=${JSON.stringify(ICD)};
function q(t){
  const f={loc:[]};
  const api={ select(){return api}, order(){return api}, limit(n){f.gh=n;return api},
    ilike(c,v){f.loc.push(['ilike',c,v.replace(/%/g,'')]);return api},
    eq(c,v){f.loc.push(['eq',c,v]);return api},
    then(res){
      if(t==='tra_cuu_nguon')return res({data:NGUON,error:null});
      let d=ICD.slice();
      f.loc.forEach(([op,c,v])=>{
        if(op==='ilike')d=d.filter(r=>String(r[c]||'').includes(String(v)));
        if(op==='eq')d=d.filter(r=>r[c]===v);
      });
      window.lastQ={t,loc:f.loc,n:d.length};
      return res({data:d.slice(0,f.gh||999),error:null});
    }};
  return api;
}
window.TRATHUOC={ve:()=>{window.daMoThuoc=true}};
window.BVAPP={sb:{from:q,rpc:()=>Promise.resolve({data:true,error:null})},
  $:s=>document.querySelector(s),
  esc:s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  toast:()=>{}, ban:b=>b, me:{id:'u1',la_quan_tri:false,vai_tro:'nv'}};
`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setContent('<div id="app"><div id="nd"></div><div id="toast"></div></div>');
  await p.addScriptTag({ content: stub });
  await p.addScriptTag({ path: path.join(root, 'tracuu.js') });
  await p.evaluate(() => window.TRACUU.ve());

  // ---- Đầu mối ----
  await p.waitForSelector('[data-nh]');
  const nd = await p.textContent('#nd');
  kiem(/Tra cứu chuyên môn/.test(nd), 'menu Tra cứu mở được');
  ['ICD-10', 'Thuốc & BHYT', 'Phác đồ điều trị', 'Quy trình & danh mục kỹ thuật']
    .forEach(t => kiem(nd.includes(t), 'có nhánh ' + t));
  kiem((await p.$$('[data-nh]')).length === 2, 'chỉ hai nhánh đã có dữ liệu mới bấm được');
  kiem(/12\.239 mục/.test(nd) && /307 mục/.test(nd), 'mỗi nhánh hiện số mục, viết số kiểu Việt Nam (12.239)');
  kiem(/QĐ 4469\/QĐ-BYT/.test(nd) && /DUC034/.test(nd), 'mỗi nhánh ghi rõ NGUỒN dữ liệu');
  kiem((nd.match(/đang chờ phòng KHTH cung cấp/g) || []).length === 2, 'hai nhánh chưa có nói rõ đang chờ ai');
  kiem(await p.$('[data-nh="phac_do"]') === null, 'nhánh chưa có dữ liệu thì không bấm vào được');

  // ---- Sang nhánh Thuốc ----
  await p.click('[data-nh="thuoc"]');
  kiem(await p.evaluate(() => window.daMoThuoc), 'bấm nhánh Thuốc thì mở màn Thuốc');

  // ---- Nhánh ICD-10 ----
  await p.evaluate(() => window.TRACUU.ve());
  await p.waitForSelector('[data-nh="icd10"]');
  await p.click('[data-nh="icd10"]');
  await p.waitForSelector('#iq');
  kiem(/Tra cứu mã bệnh ICD-10/.test(await p.textContent('#nd')), 'mở được màn tra cứu ICD-10');
  kiem(/Nguồn: QĐ 4469\/QĐ-BYT/.test(await p.textContent('#nd')), 'màn ICD-10 ghi rõ đang dùng bản nào');

  // gõ không dấu
  await p.fill('#iq', 'tang huyet ap'); await p.click('#igo');
  await p.waitForFunction(() => /I10/.test(document.querySelector('#ikq').textContent), null, { timeout: 3000 });
  kiem(true, 'gõ không dấu "tang huyet ap" ra đúng I10');
  const q1 = await p.evaluate(() => window.lastQ);
  kiem(q1.t === 'icd10' && q1.loc.some(x => x[0] === 'ilike' && x[1] === 'kd'), 'tìm bằng cột kd trên máy chủ');
  const kq = await p.innerHTML('#ikq');
  kiem(/bệnh mãn tính/.test(kq), 'mã mãn tính có nhãn "bệnh mãn tính"');
  kiem(/Tên khác: Cao huyết áp/.test(kq), 'hiện tên gọi khác để tra bằng tên dân gian cũng ra');

  // tra theo mã
  await p.fill('#iq', 'k59.1'); await p.press('#iq', 'Enter');
  await p.waitForFunction(() => /Tiêu chảy chức năng/.test(document.querySelector('#ikq').textContent), null, { timeout: 3000 });
  kiem(true, 'tra bằng chính mã bệnh cũng ra, Enter cũng tra được');

  // cảnh báo mã không được BHYT thanh toán
  await p.fill('#iq', 'tham my'); await p.click('#igo');
  await p.waitForFunction(() => /Z41\.1/.test(document.querySelector('#ikq').textContent), null, { timeout: 3000 });
  kiem(/BHYT không thanh toán/.test(await p.innerHTML('#ikq')), 'mã ngoài phạm vi BHYT được cảnh báo rõ');

  // lọc chỉ mãn tính
  await p.fill('#iq', ''); await p.check('#imt'); await p.click('#igo');
  await p.waitForFunction(() => window.lastQ && window.lastQ.loc.some(x => x[0] === 'eq'), null, { timeout: 3000 });
  const q2 = await p.evaluate(() => window.lastQ);
  kiem(q2.loc.some(x => x[0] === 'eq' && x[1] === 'man_tinh' && x[2] === true), 'lọc "chỉ bệnh mãn tính" gửi đúng điều kiện');
  kiem(q2.n === 1, 'lọc mãn tính còn đúng 1 mã');

  // quay về đầu mối
  await p.click('#tcve');
  await p.waitForSelector('[data-nh]');
  kiem(/Tra cứu chuyên môn/.test(await p.textContent('#nd')), 'nút ← Tra cứu quay về đầu mối');

  kiem(errs.length === 0, 'không có lỗi JS: ' + errs.join(' | '));
  await b.close(); ket('tra_cuu_menu');
})();
