// Kiểm thử màn Tra cứu thuốc bệnh viện (thuoc.js) – chạy: node tests/tra_thuoc.test.js
//
// Phần dữ liệu (toàn vẹn mã ICD, truy được ai gắn) do kiem_thu_thuoc() trong CSDL lo, chạy mỗi đêm.
// Ở đây kiểm giao diện và các câu truy vấn gửi lên máy chủ.
const { kiem, ket } = require('./lib');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('- bỏ qua tra_thuoc: chưa cài playwright'); process.exit(0); }
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');

const src = fs.readFileSync(path.join(root, 'thuoc.js'), 'utf8');
kiem(!/suy ra mã|tự sinh mã ICD/i.test(src.replace(/KHÔNG tự sinh|không tự suy ra/gi, '')),
  'mã ICD không do app sinh ra');
kiem(/nguoi_gan:\s*A\(\)\.me\.id|nguoi_gan:A\(\)\.me\.id/.test(src.replace(/\s/g, m => m)) || /nguoi_gan:A\(\)\.me\.id/.test(src.replace(/\s+/g, '')),
  'mỗi mã gắn vào đều ghi người gắn');

const THUOC = [
  { id: 1, ma_bc: 'CSDT_00015', ma_atc: 'N02AA01', ma_byt: null, ten: 'Morphin', hoat_chat: 'Morphin', ham_luong: '10mg/1ml', dvt: 'Ống', don_gia: 7000, don_gia_min: 7000, nhom: 'THUỐC GÂY NGHIỆN', atc_nhom: 'Hệ thần kinh', hoat_dong: true, kd: 'morphin morphin 10mg/1ml n02aa01 csdt_00015' },
  { id: 2, ma_bc: 'CSDT_00169', ma_atc: 'C05CA03', ma_byt: '40.735', ten: 'ISAIAS', hoat_chat: 'Diosmin', ham_luong: '600mg', dvt: 'Viên', don_gia: 4990, don_gia_min: 4990, nhom: 'THUỐC TÂN DƯỢC', atc_nhom: 'Tim mạch', hoat_dong: true, kd: 'isaias diosmin 600mg c05ca03 csdt_00169' },
  { id: 3, ma_bc: 'VIT004', ma_atc: null, ma_byt: null, ten: 'VITAMIN C STELLA 1G', hoat_chat: 'Vitamin C', ham_luong: '1g', dvt: 'Tube', don_gia: 12000, don_gia_min: 9000, nhom: 'THUỐC TÂN DƯỢC', atc_nhom: null, hoat_dong: true, kd: 'vitamin c stella 1g vitamin c 1g vit004' },
];
const GAN = [
  { id: 11, ma_icd: 'K59.1', chi_dinh: 'Tiêu chảy chức năng', nguon: 'khoa Dược', gan_luc: '2026-11-26T03:00:00Z', duyet: false, nguoi_gan: { ho_ten: 'DS. Hoa' }, nguoi_duyet: null },
];

