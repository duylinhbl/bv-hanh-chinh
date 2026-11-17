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
      {id:'d',tieu_de:'Hạn 60 ngày nữa',han:${JSON.stringify(ngay(60))},trang_thai:'moi',nguoi_nhan:'u1',nguoi_giao:'u2'},
      {id:'e',tieu_de:'Việc chưa có hạn',han:null,trang_thai:'moi',nguoi_nhan:'u1',nguoi_giao:'u2'}];
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
  await p.waitForSelector('#dshan', { timeout: 5000 });
  let t = await p.textContent('#nd');
  kiem(/Quá hạn rồi/.test(t) && /Hạn ngày mai/.test(t) && /Việc chưa có hạn/.test(t), 'màn Việc: hiện việc quá hạn, việc tới hạn trong 3 ngày và việc chưa có hạn');
  kiem(!/Hạn 10 ngày nữa/.test(t) && !/Hạn 60 ngày nữa/.test(t), 'màn Việc: giấu việc có hạn xa hơn 3 ngày');
  kiem(/Còn .?2.? việc có hạn xa hơn/.test(t.replace(/\s+/g, ' ')), 'màn Việc: báo rõ còn bao nhiêu việc hạn xa hơn');

  await p.evaluate(() => window.BVAPP.veTab('giao'));
  await p.waitForSelector('#dshan', { timeout: 5000 });
  t = await p.textContent('#nd');
  kiem(/Hạn 10 ngày nữa/.test(t) && !/Hạn 60 ngày nữa/.test(t), 'màn Giao: hiện việc trong 1 tháng, giấu việc xa hơn');

  await p.click('#dshan');
  await p.waitForSelector('.dsr', { timeout: 5000 });
  t = await p.textContent('#nd');
  const thisY = new Date().getFullYear();
  kiem(/Tháng 1\//.test(t) && /Tháng 12\//.test(t), 'list theo hạn: hiện đủ 12 tháng để soát việc cả năm');
  kiem(/chưa có việc nào/.test(t), 'list theo hạn: tháng trống ghi rõ "chưa có việc nào"');
  kiem(/1 việc chưa có hạn/.test(t), 'list theo hạn: tách riêng việc chưa có hạn');
  const m = new Date(Date.now() + 60 * 864e5);
  if (m.getFullYear() === thisY) kiem(/Hạn 60 ngày nữa/.test(t), 'list theo hạn: việc hạn xa vẫn thấy trong tháng của nó');
  else kiem(true, 'việc hạn 60 ngày rơi sang năm sau, bỏ qua');
  await p.click('.dsr'); await p.waitForTimeout(200);
  kiem(!/Tháng 12\//.test(await p.textContent('#nd')), 'bấm một dòng thì mở chi tiết việc');
  kiem(errs.length === 0, 'không có lỗi JS' + (errs.length ? ': ' + errs[0] : ''));
  if (process.env.SHOT) { await p.addStyleTag({ path: path.join(root, 'style.css') });
    await p.evaluate(() => window.BVAPP.veTab('toi')); await p.waitForSelector('#dshan'); await p.screenshot({ path: process.env.SHOT + '-toi.png', fullPage: true });
    await p.click('#dshan'); await p.waitForSelector('.dsr'); await p.screenshot({ path: process.env.SHOT + '-list.png', fullPage: true }); }
  await b.close(); ket('ds_viec');
})();
