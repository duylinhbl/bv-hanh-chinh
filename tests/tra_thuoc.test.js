// Kiểm thử màn Tra cứu tờ hướng dẫn sử dụng thuốc (thuoc.js) – chạy: node tests/tra_thuoc.test.js
//
// Bộ TÁCH TÊN không còn ở JavaScript nữa: nó nằm trong CSDL (hàm tach_thuoc, xem supabase/sql/thuoc.sql)
// và được bài kiểm_thu_thuoc() chạy mỗi đêm. Ở đây chỉ kiểm phần giao diện và các câu truy vấn.
const { kiem, ket } = require('./lib');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('- bỏ qua tra_thuoc: chưa cài playwright'); process.exit(0); }
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');

// Không được có bộ tách thứ hai trong Edge Function, nếu không hai bản sẽ lệch nhau
const edge = fs.readFileSync(path.join(root, 'supabase/functions/thuoc-dong-bo/index.ts'), 'utf8');
kiem(!/function tachTen/.test(edge) && !/const kd =/.test(edge),
  'Edge Function không tự tách tên (chỉ CSDL tách, tránh hai bản lệch nhau)');
kiem(/onConflict: 'drive_id'/.test(edge), 'quét lại là cập nhật theo drive_id, không tạo bản trùng');
kiem(/if \(!thieu\)/.test(edge), 'quét dở thì KHÔNG gỡ tệp khỏi danh mục (tránh xoá oan)');
kiem(/const HAN = 120_000/.test(edge) && /conKip\(\)/.test(edge), 'có một hạn chót tính từ lúc nhận yêu cầu');

const DS = [
  { drive_id: 'id1', ten: 'Kacerin', hoat_chat: 'Cetirizin dihydroclorid', ham_luong: '10mg', ten_tep: 'Kacerin (Cetirizin dihydroclorid 10mg).pdf', chu_cai: 'K', bv_dung: true,  kd: 'kacerin cetirizin dihydroclorid 10mg' },
  { drive_id: 'id2', ten: 'Kim tiền thảo', hoat_chat: null, ham_luong: null, ten_tep: 'Kim tiền thảo.pdf', chu_cai: 'K', bv_dung: false, kd: 'kim tien thao' },
  { drive_id: 'id3', ten: 'Amlodipin', hoat_chat: 'Amlodipin besilat', ham_luong: '5mg', ten_tep: 'Amlodipin (Amlodipin besilat 5mg).pdf', chu_cai: 'A', bv_dung: false, kd: 'amlodipin amlodipin besilat 5mg' },
];

const stub = (ds, quanTri) => `
window.ghi=[]; window.lastQ=null;
const DS=${JSON.stringify(ds)};
function q(t){
  const f={loc:[],dem:false};
  const api={
    select(c,o){ if(o&&o.head){f.dem=true} return api },
    order(){return api}, limit(n){f.gh=n;return api},
    ilike(c,v){f.loc.push(['ilike',c,v.replace(/%/g,'')]);return api},
    eq(c,v){f.loc.push(['eq',c,v]);return api},
    update(o){f.up=o;return api},
    then(res){
      if(f.dem) return res({count:DS.length,error:null});
      if(f.up){ window.ghi.push({up:f.up,loc:f.loc}); return res({error:null}) }
      let d=DS.slice();
      f.loc.forEach(([op,c,v])=>{
        if(op==='ilike')d=d.filter(r=>String(r[c]||'').includes(String(v)));
        if(op==='eq')d=d.filter(r=>r[c]===v);
      });
      window.lastQ={loc:f.loc,n:d.length};
      return res({data:d.slice(0,f.gh||999),error:null});
    }};
  return api;
}
window.BVAPP={sb:{from:q,functions:{invoke:()=>{window.daGoi=true;return Promise.resolve({data:{ok:true,da_ghi:267,da_xoa:0},error:null})}}},
  $:s=>document.querySelector(s),
  esc:s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  toast:m=>{window.lastToast=m},
  ban:(b,on=true)=>{if(b){b.disabled=!!on;on?b.setAttribute('aria-busy','true'):b.removeAttribute('aria-busy')}return b},
  me:{id:'u1',la_quan_tri:${quanTri},vai_tro:'${quanTri ? 'qt' : 'nv'}'}};
`;

async function mo(b, ds, quanTri) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setContent('<div id="app"><div id="nd"></div><div id="toast"></div></div>');
  await p.addScriptTag({ content: stub(ds, quanTri) });
  await p.addScriptTag({ path: path.join(root, 'thuoc.js') });
  await p.evaluate(() => window.TRATHUOC.ve());
  return { p, errs };
}

