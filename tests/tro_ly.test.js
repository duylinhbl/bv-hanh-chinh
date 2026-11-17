// Kiểm thử màn "Làm việc này cùng AI" (trợ lý việc) với máy chủ giả – chạy: node tests/tro_ly.test.js (cần playwright)
const { kiem, ket } = require('./lib');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('- bỏ qua tro_ly: chưa cài playwright'); process.exit(0); }
const path = require('path'), root = path.join(__dirname, '..');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 400, height: 800 } });
  const errs = []; p.on('pageerror', e => { if (!/ServiceWorker|sw\.js/i.test(e.message)) errs.push(e.message); });
  await p.route('https://app.test/**', r => r.request().url() === 'https://app.test/' ? r.fulfill({ contentType: 'text/html', body: '<div id="app"><div id="nd"></div></div><div id="toast"></div>' }) : r.fulfill({ status: 404, body: '' }));
  await p.goto('https://app.test/');
  await p.addScriptTag({ content: `
    window.calls=[];window.BV={URL:'x',KEY:'y',VAPID:'z'};
    const T={viec:[{id:'v1',tieu_de:'Báo cáo ATBX 2026',mo_ta:'',file_path:'v1/a-f.docx',file_ten:'cv de nghi.docx',nguoi_nhan:'u1',nguoi_giao:'u2',trang_thai:'dang_lam',loai_viec_id:null}],
      loai_viec:[{id:1,nhom:'11. An toàn bức xạ',ten:'Báo cáo ATBX hằng năm',thu_muc_goc:'ROOTROOTROOTROOT1',hoat_dong:true},{id:2,nhom:'15. KSK',ten:'Báo cáo KSK',thu_muc_goc:null,hoat_dong:true}],
      cap_nhat_hien_trang:[],nguoi_dung:[{id:'u1',ho_ten:'Nhân viên',auth_id:'a',vai_tro:'nv'}],danh_ba:[]};
    const q=t=>{const st={};const p=new Proxy(function(){}, {get(_,k){
      if(k==='then')return res=>{if(st.del){window.calls.push(['delete',t]);return res({data:window.xoaDuoc?[{id:'x'}]:[],error:null})}
        if(st.upd){Object.assign(T[t][0],st.upd);window.calls.push(['update',t,st.upd]);return res({data:null,error:null})}
        if(st.ins){window.calls.push(['insert',t,st.ins]);return res({data:null,error:null})}
        res({data:st.single?(T[t]||[])[0]:(T[t]||[]),error:null})};
      if(k==='single'||k==='maybeSingle')return()=>{st.single=true;return p};
      if(k==='update')return o=>{st.upd=o;return p};
      if(k==='delete')return()=>{st.del=true;return p};
      if(k==='insert')return o=>{st.ins=o;return p};
      return()=>p}});return p};
    const fn=async(n,o)=>{const a=o.body;window.calls.push([n,a]);
      if(a.action==='goi_y_loai')return {data:{ok:true,goi_y:[{id:1,ly_do:'Văn bản nhắc báo cáo an toàn bức xạ'}]}};
      if(a.action==='duyet')return {data:{ok:true,id:a.folder_id||'ROOTROOTROOTROOT1',ten:a.folder_id?'2026':'11.HỒ SƠ ATBX',la_goc:!a.folder_id,thu_muc:a.folder_id?[]:[{id:'F2026F2026F2026F2',ten:'2026'}],files:[{id:'MAUMAUMAUMAUMAU1',ten:'Báo cáo ATBX 2025.docx'},{id:'PDFPDFPDFPDFPDF1',ten:'Giấy phép.pdf'}]}};
      if(a.action==='quet')return {data:{ok:true,can_doc:2,tong:2,ten_thu_muc:'2026'}};
      if(a.action==='doc')return {data:{ok:true,da_doc:2,con_lai:0}};
      if(a.action==='soan_bc')return {data:{ok:true,url:'data:application/octet-stream;base64,UEsDBA==',ten:'Báo cáo ATBX 2026.docx',mau:'Báo cáo ATBX 2025.docx',tom_tat:'Đã cập nhật năm và giấy phép.',so_ho_so:2,khong_doc:0,thieu:['Thiếu biên bản kiểm xạ 2026'],chan:[{p:9,cu:'số 325.02 ngày 22/08/2026',moi:'số 281.01 ngày 21/08/2025',ly_do:'mẫu đang ghi ngày 22/08/2026, hồ sơ chỉ có ngày 21/08/2025 (cũ hơn)'}],khong_doc_ds:[{ten:'Biên bản kiểm xạ.pdf',ly_do:'File 11 MB'}],
        thay:[{p:1,cu:'năm 2025',moi:'năm 2026',chac:true,ok:true,can_cu:'yêu cầu'},{p:2,cu:'12/GP',moi:'45/GP',chac:false,ok:true,can_cu:'[H1]'},{p:3,cu:'abc',moi:'xyz',chac:true,ok:false}]}};
      return {data:{}}};
    window.supabase={createClient:()=>({from:q,channel:()=>q('x'),removeChannel(){},rpc:async()=>({data:false}),functions:{invoke:fn},
      auth:{getSession:async()=>({data:{session:{user:{id:'a'}}}}),signOut:async()=>{}},
      storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'about:blank'}}),upload:async(pa)=>{window.calls.push(['upload',pa]);return {error:null}}})}})};` });
  await p.addScriptTag({ path: path.join(root, 'app.js') });
  await p.waitForFunction(() => window.BVAPP && window.BVAPP.me, null, { timeout: 5000 });
  await p.evaluate(() => { window.BVAPP.troLy('v1'); });
  await p.waitForSelector('.tlgy', { timeout: 5000 });
  kiem(/cv de nghi\.docx/.test(await p.textContent('#tlA')), 'bước ① hiện văn bản kèm việc');
  kiem(/an toàn bức xạ/i.test(await p.textContent('.tlgy')), 'bước ② AI gợi ý loại việc kèm lý do');
  await p.click('.tlgy'); await p.waitForSelector('#tlcc', { timeout: 5000 });
  let c = await p.evaluate(() => window.calls);
  kiem(c.some(x => x[0] === 'update' && x[2].loai_viec_id === 1), 'chọn loại việc được lưu vào việc');
  kiem(await p.isDisabled('#tlsoan'), 'chưa chọn mẫu thì nút soạn bị khóa');
  kiem(/2026/.test(await p.textContent('#tlB')) && /Dùng làm mẫu/.test(await p.textContent('#tlB')), 'bước ③ hiện Drive: thư mục con và file Word có nút "Dùng làm mẫu"');
  kiem((await p.$$('#tlB [data-mau]')).length === 1, 'file PDF không được chọn làm mẫu');
  await p.click('.tlf[data-di]'); await p.waitForFunction(() => /11\./.test(document.querySelector('.tlbc').textContent) && /2026/.test(document.querySelector('.tlbc b').textContent));
  kiem(true, 'vào thư mục con, có đường dẫn để quay lại');
  await p.click('#tlcc'); await p.waitForFunction(() => /Đang dùng/.test(document.querySelector('#tlcc').textContent));
  await p.click('[data-mau]'); await p.waitForFunction(() => !document.querySelector('#tlsoan').disabled);
  c = await p.evaluate(() => window.calls);
  kiem(c.some(x => x[0] === 'update' && x[2].thu_muc_dc === 'F2026F2026F2026F2') && c.some(x => x[0] === 'update' && x[2].mau_file_id === 'MAUMAUMAUMAUMAU1'), 'thư mục căn cứ và file mẫu được lưu');
  await p.click('#tlsoan'); await p.waitForSelector('#tlluu', { timeout: 5000 });
  const kq = await p.textContent('#tlkq');
  kiem(/Báo cáo ATBX 2026\.docx/.test(kq) && /Thiếu biên bản kiểm xạ/.test(kq) && /Cần kiểm/.test(kq) && /chưa thay được/.test(kq) && /GIỮ NGUYÊN theo mẫu/.test(kq) && /325\.02/.test(kq) && /chưa đọc được/.test(kq), 'bước ④ hiện kết quả: chỗ đã thay, chỗ cần kiểm, chỗ thiếu căn cứ, chỗ không thay được');
  c = await p.evaluate(() => window.calls);
  kiem(c.filter(x => x[1] && x[1].action === 'quet').length === 1 && c.some(x => x[1] && x[1].action === 'soan_bc' && x[1].mau_file_id === 'MAUMAUMAUMAUMAU1' && x[1].file_path === 'v1/a-f.docx'), 'soạn: quét căn cứ rồi gửi đúng mẫu và văn bản');
  await p.fill('#tlsua', 'ngày cấp là 05/03/2026'); await p.click('#tlsuab'); await p.waitForTimeout(300);
  c = await p.evaluate(() => window.calls);
  const s2 = c.filter(x => x[1] && x[1].action === 'soan_bc');
  if(process.env.DBG)console.log(JSON.stringify(s2).slice(0,600), await p.textContent('#tltt'), errs);
  kiem(s2.length === 2 && s2[1][1].sua === 'ngày cấp là 05/03/2026' && s2[1][1].thay_cu.length === 3, 'gõ ý sửa thì AI soạn lại kèm bản trước');
  await p.waitForSelector('#tlluu:not([disabled])'); await p.check('#tlht'); await p.click('#tlluu'); await p.waitForFunction(() => /Đã lưu/.test(document.querySelector('#tlluu').textContent), null, { timeout: 5000 }).catch(async()=>console.log('DBG', await p.textContent('#tlluu'), await p.textContent('#toast'), errs));
  c = await p.evaluate(() => window.calls);
  const ins = c.find(x => x[0] === 'insert' && x[1] === 'cap_nhat_hien_trang');
  kiem(ins && ins[2].file_ten === 'Báo cáo ATBX 2026.docx' && ins[2].trang_thai === 'cho_xac_nhan' && c.some(x => x[0] === 'upload'), 'lưu: bản soạn vào việc kèm báo hoàn thành');
  // Xóa: gọi thẳng bảng (RLS chặn ở máy chủ), 0 dòng = không phải của mình
  await p.evaluate(() => { window.confirm = () => true; window.xoaDuoc = false; window.daSau = false; });
  await p.evaluate(() => window.BVAPP.xoaMuc('viec', 'v1', 'hoi?', () => { window.daSau = true; }));
  let c2 = await p.evaluate(() => ({ calls: window.calls.filter(x => x[0] === 'delete'), sau: window.daSau, toast: document.querySelector('#toast').textContent }));
  kiem(c2.calls.length === 1 && c2.calls[0][1] === 'viec' && !c2.sau && /không phải do bạn tạo/.test(c2.toast), 'xóa việc của người khác: máy chủ trả 0 dòng, app báo không có quyền');
  await p.evaluate(() => { window.xoaDuoc = true; return window.BVAPP.xoaMuc('viec', 'v1', 'hoi?', () => { window.daSau = true; }); });
  c2 = await p.evaluate(() => ({ sau: window.daSau, toast: document.querySelector('#toast').textContent }));
  kiem(c2.sau && /Đã xóa/.test(c2.toast), 'xóa việc mình giao: xóa được và quay lại danh sách');
  kiem(!(await p.evaluate(() => window.calls.some(x => x[0] === 'rpc_xoa'))), 'không còn gọi hàm xoa_muc cũ (chỉ quản trị)');
  kiem(errs.length === 0, 'không có lỗi JS' + (errs.length ? ': ' + errs[0] : ''));
  if (process.env.SHOT) { await p.addStyleTag({ path: path.join(root, 'style.css') }); await p.screenshot({ path: process.env.SHOT + '-m.png', fullPage: false }); await p.evaluate(()=>document.querySelector('.vwb').scrollTo(0,600)); await p.screenshot({ path: process.env.SHOT + '-m2.png' }); await p.setViewportSize({ width: 1280, height: 800 }); await p.evaluate(()=>document.querySelector('.vwb').scrollTo(0,0)); await p.screenshot({ path: process.env.SHOT + '-d.png' }); }
  await b.close(); ket('tro_ly');
})();
