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
        if(o.body.action==='goi_y'){await new Promise(r=>setTimeout(r,600));return{data:{ok:true,mau_ma:'tt_giam_doc',y_chinh:'Trình duyệt định mức mới'}}}
        if(o.body.action==='soan')return{data:{ok:true,id:'vb1',ten:'To trinh.docx',url:'about:blank',mau:'Tờ trình',text:'noi dung',phu_luc:{id:'vb2',ten:'Phu luc - dinh muc.docx',url:'about:blank',text:'PHỤ LỤC'}}};
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
  await p.waitForSelector('#vsoan', { timeout: 5000 });
  kiem(await p.$('#vnguon') === null, 'không thêm ô chọn nguồn số liệu cho rối, cứ lấy kết quả AI cuối cùng');
  let c = await p.evaluate(() => window.calls);
  kiem(c[0][1].action === 'goi_y' && /ĐỊNH MỨC CHỐT/.test(c[0][1].ket_qua_ai) && !/lần 1/.test(c[0][1].ket_qua_ai), 'gợi ý loại văn bản dùng kết quả AI cuối cùng');

  // Người dùng bấm chọn NGAY, gợi ý của AI về sau không được đè lên lựa chọn đó
  await p.evaluate(() => { const qd = document.querySelector('.vck[value="qd_giam_doc"]'); qd.checked = true; qd.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(900);
  kiem(await p.$eval('.vck:checked', e => e.value) === 'qd_giam_doc', 'người dùng chọn loại văn bản rồi thì gợi ý AI tới sau không đổi lựa chọn đó');
  await p.evaluate(() => { const x = document.querySelector('.vck[value="tt_giam_doc"]'); x.checked = true; x.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.evaluate(() => { window.calls = []; });
  await p.click('#vsoan'); await p.waitForTimeout(400);
  c = await p.evaluate(() => window.calls.filter(x => x[1].action === 'soan'));
  kiem(c.length === 1 && /ĐỊNH MỨC CHỐT/.test(c[0][1].ket_qua_ai) && c[0][1].file_path === 'v1/f.xlsx', 'bấm soạn: gửi kèm số liệu chốt mới nhất và cả tệp gốc');

  const ten = await p.$$eval('#vkq .ait', e => e.map(x => x.textContent));
  kiem(ten.length === 2 && /Phu luc/.test(ten.join('|')), 'phụ lục ra file Word riêng, hiện thành văn bản thứ 2 để tải và lưu');
  kiem(await p.$eval('#vtai', e => !e.disabled) && /2 văn bản/.test(await p.$eval('#vluu', e => e.textContent)), 'lưu và tải được cả văn bản chính lẫn phụ lục');

  kiem(errs.length === 0, 'không có lỗi JS' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); ket('soan_vb');
})();