const stub = (quyen, gan, icdCount) => `
window.ghi=[]; window.xoa=[]; window.lastQ=null;
const THUOC=${JSON.stringify(THUOC)}, GAN=${JSON.stringify(gan)}, ICDN=${icdCount};
const ICD=[{ma:'K59.1',ten:'Tiêu chảy chức năng',kd:'tieu chay chuc nang'},{ma:'K59.2',ten:'Hội chứng ruột kích thích',kd:'hoi chung ruot kich thich'}];
function q(t){
  const f={loc:[],t};
  const api={
    select(c,o){ if(o&&o.head)f.dem=true; return api },
    order(){return api}, limit(n){f.gh=n;return api},
    ilike(c,v){f.loc.push(['ilike',c,v.replace(/%/g,'')]);return api},
    or(s){f.loc.push(['or',s]);return api},
    eq(c,v){f.loc.push(['eq',c,v]);return api},
    in(c,v){f.loc.push(['in',c,v]);return api},
    insert(o){window.ghi.push(o);return Promise.resolve({error:null})},
    delete(){f.xoa=true;return api},
    maybeSingle(){f.mot=true;return api},
    then(res){
      if(f.t==='icd10'&&f.dem) return res({count:ICDN,error:null});
      if(f.t==='dm_thuoc'&&f.dem) return res({count:THUOC.length,error:null});
      if(f.xoa){window.xoa.push(f.loc);return res({error:null})}
      if(f.t==='thuoc_icd') return res({data:GAN,error:null});
      if(f.t==='icd10'){
        const or=(f.loc.find(x=>x[0]==='or')||[])[1]||'';
        const m=/kd\\.ilike\\.%([^%]*)%/.exec(or); const k=m?m[1]:'';
        return res({data:ICD.filter(x=>!k||x.kd.includes(k)),error:null});
      }
      let d=THUOC.slice();
      f.loc.forEach(([op,c,v])=>{
        if(op==='ilike')d=d.filter(r=>String(r[c]||'').includes(String(v)));
        if(op==='eq')d=d.filter(r=>String(r[c])===String(v));
      });
      window.lastQ={loc:f.loc,n:d.length};
      return res(f.mot?{data:d[0]||null,error:null}:{data:d.slice(0,f.gh||999),error:null});
    }};
  return api;
}
window.BVAPP={sb:{from:q,rpc:()=>Promise.resolve({data:${quyen},error:null})},
  $:s=>document.querySelector(s),
  esc:s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  toast:m=>{window.lastToast=m},
  ban:(b,on=true)=>{if(b){b.disabled=!!on;on?b.setAttribute('aria-busy','true'):b.removeAttribute('aria-busy')}return b},
  me:{id:'u1',ho_ten:'DS. Hoa',la_quan_tri:${quyen}}};
`;

async function mo(b, quyen, gan = GAN, icdCount = 2) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setContent('<div id="app"><div id="nd"></div><div id="toast"></div></div>');
  await p.addScriptTag({ content: stub(quyen, gan, icdCount) });
  await p.addScriptTag({ path: path.join(root, 'thuoc.js') });
  await p.evaluate(() => window.TRATHUOC.ve());
  return { p, errs };
}

