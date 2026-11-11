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
  const t0=new Date().getMonth()+1;let tk='';
  const dsHtml=()=>{const q=f(tk);return ds.filter(r=>!q||f(r.hang_muc+' '+(r.stt||'')).includes(q)).map(r=>`<label class="card" style="display:flex;gap:8px;align-items:center;padding:8px;margin:4px 0"><input type="radio" name="nk" value="${r.id}"><span><b>${esc(r.stt||'')}</b> ${esc(r.hang_muc)}<br><span class="mut" style="font-size:12px">KH ${n(r.kh_nam)} · tháng này ${n((r.thang||[])[+($('#nt')?$('#nt').value:t0)-1])||'—'}</span></span></label>`).join('')||'<p class="mut">Không thấy khoản nào</p>'};
  $('#nd').innerHTML=`<h3>Nhập phiếu đề nghị thanh toán</h3><div class="mut">Số tiền được <b>cộng thêm</b> vào tháng đã chọn, ghi thẳng vào Google Sheet.</div>
  <label>Tháng<select id="nt">${[...Array(12)].map((_,i)=>`<option value="${i+1}" ${i+1===t0?'selected':''}>Tháng ${i+1}</option>`).join('')}</select></label>
  <input id="nq" placeholder="🔍 Tìm khoản chi (vd: điện, thuốc, văn phòng phẩm)"><div id="nl" style="max-height:38vh;overflow:auto">${dsHtml()}</div>
  <label>Số tiền phiếu (đồng)<input id="ns" inputmode="numeric" placeholder="vd 12500000"></label>
  <label>Nội dung / số phiếu (không bắt buộc)<input id="ng2" placeholder="vd DNTT số 123 - mua văn phòng phẩm"></label>
  <button class="full" id="ng">Cộng vào tháng</button><button class="sec full" id="nv">← Quay lại</button>`;
  $('#nq').oninput=e=>{tk=e.target.value;$('#nl').innerHTML=dsHtml()};
  $('#nt').onchange=()=>$('#nl').innerHTML=dsHtml();
  $('#nv').onclick=ve2;
  $('#ng').onclick=async()=>{
    const ch=document.querySelector('input[name=nk]:checked');if(!ch)return toast('Chọn khoản chi');
    const so=Number(String($('#ns').value).replace(/[.,\s]/g,''));
    if(!(so>0))return toast('Nhập số tiền');
    const r=rows.find(x=>x.id==ch.value);
    if(!confirm('Cộng '+n(so)+' đ vào\n'+(r.stt||'')+' '+r.hang_muc+'\nTháng '+$('#nt').value+'?'))return;
    const b=$('#ng');b.disabled=true;b.textContent='Đang ghi…';
    const {data,error}=await sb.functions.invoke('kh-ghi',{body:{id:r.id,thang:+$('#nt').value,so,ghi_chu:$('#ng2').value}});
    b.disabled=false;b.textContent='Cộng vào tháng';
    let loi=error?(data&&data.loi)||error.message:data&&data.loi;
    if(error&&error.context&&error.context.json){try{loi=(await error.context.json()).loi||loi}catch(e){}}
    if(loi)return toast(loi);
    toast('Đã cộng vào Sheet');await ve();nhap();
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
