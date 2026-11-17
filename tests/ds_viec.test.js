// Kiểm thử danh sách việc: màn Việc chỉ hiện 3 ngày, màn Giao chỉ hiện 1 tháng, và list theo hạn cả năm
const { kiem, ket } = require('./lib');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('- bỏ qua ds_viec: chưa cài playwright'); process.exit(0); }
const path = require('path'), root = path.join(__dirname, '..');
const ngay = d => new Date(Date.now() + d * 864e5).toISOString();
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 400, height: 800 } });
  const errs = []; p.on('pageerror', e => { if (!/ServiceWorker|sw\.js/i.test(e.message)) errs.push(e.message); });
  await p.route('https://app.test/**', r => r.request().url() === 'https://app.test/' ? r.fulfill({ contentType: 'text/html', body: '<div id="app"><div id="nd"></div></div><nav><button data-t="toi"></button><button data-t="giao"></button></nav><div id="toast"></div>' }) : r.fulfill({ status: 404, body: '' }));
  await p.goto('https://app.test/');
  await p.addScriptTag({ content: `
    window.BV={URL:'x',KEY:'y',VAPID:'z'};
    const V=[
      {id:'a',tieu_de:'Quá hạn rồi',han:${JSON.stringify(ngay(-2))},trang_thai:'dang_lam',nguoi_nhan:'u1',nguoi_giao:'u2'},
      {id:'b',tieu_de:'Hạn ngày mai',han:${JSON.stringify(ngay(1))},trang_thai:'moi',nguoi_nhan:'u1',nguoi_giao:'u2'},
      {id:'c',tieu_de:'Hạn 10 ngày nữa',han:${JSON.stringify(ngay(10))},trang_thai:'moi',nguoi_nhan:'u1',nguoi_giao:'u2'},
      {id:'d',tieu_de:'Hạn 40 ngày nữa',han:${JSON.stringify(ngay(40))},trang_thai:'moi',nguoi_nhan:'u1',nguoi_giao:'u2'},
      {id:'f',tieu_de:'Việc đã xong',han:${JSON.stringify(ngay(-20))},trang_thai:'da_dong',nguoi_nhan:'u1',nguoi_giao:'u2'},
      {id:'e',tieu_de:'Việc chưa có hạn',han:null,tao_luc:${JSON.stringify(ngay(-1))},trang_thai:'moi',nguoi_nhan:'u1',nguoi_giao:'u2'}];
    const T={viec:V,nguoi_dung:[{id:'u1',ho_ten:'Nhân Viên',auth_id:'a',vai_tro:'nv'},{id:'u2',ho_ten:'Sếp'}],danh_ba:[],khoa_phong:[]};
    const q=t=>{const st={};const p=new Proxy(function(){},{get(_,k){
      if(k==='then')return res=>res({data:st.single?(T[t]||[])[0]:(T[t]||[]),error:null});
      if(k==='single'||k==='maybeSingle')return()=>{st.single=true;return p};
      return()=>p}});return p};
    window.supabase={createClient:()=>({from:q,rpc:async()=>({data:null}),channel:()=>q('x'),removeChannel(){},
      functions:{invoke:async()=>({data:{}})},
      auth:{getSession:async()=>({data:{session:{user:{id:'a'}}}}),signOut:async()=>{}},
      storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'about:blank'}})})}})};` });
  await p.addScriptTag({ path: path.join(root, 'app.js') });
  await p.waitForFunction(() => window.BVAPP && window.BVAPP.me, null, { timeout: 5000 });

  await p.evaluate(() => window.BVAPP.veTab('toi'));
  await p.waitForSelector('.tb tbody tr', { timeout: 5000 });
  let trai = await p.textContent('.hai>div'), phai = await p.textContent('#bnam');
  kiem(/Quá hạn rồi/.test(trai) && /Hạn ngày mai/.test(trai) && /Việc chưa có hạn/.test(trai), 'màn Việc: hiện việc quá hạn, tới hạn trong 3 ngày và việc chưa có hạn');
  kiem(!/Hạn 10 ngày nữa/.test(trai) && !/Hạn 40 ngày nữa/.test(trai), 'màn Việc: giấu việc có hạn xa hơn 3 ngày');
  kiem(/Còn .?2.? việc có hạn xa hơn/.test(trai.replace(/\s+/g, ' ')), 'màn Việc: báo rõ còn bao nhiêu việc hạn xa hơn');
  const cot = await p.$$eval('.tb thead th', ts => ts.map(x => x.textContent));
  kiem(cot.join('|') === 'STT|Nội dung|Đến hạn|Tình trạng', 'bảng năm đủ 4 cột STT, Nội dung, Đến hạn, Tình trạng');
  let hang = await p.$$eval('.tb tbody tr', rs => rs.map(r => [...r.children].map(c => c.textContent)));
  kiem(hang.length === 6 && hang[0][0] === '1' && hang[5][0] === '6', 'bảng năm liệt kê đủ 6 việc trong năm, có đánh số thứ tự');
  kiem(hang.some(r => /Hạn 40 ngày nữa/.test(r[1])) && hang.some(r => /Việc đã xong/.test(r[1]) && /Đã đóng/.test(r[3])), 'bảng năm có cả việc hạn xa và việc đã đóng kèm tình trạng');
  kiem(hang.some(r => /chưa có/.test(r[2])), 'việc không có hạn ghi rõ "chưa có" ở cột Đến hạn');
  kiem(!/chưa có việc nào/.test(phai), 'không liệt kê các tháng trống');
  kiem(await p.$('#dshan') === null, 'bỏ nút phải bấm mới xem được danh sách');

  await p.evaluate(() => window.BVAPP.veTab('giao'));
  await p.waitForSelector('.tb tbody tr', { timeout: 5000 });
  trai = await p.textContent('.hai>div');
  kiem(/Hạn 10 ngày nữa/.test(trai) && !/Hạn 40 ngày nữa/.test(trai), 'màn Giao: hiện việc trong 1 tháng, giấu việc xa hơn');
  hang = await p.$$eval('.tb tbody tr', rs => rs.length);
  kiem(hang === 6, 'màn Giao cũng có bảng cả năm bên cạnh');
  await p.click('.tb tbody tr'); await p.waitForTimeout(200);
  kiem(await p.$('.tb') === null, 'bấm một dòng trong bảng thì mở chi tiết việc');
  kiem(errs.length === 0, 'không có lỗi JS' + (errs.length ? ': ' + errs[0] : ''));
  if (process.env.SHOT) { await p.addStyleTag({ path: path.join(root, 'style.css') });
    await p.evaluate(() => window.BVAPP.veTab('toi')); await p.waitForSelector('.tb tbody tr'); await p.screenshot({ path: process.env.SHOT + '-dt.png', fullPage: true });
    await p.setViewportSize({ width: 1180, height: 820 }); await p.evaluate(() => window.BVAPP.veTab('toi')); await p.waitForSelector('.tb tbody tr'); await p.screenshot({ path: process.env.SHOT + '-pc.png', fullPage: true }); }
  await b.close(); ket('ds_viec');
})();
