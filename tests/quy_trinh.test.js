// Kiểm thử quy trình theo bước: thanh bước, ghi xong từng bước, bỏ qua bước, xong hết thì báo hoàn thành
const { kiem, ket } = require('./lib');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('- bỏ qua quy_trinh: chưa cài playwright'); process.exit(0); }
const path = require('path'), root = path.join(__dirname, '..');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const errs = []; p.on('pageerror', e => { if (!/ServiceWorker|sw\.js/i.test(e.message)) errs.push(e.message); });
  await p.route('https://app.test/**', r => r.request().url() === 'https://app.test/' ? r.fulfill({ contentType: 'text/html', body: '<div id="app"><div id="nd"></div></div><nav></nav><div id="toast"></div>' }) : r.fulfill({ contentType: 'application/javascript', body: '' }));
  await p.goto('https://app.test/');
  await p.addScriptTag({ content: `
    window.BV={URL:'x',KEY:'y',VAPID:'z'};window.calls=[];
    const B=[{ten:'Lấy mẫu kỳ trước',goi_y:'Mở Drive chọn báo cáo kỳ trước',nut:'ai',xong:true,luc:'2026-11-10T02:00:00Z',boi:'u1'},
      {ten:'Thu thập hồ sơ căn cứ',goi_y:'Chọn thư mục hồ sơ kỳ này',nut:'ai',xong:true,luc:'2026-11-11T02:00:00Z',boi:'u1'},
      {ten:'Soạn báo cáo',goi_y:'AI điền số liệu vào mẫu',nut:'ai',xong:false},
      {ten:'Trình ký',goi_y:'In và trình lãnh đạo ký',nut:null,xong:false}];
    const T={viec:[{id:'v1',tieu_de:'Báo cáo ATBX 2026',mo_ta:'',nguoi_nhan:'u1',nguoi_giao:'u2',trang_thai:'dang_lam',han:'2026-12-20T10:00:00Z',cac_buoc:B}],
      cap_nhat_hien_trang:[],nguoi_dung:[{id:'u1',ho_ten:'Nhân Viên',auth_id:'a',vai_tro:'nv'}],danh_ba:[],loai_viec:[],loai_cong_viec:[]};
    const q=t=>{const st={};const p=new Proxy(function(){},{get(_,k){
      if(k==='then')return res=>{if(st.upd){window.calls.push(['update',t,st.upd]);Object.assign(T[t][0],st.upd);return res({data:null,error:null})}
        if(st.ins){window.calls.push(['insert',t,st.ins]);return res({data:null,error:null})}
        res({data:st.single?(T[t]||[])[0]:(T[t]||[]),error:null})};
      if(k==='single'||k==='maybeSingle')return()=>{st.single=true;return p};
      if(k==='update')return o=>{st.upd=o;return p};
      if(k==='insert')return o=>{st.ins=o;return p};
      return()=>p}});return p};
    window.supabase={createClient:()=>({from:q,rpc:async()=>({data:null}),channel:()=>q('x'),removeChannel(){},
      functions:{invoke:async()=>({data:{}})},
      auth:{getSession:async()=>({data:{session:{user:{id:'a'}}}}),signOut:async()=>{}},
      storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'about:blank'}}),upload:async()=>({error:null})})}})};` });
  await p.addScriptTag({ path: path.join(root, 'app.js') });
  await p.waitForFunction(() => window.BVAPP && window.BVAPP.me, null, { timeout: 5000 });
  await p.evaluate(() => window.BVAPP.chiTiet('v1'));
  await p.waitForSelector('.bsteps', { timeout: 5000 });
  if (process.env.SHOT) { await p.addStyleTag({ path: path.join(root, 'style.css') }); await p.waitForTimeout(300); await p.screenshot({ path: process.env.SHOT + '-pc.png' });
    await p.setViewportSize({ width: 400, height: 860 }); await p.waitForTimeout(200); await p.screenshot({ path: process.env.SHOT + '-dt.png', fullPage: true }); await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(200); }

  const bs = await p.$$eval('.bs', es => es.map(e => [e.className, e.querySelector('span').textContent]));
  kiem(bs.length === 4 && /xong/.test(bs[0][0]) && /xong/.test(bs[1][0]) && /dang/.test(bs[2][0]) && bs[3][0].trim() === 'bs', 'thanh bước: 2 bước đã xong, bước 3 đang làm, bước 4 chưa tới');
  const now = await p.textContent('.bnow');
  kiem(/Bước 3\/4/.test(now) && /Soạn báo cáo/.test(now) && /AI điền số liệu vào mẫu/.test(now), 'khối bước hiện tại nêu rõ bước mấy, tên bước và việc cần làm');
  kiem(await p.$('#bai') !== null && await p.$('#st') === null, 'bước có nút AI riêng; bỏ ô chọn trạng thái kiểu cũ');

  // bỏ qua mà không ghi lý do thì không cho
  await p.click('#bbo'); await p.waitForTimeout(150);
  kiem(/ghi lý do/i.test(await p.textContent('#toast')) && !(await p.evaluate(() => window.calls.some(c => c[0] === 'update'))), 'bỏ qua bước mà chưa ghi lý do thì app chặn lại');

  // xong bước 3
  await p.fill('#bgc', 'Đã soạn xong bản nháp');
  await p.click('#bxong'); await p.waitForTimeout(500);
  let c = await p.evaluate(() => window.calls);
  const up = c.find(x => x[0] === 'update' && x[1] === 'viec');
  kiem(up && up[2].cac_buoc[2].xong === true && up[2].cac_buoc[2].ghi === 'Đã soạn xong bản nháp' && up[2].cac_buoc[2].boi === 'u1' && up[2].cac_buoc[3].xong === false, 'ghi xong bước 3: lưu người ghi, thời điểm và ghi chú, không đụng bước 4');
  const ins = c.find(x => x[0] === 'insert' && x[1] === 'cap_nhat_hien_trang');
  kiem(ins && ins[2].buoc === 2 && /Xong bước 3\. Soạn báo cáo/.test(ins[2].ghi_chu) && !ins[2].trang_thai, 'dòng thời gian ghi đúng bước, chưa báo hoàn thành vì còn bước 4');

  // bước cuối -> báo hoàn thành
  await p.waitForSelector('.bnow', { timeout: 5000 });
  kiem(/Bước 4\/4/.test(await p.textContent('.bnow')), 'ghi xong thì tự nhảy sang bước kế tiếp');
  await p.evaluate(() => { window.calls = []; });
  await p.click('#bxong'); await p.waitForTimeout(500);
  c = await p.evaluate(() => window.calls);
  const ins2 = c.find(x => x[0] === 'insert' && x[1] === 'cap_nhat_hien_trang');
  kiem(ins2 && ins2[2].trang_thai === 'cho_xac_nhan', 'xong bước cuối thì tự báo hoàn thành, chờ người giao xác nhận');
  kiem(/Đã xong cả 4 bước/.test(await p.textContent('#nd')), 'xong hết thì hiện rõ đã qua đủ các bước');
  kiem(errs.length === 0, 'không có lỗi JS' + (errs.length ? ': ' + errs[0] : ''));
  if (process.env.SHOT) { await p.addStyleTag({ path: path.join(root, 'style.css') });
    await p.evaluate(() => { const v = window.BVAPP.sb.from('viec'); }); }
  await b.close(); ket('quy_trinh');
})();