(async () => {
  const b = await chromium.launch();

  // ---- Bác sĩ / điều dưỡng (không có quyền gắn mã) ----
  {
    const { p, errs } = await mo(b, false);
    await p.waitForSelector('#tq');
    kiem(/Tra cứu thuốc bệnh viện/.test(await p.textContent('#nd')), 'màn Thuốc mở được');
    kiem(/<b>3<\/b> thuốc/.test(await p.innerHTML('#nd')), 'hiện đúng số thuốc trong danh mục');

    await p.waitForSelector('#tkq .card.v');
    kiem((await p.$$('#tkq .card.v')).length === 3, 'mở màn là thấy ngay danh sách, không phải gõ mới có');

    // tìm không dấu + theo hoạt chất
    await p.fill('#tq', 'diosmin'); await p.press('#tq', 'Enter');
    await p.waitForFunction(() => document.querySelectorAll('#tkq .card.v').length === 1, null, { timeout: 3000 });
    kiem(/ISAIAS/.test(await p.textContent('#tkq')), 'tìm theo hoạt chất ra đúng biệt dược');
    const q1 = await p.evaluate(() => window.lastQ);
    kiem(q1.loc.some(x => x[0] === 'ilike' && x[1] === 'kd'), 'tìm bằng cột kd trên máy chủ');
    kiem(q1.loc.some(x => x[0] === 'eq' && x[1] === 'hoat_dong' && x[2] === true), 'chỉ tra thuốc còn hiệu lực');

    // lọc nhóm
    await p.fill('#tq', ''); await p.selectOption('#tnhom', 'THUỐC GÂY NGHIỆN');
    await p.waitForFunction(() => window.lastQ && window.lastQ.loc.some(x => x[1] === 'nhom'), null, { timeout: 3000 });
    kiem(true, 'lọc theo nhóm thuốc gửi đúng điều kiện');

    // chi tiết thuốc gây nghiện
    await p.click('#tkq .card.v'); await p.waitForSelector('#tve');
    const ct = await p.innerHTML('#nd');
    kiem(/Morphin/.test(ct), 'mở được chi tiết thuốc');
    kiem(/class="xacnhan"/.test(ct) && /gây nghiện/i.test(ct), 'thuốc gây nghiện có cảnh báo quy chế riêng');
    kiem(/N02AA01/.test(ct) && /Hệ thần kinh/.test(ct), 'hiện mã ATC và nhóm dược lý');
    kiem(/7\.000 đ/.test(ct), 'hiện đơn giá theo định dạng Việt Nam');
    kiem(/Mã thanh toán bảo hiểm ICD-10/.test(ct), 'có bảng mã thanh toán bảo hiểm ICD-10');
    kiem(/K59\.1/.test(ct) && /Tiêu chảy chức năng/.test(ct), 'bảng hiện mã và chỉ định');
    kiem(/DS\. Hoa/.test(ct) && /26\/11\/2026/.test(ct), 'mỗi mã ghi rõ ai gắn và ngày nào');
    kiem(/Không thay thế chỉ định của bác sĩ điều trị/.test(ct), 'nói rõ chỉ để tham khảo');
    kiem(!/id="tgan"/.test(ct), 'người không có quyền thì không thấy nút gắn mã');
    kiem(!/data-go=/.test(ct), 'người không có quyền thì không gỡ được mã');

    await p.click('#tve'); await p.waitForSelector('#tq');
    kiem(true, 'nút Về danh sách quay lại được');
    kiem(errs.length === 0, 'không có lỗi JS (bác sĩ): ' + errs.join(' | '));
    await p.close();
  }

  // ---- Khoa Dược (có quyền gắn mã) ----
  {
    const { p, errs } = await mo(b, true);
    await p.waitForSelector('#tkq .card.v');
    await p.click('#tkq .card.v'); await p.waitForSelector('#tgan');
    kiem(true, 'khoa Dược thấy nút Gắn mã ICD-10');
    await p.click('#tgan'); await p.waitForSelector('#tim');
    kiem(await p.isDisabled('#tluu'), 'chưa chọn mã thì không lưu được');

    await p.fill('#tim', 'tieu chay');
    await p.waitForSelector('[data-ma="K59.1"]', { timeout: 3000 });
    kiem(true, 'gõ tên bệnh không dấu ra gợi ý mã từ danh mục chuẩn');
    await p.click('[data-ma="K59.1"]');
    kiem(!(await p.isDisabled('#tluu')), 'chọn mã xong mới bật nút Lưu');
    await p.click('#tluu'); await p.waitForTimeout(300);
    const g = await p.evaluate(() => window.ghi);
    kiem(g.length === 1 && g[0].ma_icd === 'K59.1', 'lưu đúng mã đã chọn');
    kiem(g[0].nguoi_gan === 'u1', 'lưu kèm người gắn');
    kiem(g[0].chi_dinh === 'Tiêu chảy chức năng', 'để trống chỉ định thì lấy tên bệnh chuẩn');
    kiem(errs.length === 0, 'không có lỗi JS (khoa Dược): ' + errs.join(' | '));
    await p.close();
  }

  // ---- Chưa nạp danh mục ICD-10 ----
  {
    const { p, errs } = await mo(b, true, [], 0);
    await p.waitForSelector('#tkq .card.v');
    await p.click('#tkq .card.v'); await p.waitForSelector('#tgan');
    kiem(/Chưa gắn mã nào/.test(await p.textContent('#nd')), 'thuốc chưa có mã thì nói rõ, không bịa');
    await p.click('#tgan'); await p.waitForSelector('#tform .card');
    kiem(/Chưa nạp danh mục mã ICD-10/.test(await p.textContent('#tform')), 'chưa có danh mục chuẩn thì chặn gắn tay');
    kiem(await p.$('#tim') === null, 'không cho gõ mã tự do khi chưa có danh mục chuẩn');
    kiem(errs.length === 0, 'không có lỗi JS (chưa nạp ICD): ' + errs.join(' | '));
    await p.close();
  }

  await b.close(); ket('tra_thuoc');
})();
