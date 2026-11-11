(()=>{
const A=()=>window.BVAPP;
const n=x=>x==null?'':Math.round(x).toLocaleString('vi-VN');
const ty=(a,b)=>b?Math.round(a/b*100):null;
let rows=[],ds=false,mo=null,NT=false;
async function ve(){
  const {sb,$,esc}=A();$('#nd').innerHTML='Đang tải…';
  const {data,error}=await sb.from('kh_dong').select('*').order('thu_tu');
  if(error)return $('#nd').innerHTML='<p class="mut">Lỗi: '+esc(error.message)+'</p>';
  rows=data;NT=!!(await sb.rpc('nhap_tai_chinh')).data;ve2();
}

function bars(vals,lab,mau){
  const mx=Math.max(1,...vals.map(v=>v||0)),W=300,H=110,w=W/vals.length;
  return `<svg viewBox="0 0 ${W} ${H+16}" style="width:100%">${vals.map((v,i)=>{const h=(v||0)/mx*H;return `<rect x="${i*w+3}" y="${H-h}" width="${w-6}" height="${h}" rx="2" fill="${mau||'var(--pri)'}"/><text x="${i*w+w/2}" y="${H+12}" font-size="8" text-anchor="middle" fill="#667">${lab[i]}</text>${v?`<text x="${i*w+w/2}" y="${H-h-2}" font-size="7" text-anchor="middle" fill="#334">${(v/1e6).toFixed(v>=1e8?0:1)}</text>`:''}`}).join('')}</svg>`}
function bieuDo(){
  const T=['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
  const leaf=rows.filter(r=>r.thang&&!['Lần','Lượt'].includes(r.dvt)&&!/dự kiến/.test(r.ghi_chu||''));
  const tot=T.map((_,i)=>leaf.reduce((a,r)=>a+(r.thang[i]||0),0)),k=tot.filter(v=>v).length||10;
  const sel=rows.find(r=>r.id===mo);
  const nhom=['I','II','III','IV'].map(c=>rows.find(r=>r.stt===c&&r.cap===1)).filter(Boolean);
  return `<div class="card"><b>Chi theo tháng (triệu đồng)</b>${bars(tot.slice(0,k),T,'var(--pri)')}<div class="mut" style="font-size:12px">Cộng các khoản có số liệu tháng, chưa gồm lương/khấu hao.</div></div>
  <div class="card"><b>Kế hoạch năm theo nhóm chi (tỷ đồng)</b>${nhom.map(r=>{const mx=Math.max(...nhom.map(x=>x.kh_nam||0));return `<div style="margin:6px 0"><div class="mut" style="font-size:12px">${A().esc(r.stt+'. '+r.hang_muc)} — ${(r.kh_nam/1e9).toFixed(2)}</div><div style="height:10px;background:#dde7e0;border-radius:5px"><div style="height:10px;width:${(r.kh_nam||0)/mx*100}%;background:var(--gold);border-radius:5px"></div></div></div>`}).join('')}</div>
  ${sel?`<div class="card"><b>${A().esc(sel.hang_muc)}</b>${bars(sel.thang.slice(0,12),T.slice(0,sel.thang.length),'var(--pri2)')}</div>`:''}`}

async function nhap(){
  const {sb,$,esc,toast}=A();
  const i0=rows.findIndex(r=>r.stt==='II'&&r.cap===1),i1=rows.findIndex(r=>r.stt==='D');
  const ds=rows.filter((r,i)=>i>i0&&i<i1&&r.cap>=2&&!['Lần','Lượt'].includes(r.dvt)&&!(rows[i+1]&&r.stt&&String(rows[i+1].stt).startsWith(r.stt+'.')));
  const cha=r=>{const k=String(r.stt||'').split('.')[0];for(let j=rows.indexOf(r);j>=0;j--){const x=rows[j];if(x.cap===1)break;if(x.cap===2&&x.stt===k&&x!==r)return x.hang_muc}const ro=(()=>{for(let j=rows.indexOf(r);j>=0;j--)if(rows[j].cap===1)return rows[j].hang_muc;return 'Khác'})();return ro};
  const t0=new Date().getMonth()+1;let tk='',chon=null;
  const st=document.createElement('style');st.id='khst';st.textContent=`
  .nh-t{display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px}.nh-t button{flex:0 0 auto;border:1px solid #cfdcd3!important;background:#fff!important;color:#334!important;border-radius:16px;padding:6px 12px;font-size:13px;width:auto!important;margin:0;box-shadow:none!important}
  .nh-t button.on{background:var(--pri)!important;color:#fff!important;border-color:var(--pri)!important}
  .nh-g{font-size:12px;font-weight:700;color:var(--pri2);text-transform:uppercase;letter-spacing:.4px;margin:12px 2px 4px}
  .nh-r{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#fff;border:1.5px solid transparent;border-radius:12px;padding:10px 12px;margin:4px 0;box-shadow:0 1px 3px rgba(0,60,30,.08);cursor:pointer}
  .nh-r.on{border-color:var(--pri);background:#eef8f1}.nh-r b{color:var(--pri2);margin-right:4px}
  .nh-r .m{font-size:12px;color:#6b7a70;text-align:right;white-space:nowrap}.nh-r .m i{font-style:normal;color:var(--pri);font-weight:600}
  .nh-bar{position:sticky;bottom:0;background:#fff;border-top:1px solid #cfdcd3;padding:10px 4px;margin:10px -4px 0;box-shadow:0 -4px 12px rgba(0,60,30,.08)}
  .nh-dz{border:2px dashed #9fb8a6;border-radius:12px;padding:14px;text-align:center;color:#4c5f53;background:#f6faf7;margin:10px 0 6px;cursor:pointer;font-size:14px}.nh-dz.on{background:#e3f3e8;border-color:var(--pri)}
  .nh-f{background:#fff;border-radius:10px;padding:8px 10px;margin:5px 0;box-shadow:0 1px 3px rgba(0,60,30,.08)}.nh-f .t{display:flex;justify-content:space-between;gap:8px;font-size:13px}.nh-f .t span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .nh-f input{margin:4px 0 2px}.nh-c{display:flex;gap:5px;flex-wrap:wrap}.nh-c button{width:auto!important;margin:0;padding:3px 9px;font-size:12px;border-radius:12px;border:1px solid #cfdcd3!important;background:#fff!important;color:#334!important;box-shadow:none!important}
  .nh-bar .sel{font-size:13px;margin-bottom:6px;color:#334}.nh-bar input{margin:0 0 6px}`;
  document.getElementById('khst')?.remove();document.head.appendChild(st);
  const dsHtml=()=>{const q=f(tk),m=+document.querySelector('.nh-t .on')?.dataset.m||t0;let g='',h='';
    ds.filter(r=>!q||f(r.hang_muc+' '+(r.stt||'')).includes(q)).forEach(r=>{const c=cha(r);if(c!==g){g=c;h+=`<div class="nh-g">${esc(c)}</div>`}
      const v=(r.thang||[])[m-1];h+=`<div class="nh-r ${chon===r.id?'on':''}" data-k="${r.id}"><span><b>${esc(r.stt||'')}</b>${esc(r.hang_muc)}</span><span class="m">KH ${n(r.kh_nam)}<br>T${m}: <i>${v?n(v):'—'}</i></span></div>`});
    return h||'<p class="mut">Không thấy khoản nào</p>'};
  $('#nd').innerHTML=`<h3>Nhập phiếu đề nghị thanh toán</h3><div class="mut">Số tiền được <b>cộng thêm</b> vào tháng đã chọn, ghi thẳng vào Google Sheet.</div>
  <div class="nh-t">${[...Array(12)].map((_,i)=>`<button data-m="${i+1}" class="${i+1===t0?'on':''}">Tháng ${i+1}</button>`).join('')}</div>
  <input id="nq" placeholder="🔍 Tìm khoản chi (vd: điện, thuốc, văn phòng phẩm)"><div class="nh-dz" id="dz">📎 <b>Kéo thả hồ sơ vào đây</b> hoặc bấm để chọn file<br><span style="font-size:12px">PDF, ảnh, Word, Excel · app tự đọc số tiền, bồ kiểm lại rồi bấm Cộng</span><input type="file" id="fi" multiple accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.xlsx,.xls,image/*" style="display:none"></div><div id="fl"></div>
  <div id="nl">${dsHtml()}</div>

  <div class="nh-bar"><div class="sel" id="nsel">Chọn một khoản chi ở trên</div><input id="ns" inputmode="numeric" autocomplete="off" placeholder="Số tiền nhập tay (nếu không có hồ sơ)"><div id="nsp" style="font-size:20px;font-weight:700;color:var(--pri2);min-height:26px;margin:0 0 6px"></div><input id="ng2" placeholder="Nội dung / số phiếu (không bắt buộc)"><button class="full" id="ng">Cộng vào tháng</button><button class="sec full" id="nv">← Quay lại</button></div>`;
  const bind=()=>document.querySelectorAll('.nh-r').forEach(e=>e.onclick=()=>{chon=+e.dataset.k;const r=rows.find(x=>x.id===chon);$('#nsel').innerHTML='Đã chọn: <b>'+esc((r.stt||'')+' '+r.hang_muc)+'</b>';$('#nl').innerHTML=dsHtml();bind();$('#ns').focus()});
  const ve3=()=>{$('#nl').innerHTML=dsHtml();bind()};bind();
  $('#nq').oninput=e=>{tk=e.target.value;ve3()};
  document.querySelectorAll('.nh-t button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nh-t button').forEach(x=>x.classList.remove('on'));b.classList.add('on');ve3()});
  const fmtS=()=>{const el=$('#ns'),d=el.value.replace(/\D/g,'').replace(/^0+/,'');const t=d?d.replace(/\B(?=(\d{3})+(?!\d))/g,'.'):'';el.value=t;$('#nsp').textContent=t?t+' đồng':''};
  ['input','keyup','change','paste'].forEach(ev=>$('#ns').addEventListener(ev,()=>setTimeout(fmtS,0)));

  const F=[];
  const dsF=()=>{$('#fl').innerHTML=F.map((x,i)=>`<div class="nh-f"><div class="t"><span>📄 ${esc(x.name)}</span><span>${x.st==='dang'?'⏳ đang đọc…':`<a href="#" data-rm="${i}" style="color:#c0392b">✕ bỏ</a>`}</span></div>${x.st==='dang'?'':`<input data-so="${i}" inputmode="numeric" autocomplete="off" placeholder="Số tiền của hồ sơ này" value="${x.so?Number(x.so).toLocaleString('vi-VN'):''}">${x.msg?`<div class="mut" style="font-size:12px">${esc(x.msg)}</div>`:''}<div class="nh-c">${(x.cands||[]).map(c=>`<button data-c="${i}:${c}">${Number(c).toLocaleString('vi-VN')}</button>`).join('')}</div>`}</div>`).join('');
    document.querySelectorAll('[data-rm]').forEach(a=>a.onclick=e=>{e.preventDefault();F.splice(+a.dataset.rm,1);dsF()});
    document.querySelectorAll('[data-so]').forEach(inp=>inp.oninput=()=>{const d=inp.value.replace(/\D/g,'').replace(/^0+/,'');F[+inp.dataset.so].so=d?+d:0;inp.value=d?d.replace(/\B(?=(\d{3})+(?!\d))/g,'.'):''});
    document.querySelectorAll('[data-c]').forEach(bt=>bt.onclick=()=>{const[i,c]=bt.dataset.c.split(':');F[+i].so=+c;dsF()})};
  const docB64=file=>new Promise((ok,no)=>{
    const rd=new FileReader();rd.onerror=no;
    if(/^image\//.test(file.type)&&file.size>2e6){const im=new Image();rd.onload=()=>{im.onload=()=>{const k=Math.min(1,2000/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);ok({b64:c.toDataURL('image/jpeg',.85).split(',')[1],mime:'image/jpeg'})};im.onerror=no;im.src=rd.result};rd.readAsDataURL(file)}
    else{rd.onload=()=>ok({b64:String(rd.result).split(',')[1],mime:file.type||'application/octet-stream'});rd.readAsDataURL(file)}});
  const themF=async list=>{for(const file of list){
    if(file.size>9e6){toast(file.name+' quá lớn (tối đa ~9MB)');continue}
    const x={name:file.name,st:'dang',so:0,cands:[]};F.push(x);dsF();
    try{const {b64,mime}=await docB64(file);
      const {data,error}=await sb.functions.invoke('kh-ghi',{body:{action:'doc',ten_file:file.name,mime,b64}});
      let loi=error?(data&&data.loi)||error.message:data&&data.loi;
      if(error&&error.context&&error.context.json){try{loi=(await error.context.json()).loi||loi}catch(e){}}
      if(loi)throw new Error(loi);
      x.tam=data.tam;x.so=data.best||0;x.cands=(data.cands||[]).filter(c=>c!==data.best);
      x.msg=data.khop?'✓ Lấy từ '+(data.nguon||'hồ sơ')+', khớp số bằng chữ':data.chu&&data.best&&data.chu!==data.best?'⚠ Số bằng chữ ('+Number(data.chu).toLocaleString('vi-VN')+') khác số đọc được, kiểm lại':data.best?'Đã đọc số tiền, bồ kiểm lại cho đúng':(data.loi_doc?'Chưa đọc được số tiền ('+data.loi_doc.slice(0,80)+'). Nhập tay.':'Không thấy số tiền, nhập tay.');
    }catch(e){x.msg='Lỗi: '+(e.message||e);F.splice(F.indexOf(x),1);toast(x.msg)}
    x.st='ok';dsF()}};
  const dz=$('#dz'),fi=$('#fi');
  dz.onclick=()=>fi.click();fi.onchange=()=>{themF([...fi.files]);fi.value=''};
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('on')}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('on')}));
  dz.addEventListener('drop',e=>themF([...e.dataTransfer.files]));
  $('#nv').onclick=()=>{document.getElementById('khst')?.remove();ve2()};
  $('#ng').onclick=async()=>{
    if(!chon)return toast('Chọn khoản chi');
    if(F.some(x=>x.st==='dang'))return toast('Đợi đọc xong hồ sơ');
    const items=F.filter(x=>x.so>0).map(x=>({so:x.so,tam:x.tam,ten_file:x.name}));
    const tay=Number($('#ns').value.replace(/\D/g,''));
    if(tay>0)items.push({so:tay,ghi_chu:$('#ng2').value});
    if(F.some(x=>!(x.so>0)))return toast('Có hồ sơ chưa có số tiền, nhập hoặc bỏ nó đi');
    if(!items.length)return toast('Nhập số tiền hoặc thả hồ sơ');
    const r=rows.find(x=>x.id===chon),th=+document.querySelector('.nh-t .on').dataset.m,tong=items.reduce((a,x)=>a+x.so,0);
    if(!confirm('Cộng '+items.map(x=>n(x.so)).join(' + ')+' = '+n(tong)+' đ\nvào '+(r.stt||'')+' '+r.hang_muc+'\nTháng '+th+(F.length?'\nLưu '+F.length+' hồ sơ vào thư mục tương ứng trên Drive':'')+'?'))return;
    const b=$('#ng');b.disabled=true;b.textContent='Đang ghi…';
    const {data,error}=await sb.functions.invoke('kh-ghi',{body:{id:r.id,thang:th,items}});
    b.disabled=false;b.textContent='Cộng vào tháng';
    let loi=error?(data&&data.loi)||error.message:data&&data.loi;
    if(error&&error.context&&error.context.json){try{loi=(await error.context.json()).loi||loi}catch(e){}}
    if(loi)return toast(loi);
    toast('Đã cộng vào Sheet'+(data.links&&data.links.length?' · đã lưu '+data.links.length+' hồ sơ vào '+data.thu_muc:''));await ve();nhap();
  };
}
const f=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
function ve2(){
  const {$,esc}=A();
  const L=rows.filter(r=>r.cap<=(ds?9:2)||false);
  const top=rows.filter(r=>r.cap===0&&r.kh_nam!=null);
  const thu=rows.find(r=>r.stt==='B'),chi=rows.find(r=>r.stt==='C');
  const hien=r=>{
    const t=r.sd_nam!=null&&r.sd_nam!==0?r.sd_nam:(r.thang?r.thang.reduce((a,b)=>a+(b||0),0):null);
    const p=ty(t,r.kh_nam);
    return `<div class="card" data-k="${r.id}" style="margin-left:${Math.min(r.cap,3)*8}px;padding:10px"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc((r.stt||'')+' '+r.hang_muc)}</b><span class="tag">${p==null?'':p+'%'}</span></div>
    <div class="mut">KH ${n(r.kh_nam)} · Đã dùng ${n(t)} ${esc(r.dvt||'')}</div>${p!=null?`<div style="height:6px;background:#dde7e0;border-radius:3px;margin-top:4px"><div style="height:6px;width:${Math.min(p,100)}%;background:${p>100?'#c0392b':'var(--pri)'};border-radius:3px"></div></div>`:''}
    ${r.ghi_chu?`<div class="mut" style="font-size:12px">${esc(r.ghi_chu)}</div>`:''}</div>`};
  $('#nd').innerHTML=`<h3>Kế hoạch – sử dụng 2026</h3><div class="mut">Nguồn: Bảng thu chi (tab KH 2026). Số đã dùng đến tháng gần nhất có dữ liệu.</div>
  <div class="kpi" style="display:flex;gap:8px;margin:8px 0">${[thu,chi].filter(Boolean).map(r=>`<div class="card" style="flex:1"><div class="mut">${esc(r.hang_muc)}</div><b>${n(r.kh_nam)}</b></div>`).join('')}</div>
  ${bieuDo()}${NT?'<button class="full" id="nhn">✍️ Nhập số chi tháng</button>':''}<label><input type="checkbox" id="khct" ${ds?'checked':''}> Hiện chi tiết</label>${L.map(hien).join('')}`;
  document.querySelectorAll('[data-k]').forEach(e=>e.onclick=()=>{const r=rows.find(x=>x.id==e.dataset.k);if(r.thang){mo=r.id;ve2();scrollTo(0,0)}});
  if($('#nhn'))$('#nhn').onclick=nhap;
  $('#khct').onchange=e=>{ds=e.target.checked;ve2()};
}
window.KH={ve};
})();
