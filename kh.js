(()=>{
const A=()=>window.BVAPP;
const n=x=>x==null?'':Math.round(x).toLocaleString('vi-VN');
const ty=(a,b)=>b?Math.round(a/b*100):null;
let rows=[],ds=false,mo=null;
async function ve(){
  const {sb,$,esc}=A();$('#nd').innerHTML='Đang tải…';
  const {data,error}=await sb.from('kh_dong').select('*').order('thu_tu');
  if(error)return $('#nd').innerHTML='<p class="mut">Lỗi: '+esc(error.message)+'</p>';
  rows=data;ve2();
}
function ve2(){
  const {$,esc}=A();
  const L=rows.filter(r=>r.cap<=(ds?9:2)||false);
  const top=rows.filter(r=>r.cap===0&&r.kh_nam!=null);
  const thu=rows.find(r=>r.stt==='B'),chi=rows.find(r=>r.stt==='C');
  const hien=r=>{
    const t=r.sd_nam!=null&&r.sd_nam!==0?r.sd_nam:(r.thang?r.thang.reduce((a,b)=>a+(b||0),0):null);
    const p=ty(t,r.kh_nam);
    return `<div class="card" style="margin-left:${Math.min(r.cap,3)*8}px;padding:10px"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc((r.stt||'')+' '+r.hang_muc)}</b><span class="tag">${p==null?'':p+'%'}</span></div>
    <div class="mut">KH ${n(r.kh_nam)} · Đã dùng ${n(t)} ${esc(r.dvt||'')}</div>${p!=null?`<div style="height:6px;background:#dde7e0;border-radius:3px;margin-top:4px"><div style="height:6px;width:${Math.min(p,100)}%;background:${p>100?'#c0392b':'var(--pri)'};border-radius:3px"></div></div>`:''}
    ${r.ghi_chu?`<div class="mut" style="font-size:12px">${esc(r.ghi_chu)}</div>`:''}</div>`};
  $('#nd').innerHTML=`<h3>Kế hoạch – sử dụng 2026</h3><div class="mut">Nguồn: Bảng thu chi (tab KH 2026). Số đã dùng đến tháng gần nhất có dữ liệu.</div>
  <div class="kpi" style="display:flex;gap:8px;margin:8px 0">${[thu,chi].filter(Boolean).map(r=>`<div class="card" style="flex:1"><div class="mut">${esc(r.hang_muc)}</div><b>${n(r.kh_nam)}</b></div>`).join('')}</div>
  <label><input type="checkbox" id="khct" ${ds?'checked':''}> Hiện chi tiết</label>${L.map(hien).join('')}`;
  $('#khct').onchange=e=>{ds=e.target.checked;ve2()};
}
window.KH={ve};
})();