(async () => {
  const b = await chromium.launch();

  // ---- Người dùng thường ----
  {
    const { p, errs } = await mo(b, DS, false);
    await p.waitForSelector('#tq');
    kiem(/tờ hướng dẫn sử dụng thuốc/i.test(await p.textContent('#nd')), 'màn Thuốc mở được');
    kiem(/có <b>3<\/b> tờ hướng dẫn/.test(await p.innerHTML('#nd')), 'hiện đúng tổng số tờ trong danh mục');
    kiem(await p.$('#tlm') === null, 'người dùng thường không thấy nút Làm mới danh mục');

    // gõ KHÔNG DẤU phải ra thuốc có dấu
    await p.fill('#tq', 'kim tien thao'); await p.click('#tgo');
    await p.waitForFunction(() => document.querySelectorAll('#tkq .card').length >= 1, null, { timeout: 3000 });
    kiem(/Kim tiền thảo/.test(await p.textContent('#tkq')), 'gõ không dấu "kim tien thao" ra đúng Kim tiền thảo');
    const q1 = await p.evaluate(() => window.lastQ);
    kiem(q1.loc.some(x => x[0] === 'ilike' && x[1] === 'kd'), 'tìm bằng cột kd trên máy chủ, không tải cả bảng');
    kiem(q1.loc.every(x => !/[àáạảãăâèéẹêìíịòóọôơùúụưỳýỵđ]/.test(String(x[2]))), 'chuỗi tìm đã được bỏ dấu trước khi gửi');

    // tìm theo hoạt chất
    await p.fill('#tq', 'besilat'); await p.press('#tq', 'Enter');
    await p.waitForFunction(() => /Amlodipin/.test(document.querySelector('#tkq').textContent), null, { timeout: 3000 });
    kiem(true, 'tìm theo hoạt chất ra đúng biệt dược, Enter cũng tra được');
    const the = await p.innerHTML('#tkq');
    kiem(/Amlodipin besilat/.test(the) && /5mg/.test(the), 'thẻ hiện hoạt chất và hàm lượng');
    kiem(/href="https:\/\/drive\.google\.com\/file\/d\/id3\/view"/.test(the), 'liên kết mở thẳng tệp gốc trên Drive');
    kiem(/target="_blank" rel="noopener"/.test(the), 'mở tab mới an toàn (rel=noopener)');
    kiem(!/data-bv=/.test(the), 'người dùng thường không được đánh dấu BV đang dùng');

    // lọc chỉ thuốc BV đang dùng
    await p.fill('#tq', ''); await p.check('#tbv'); await p.click('#tgo');
    await p.waitForFunction(() => window.lastQ && window.lastQ.loc.some(x => x[0] === 'eq'), null, { timeout: 3000 });
    const q2 = await p.evaluate(() => window.lastQ);
    kiem(q2.loc.some(x => x[0] === 'eq' && x[1] === 'bv_dung' && x[2] === true), 'lọc "chỉ thuốc BV đang dùng" gửi đúng điều kiện');
    kiem(q2.n === 1, 'lọc còn đúng 1 thuốc BV đang dùng');

    kiem(errs.length === 0, 'không có lỗi JS (người dùng thường): ' + errs.join(' | '));
    await p.close();
  }

  // ---- Quản trị ----
  {
    const { p, errs } = await mo(b, DS, true);
    await p.waitForSelector('#tlm');
    kiem(true, 'quản trị thấy nút Làm mới danh mục');
    await p.fill('#tq', 'amlodipin'); await p.click('#tgo');
    await p.waitForSelector('[data-bv="id3"]');
    await p.click('[data-bv="id3"]'); await p.waitForTimeout(300);
    const g = await p.evaluate(() => window.ghi);
    kiem(g.length === 1 && g[0].up.bv_dung === true, 'đánh dấu BV đang dùng ghi bv_dung = true (không phải null)');
    kiem(g[0].loc.some(x => x[0] === 'eq' && x[1] === 'drive_id' && x[2] === 'id3'), 'chỉ sửa đúng một thuốc');
    kiem(errs.length === 0, 'không có lỗi JS (quản trị): ' + errs.join(' | '));
    await p.close();
  }

  // ---- Danh mục rỗng ----
  {
    const { p, errs } = await mo(b, [], true);
    await p.waitForSelector('#tlm');
    kiem(/chưa được nạp/.test(await p.textContent('#nd')), 'danh mục rỗng thì nói rõ chưa nạp và cách nạp');
    kiem(errs.length === 0, 'không có lỗi JS (danh mục rỗng): ' + errs.join(' | '));
    await p.close();
  }

  await b.close(); ket('tra_thuoc');
})();
