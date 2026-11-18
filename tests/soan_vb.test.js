// Kiểm thử: soạn tờ trình phải lấy KẾT QUẢ AI MỚI NHẤT làm số liệu, không lấy nội dung tệp gốc
const { kiem, ket } = require('./lib');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('- bỏ qua soan_vb: chưa cài playwright'); process.exit(0); }
const path = require('path'), root = path.join(__dirname, '..');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://app.test/**', r => r.request().url() === 'https://app.test/' ? r.fulfill({ contentType: 'text/html', body: '<div id="app"><div id="nd"></div></div><nav></nav><div id="toast"></div>' }) : r.fulfill({ contentType: 'application/javascript', body: '' }));
  await p.goto('https://app.test/');
  await p.addScriptTag({ content: `
    window.BV={URL:'x',KEY:'y',VAPID:'z'};window.calls=[];
    const T={viec:[{id:'v1',tieu_de:'Định mức tuyến đường',nguoi_giao:'u1',nguoi_nhan:'u1',trang_thai:'dang_lam'}],
      mau_van_ban:[{ma:'tt_giam_doc',ten:'Tờ trình gửi Giám đốc',loai:'to_trinh',mo_ta:'trình GĐ duyệt'},{ma:'qd_giam_doc',ten:'Quyết định của Giám đốc',loai:'quyet_dinh',mo_ta:'QĐ của GĐ'}],
      nguoi_dung:[{id:'u1',ho_ten:'Duy Linh',auth_id:'a',vai_tro:'tchc'}],danh_ba:[],loai_viec:[],loai_cong_viec:[]};
    const q=t=>{const st={};const p=new Proxy(function(){},{get(_,k){
      if(k==='then')return res=>res({data:st.single?(T[t]||[])[0]:(T[t]||[]),error:null});
      if(k==='single'||k==='maybeSingle')return()=>{st.single=true;return p};
      return()=>p}});return p};
    window.supabase={createClient:()=>({from:q,rpc:async()=>({data:true}),channel:()=>q('x'),removeChannel(){},
      functions:{invoke:async(n,o)=>{window.calls.push([n,o.body]);
        if(o.body.action==='goi_y')return{data:{ok:true,mau_ma:'tt_giam_doc',y_chinh:'Trình duyệt định mức mới'}};
        if(o.body.action==='soan')return{data:{ok:true,id:'vb1',ten:'To trinh.docx',url:'about:blank',mau:'Tờ trình',text:'noi dung'}};
        return{data:{}}}},
      auth:{getSession:async()=>({data:{session:{user:{id:'a'}}}}),signOut:async()=>{}},
      storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'about:blank'}})})}})};` });
  await p.addScriptTag({ path: path.join(root, 'app.js') });
  await p.waitForFunction(() => window.BVAPP && window.BVAPP.me, null, { timeout: 5000 });
  await p.evaluate(() => {
    const KQ = ['Bảng định mức lần 1: Tây Ninh 100 km, Hồng Hưng 100 km — bản nháp đầu tiên chưa tính lại',
      'BẢNG ĐỊNH MỨC CHỐT: 1 | Tây Ninh | 74 km. 2 | Hồng Hưng | 72 km. 3 | Mỹ Phước | 76 km — đây là số sau khi tính lại theo thực tế'];
    document.getElementById('nd').innerHTML = '<div id="sob"></div>';
    window.BVAPP.khungSoan(document.getElementById('sob'), document.getElementById('sob'), 'v1', 'v1/f.xlsx', KQ);
  });
  await p.waitForSelector('#vnguon', { timeout: 5000 });
  const opt = await p.$$eval('#vnguon option', os => os.map(o => [o.value, o.textContent, o.selected]));
  kiem(opt.length === 3 && opt[1][2] === true && /mới nhất/i.test(opt[1][1]), 'mặc định chọn kết quả AI mới nhất, không phải cái đầu tiên');
  kiem(/ĐỊNH MỨC CHỐT/.test(await p.textContent('#vnxem')), 'xem trước đúng nội dung kết quả mới nhất');
  let c = await p.evaluate(() => window.calls);
  kiem(c[0][1].action === 'goi_y' && /ĐỊNH MỨC CHỐT/.test(c[0][1].ket_qua_ai) && !/lần 1/.test(c[0][1].ket_qua_ai), 'gợi ý loại văn bản cũng dùng kết quả mới nhất');

  await p.waitForFunction(() => document.querySelector('.vck:checked'), null, { timeout: 5000 });
  await p.evaluate(() => { window.calls = []; });
  await p.click('#vsoan'); await p.waitForTimeout(400);
  c = await p.evaluate(() => window.calls.filter(x => x[1].action === 'soan'));
  kiem(c.length === 1 && /ĐỊNH MỨC CHỐT/.test(c[0][1].ket_qua_ai) && c[0][1].file_path === 'v1/f.xlsx', 'bấm soạn: gửi kèm số liệu chốt mới nhất và cả tệp gốc');

  // chọn bản cũ hơn
  await p.selectOption('#vnguon', '0'); await p.evaluate(() => { window.calls = []; });
  await p.click('#vsoan'); await p.waitForTimeout(400);
  c = await p.evaluate(() => window.calls.filter(x => x[1].action === 'soan'));
  kiem(c.length === 1 && /lần 1/.test(c[0][1].ket_qua_ai), 'đổi sang kết quả AI lần trước thì gửi đúng bản đó');
  // chỉ dùng tệp gốc
  await p.selectOption('#vnguon', '-1'); await p.evaluate(() => { window.calls = []; });
  await p.click('#vsoan'); await p.waitForTimeout(400);
  c = await p.evaluate(() => window.calls.filter(x => x[1].action === 'soan'));
  kiem(c.length === 1 && !c[0][1].ket_qua_ai, 'chọn "chỉ dùng tệp gốc" thì không gửi kết quả AI');
  kiem(errs.length === 0, 'không có lỗi JS' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); ket('soan_vb');
})();
