// Kiểm thử màn hình nhập chi phí trên trình duyệt giả lập – chạy: node tests/giao_dien.test.js (cần playwright)
const { kiem, ket } = require('./lib');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('- bỏ qua giao_dien: chưa cài playwright'); process.exit(0); }
const path = require('path'), root = path.join(__dirname, '..');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 400, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const rows = [
    { id: 1, thu_tu: 1, stt: 'II', hang_muc: 'CHI THƯỜNG XUYÊN', cap: 1, kh_nam: 1 },
    { id: 2, thu_tu: 2, stt: '5', hang_muc: 'Điện thoại', cap: 2, kh_nam: 1e8 },
    { id: 3, thu_tu: 3, stt: '5.3', hang_muc: 'Điện thoại bàn', cap: 3, kh_nam: 6e7, thang: [1, 2, 3], cap_nhat: '2026-11-12T01:00:00Z' },
    { id: 5, thu_tu: 5, stt: 'D', hang_muc: 'THU-CHI', cap: 0, kh_nam: 1 }];
  await p.setContent('<div id="app"><div id="nd"></div></div>');
  await p.addScriptTag({ content: `window.calls=[];window.BVAPP={sb:{from:()=>({select:()=>({order:async()=>({data:${JSON.stringify(rows)}})})}),rpc:async()=>({data:true}),functions:{invoke:async(n,o)=>{window.calls.push([n,o.body]);if(o.body&&o.body.action==='hoan')return{data:{ok:true}};if(n==='kh-dong-bo')return{data:{ok:true,cap_nhat:2}};return{data:{ok:true,rq:o.body.rq,moi:100,tong:100,links:[],thu_muc:'x',kiem:true}}}}},$:s=>document.querySelector(s),esc:s=>String(s??'').replace(/</g,'&lt;'),toast:m=>{window.lastToast=m}};window.confirm=()=>true;window.alert=()=>{}` });
  await p.addScriptTag({ path: path.join(root, 'kh.js') });
  await p.evaluate(() => window.KH.ve());
  await p.waitForSelector('#khlm');
  kiem(true, 'màn báo cáo hiện, có nút Làm mới');
  await p.click('#khlm'); await p.waitForTimeout(200);
  kiem(/Đã cập nhật 2 dòng/.test(await p.evaluate(() => window.lastToast)), 'Làm mới gọi đồng bộ và báo kết quả');
  await p.click('#nhn'); await p.waitForSelector('.nh-r');
  kiem(await p.isVisible('#dz'), 'có ô kéo thả hồ sơ');
  await p.click('.nh-r[data-k="3"]'); await p.fill('#ns', '1800000');
  await p.waitForFunction(() => document.querySelector('#ns').value === '1.800.000', null, {timeout: 3000}).catch(() => {});
  kiem((await p.inputValue('#ns')) === '1.800.000', 'ô số tiền tự chia dấu "." hàng nghìn');
  await p.click('#ng'); await p.waitForTimeout(300);
  const g = await p.evaluate(() => window.calls.filter(c => c[0] === 'kh-ghi').map(c => c[1]));
  kiem(g.length === 1 && g[0].items[0].so === 1800000 && /^[A-Za-z0-9-]{8,64}$/.test(g[0].rq), 'gửi đúng số tiền và có mã phiếu');
  kiem(await p.$('#nhoan') !== null, 'sau khi ghi có nút Hoàn tác');
  await p.click('#nhoan'); await p.waitForTimeout(200);
  const h = await p.evaluate(() => window.calls.filter(c => c[1] && c[1].action === 'hoan').map(c => c[1]));
  kiem(h.length === 1 && h[0].rq === g[0].rq, 'Hoàn tác gửi đúng mã phiếu vừa ghi');
  kiem(errs.length === 0, 'không có lỗi JS' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); ket('giao_dien');
})();
