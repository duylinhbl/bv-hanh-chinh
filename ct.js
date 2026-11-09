(()=>{
const A=()=>window.BVAPP,$=s=>document.querySelector(s);
const TH=['CN','T2','T3','T4','T5','T6','T7'];
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const pd=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const add=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return iso(d)};
const dm=s=>{const d=pd(s);return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')};
const hm=t=>t?t.slice(0,5):'';
const monday=s=>{const d=pd(s),w=(d.getDay()+6)%7;return add(s,-w)};
let ten={},quyen=false,view={y:0,m:0},chon=iso(new Date());

async function nap(){
  const [d,q]=await Promise.all([A().sb.from('danh_ba').select('id,ho_ten,chuc_vu').order('ho_ten'),A().sb.rpc('duoc_phat')]);
  ten={};(d.data||[]).forEach(p=>ten[p.id]=p);quyen=!!q.data||!!A().me.la_quan_tri;
}
async function ve(){
  const n=pd(chon);view={y:n.getFullYear(),m:n.getMonth()};
  A().$('#nd').innerHTML='Đang tải…';
  try{await nap();await dung()}catch(e){A().$('#nd').innerHTML='<p class="mut">Lỗi: '+A().esc(e.message||e)+'</p>'}
}
async function dung(){
  const {esc}=A(),first=new Date(view.y,view.m,1),start=monday(iso(first)),last=new Date(view.y,view.m+1,0),end=add(monday(iso(last)),6);
  const {data:ev,error}=await A().sb.from('lich_cong_tac').select('*').gte('ngay',start).lte('ngay',end).order('ngay').order('gio_bd');
  if(error)throw error;
  const ids=(ev||[]).map(e=>e.id);
  const tp={};if(ids.length){const {data}=await A().sb.from('lich_cong_tac_tp').select('lich_id,nguoi_id').in('lich_id',ids).limit(5000);(data||[]).forEach(r=>(tp[r.lich_id]=tp[r.lich_id]||[]).push(r.nguoi_id))}
  const co={};(ev||[]).forEach(e=>{if(!e.huy)co[e.ngay]=(co[e.ngay]||0)+1});
  const hom=iso(new Date());
  let grid='';for(let d=start;d<=end;d=add(d,1)){const x=pd(d),ngoai=x.getMonth()!==view.m,t=monday(chon)===monday(d);
    grid+=`<button data-d="${d}" style="padding:8px 0;border-radius:8px;background:${d===chon?'var(--pri)':t?'var(--line)':'transparent'};color:${d===chon?'#fff':ngoai?'var(--mut)':'var(--tx)'};${d===hom?'font-weight:800;outline:1px solid var(--pri)':'font-weight:500'}">${x.getDate()}<div style="height:6px;font-size:8px;line-height:6px">${co[d]?'●'.repeat(Math.min(co[d],3)):''}</div></button>`}
  const tuan=Array.from({length:7},(_,i)=>add(monday(chon),i));
  const mine=A().me.id;
  const the=e=>{const ps=tp[e.id]||[],toi=ps.includes(mine);return `<div class="card" style="${toi?'border-color:var(--pri);border-width:2px;':''}${e.huy?'opacity:.55;':''}"><div class="row" style="justify-content:space-between"><b>${hm(e.gio_bd)}${e.gio_kt?'–'+hm(e.gio_kt):''}</b>${e.huy?'<span class="tag red">Đã hủy</span>':toi?'<span class="tag grn">Có tên bạn</span>':''}${e.rieng_tu?'<span class="tag">Riêng</span>':''}</div>
    <div style="${e.huy?'text-decoration:line-through':''}">${esc(e.noi_dung)}</div>${e.dia_diem?`<div class="mut">📍 ${esc(e.dia_diem)}</div>`:''}
    <div class="mut">👥 ${ps.length?ps.map(i=>esc((ten[i]||{}).ho_ten||'?')).join(', '):'—'}</div>
    ${(e.nguoi_tao===mine||A().me.la_quan_tri)&&!e.huy?`<div class="row" style="margin-top:6px"><button class="sec" data-sua="${e.id}">Sửa</button></div>`:''}</div>`};
  const emap=Object.fromEntries((ev||[]).map(e=>[e.id,{...e,tp:tp[e.id]||[]}]));
  A().$('#nd').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><button class="sec" id="pv">‹</button><b>Tháng ${view.m+1}/${view.y}</b><button class="sec" id="nx">›</button></div>
   <div style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;gap:2px"><div class="mut">T2</div><div class="mut">T3</div><div class="mut">T4</div><div class="mut">T5</div><div class="mut">T6</div><div class="mut">T7</div><div class="mut">CN</div>${grid}</div></div>
   <div class="row" style="justify-content:space-between;margin:4px 0 8px"><b>Tuần ${dm(tuan[0])} – ${dm(tuan[6])}</b>${quyen?'<button id="them">+ Thêm lịch</button>':''}</div>
   ${tuan.map(d=>{const l=(ev||[]).filter(e=>e.ngay===d);return `<div style="margin:8px 0 2px;font-weight:700;color:${d===hom?'var(--pri)':'inherit'}">${TH[pd(d).getDay()]} ${dm(d)}</div>${l.map(the).join('')||'<div class="mut" style="margin-bottom:6px">Chưa có lịch</div>'}`}).join('')}`;
  document.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{chon=b.dataset.d;const n=pd(chon);view={y:n.getFullYear(),m:n.getMonth()};dung()});
  $('#pv').onclick=()=>{view.m--;if(view.m<0){view.m=11;view.y--}chon=iso(new Date(view.y,view.m,1));dung()};
  $('#nx').onclick=()=>{view.m++;if(view.m>11){view.m=0;view.y++}chon=iso(new Date(view.y,view.m,1));dung()};
  if($('#them'))$('#them').onclick=()=>form(null);
  document.querySelectorAll('[data-sua]').forEach(b=>b.onclick=()=>form(emap[b.dataset.sua]));
}

async function form(e){
  const {esc,toast}=A();
  const {data:ks}=await A().sb.rpc('ds_khoa');
  const sua=!!e;let sel=new Set(e?e.tp:[]),kh=new Set();
  const ui=()=>{
    $('#nd').innerHTML=`<button class="sec" id="lui">← Quay lại</button><div class="card" style="margin-top:10px">
    <label>Ngày</label><input id="ng" type="date" value="${e?e.ngay:chon}">
    <div class="row"><div style="flex:1"><label>Từ giờ</label><input id="g1" type="time" value="${e?hm(e.gio_bd):''}"></div><div style="flex:1"><label>Đến giờ</label><input id="g2" type="time" value="${e?hm(e.gio_kt):''}"></div></div>
    <label>Nội dung</label><textarea id="nd2">${e?esc(e.noi_dung):''}</textarea><label>Địa điểm</label><input id="dd" value="${e?esc(e.dia_diem||''):''}">
    <label>Thành phần tham dự (app sẽ nhắn cho từng người)</label>
    <div class="mut">Cả khoa/phòng:</div>${(ks||[]).map(k=>`<label style="font-weight:400;margin:4px 0"><input type="checkbox" data-k="${k.id}" style="width:auto" ${kh.has(k.id)?'checked':''}> ${esc(k.ten)}</label>`).join('')}
    <div class="mut" style="margin-top:8px">Từng người:</div><div id="chips" style="margin:4px 0">${[...sel].map(i=>`<span class="tag" data-x="${i}" style="margin:2px;padding:4px 10px">${esc((ten[i]||{}).ho_ten||'?')} ✕</span>`).join('')||'<span class="mut">Chưa chọn</span>'}</div>
    <input id="tim" placeholder="Gõ tên để thêm…"><div id="kq"></div>
    <label style="font-weight:400;margin-top:10px"><input id="rt" type="checkbox" style="width:auto" ${e&&e.rieng_tu?'checked':''}> Lịch riêng (chỉ thành phần mới thấy)</label>
    <button class="full" id="luu">${sua?'Lưu và nhắn người liên quan':'Tạo lịch và nhắn thành phần'}</button>${sua?'<button class="full dng" id="huy">Hủy lịch này</button>':''}<p class="mut" id="loi"></p></div>`;
    $('#lui').onclick=dung;
    document.querySelectorAll('[data-k]').forEach(c=>c.onchange=()=>{c.checked?kh.add(c.dataset.k):kh.delete(c.dataset.k)});
    document.querySelectorAll('[data-x]').forEach(c=>c.onclick=()=>{sel.delete(c.dataset.x);keep();ui()});
    $('#tim').oninput=()=>{const q=$('#tim').value.trim().toLowerCase();$('#kq').innerHTML=q?Object.values(ten).filter(p=>p.ho_ten.toLowerCase().includes(q)&&!sel.has(p.id)).slice(0,8).map(p=>`<div class="card" data-a="${p.id}" style="padding:8px 12px;margin:4px 0">${esc(p.ho_ten)} <span class="mut">${esc(p.chuc_vu||'')}</span></div>`).join(''):'';
      document.querySelectorAll('[data-a]').forEach(c=>c.onclick=()=>{sel.add(c.dataset.a);keep();ui()})};
    const gui=async huy=>{
      keep();$('#loi').textContent='';
      const {error}=await A().sb.rpc('luu_lich_cong_tac',{p_id:sua?e.id:null,p_ngay:$('#ng').value,p_gio_bd:$('#g1').value||null,p_gio_kt:$('#g2').value||null,p_noi_dung:$('#nd2').value,p_dia_diem:$('#dd').value,p_nguoi:[...sel],p_khoa:[...kh],p_rieng:$('#rt').checked,p_huy:!!huy});
      if(error)return $('#loi').textContent=error.message;
      chon=$('#ng').value;toast(huy?'Đã hủy lịch, đã báo thành phần':'Đã lưu, đã nhắn thành phần');ve();
    };
    $('#luu').onclick=()=>gui(false);if($('#huy'))$('#huy').onclick=()=>{if(confirm('Hủy lịch này và báo cho thành phần?'))gui(true)};
  };
  const keep=()=>{const v=id=>$(id)?$(id).value:'';e=e?{...e,ngay:v('#ng')||e.ngay,gio_bd:v('#g1'),gio_kt:v('#g2'),noi_dung:v('#nd2'),dia_diem:v('#dd'),rieng_tu:$('#rt')?$('#rt').checked:e.rieng_tu}:{id:null,ngay:v('#ng')||chon,gio_bd:v('#g1'),gio_kt:v('#g2'),noi_dung:v('#nd2'),dia_diem:v('#dd'),rieng_tu:$('#rt')?$('#rt').checked:false,tp:[]};e.tp=[...sel]};
  if(!e)e=null;ui();
}
window.LICHCT={ve};
})();
