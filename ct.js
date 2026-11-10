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


// ---- dán nhanh: tách ngày, giờ, địa điểm, thành phần từ 1 dòng văn bản ----
const f=s=>[...s.normalize('NFC')].map(c=>c==='đ'?'d':c==='Đ'?'D':c.normalize('NFD')[0]).join('').toLowerCase();
const p2=x=>String(x).padStart(2,'0');
function phanTich(raw,homIso){
  let t=raw.normalize('NFC').replace(/\s+/g,' ').trim(),n=f(t);const o={};
  let tpText='';const mm=/(thanh phan|\btp\b)\s*[:\-]?\s*/.exec(n);
  if(mm){tpText=t.slice(mm.index+mm[0].length);t=t.slice(0,mm.index);n=n.slice(0,mm.index)}
  let idx=-1,len=0;const dd=/(dia diem\s*[:\-]?\s*)/.exec(n);
  if(dd){idx=dd.index;len=dd[0].length}else{const re=/\btai\s+/g;let x;while((x=re.exec(n))){idx=x.index;len=x[0].length}}
  if(idx>=0){o.dia_diem=t.slice(idx+len).replace(/[\s.,;]+$/,'').trim();t=t.slice(0,idx);n=n.slice(0,idx)}
  const cut=(m)=>{t=t.slice(0,m.index)+' '+t.slice(m.index+m[0].length);n=n.slice(0,m.index)+' '+n.slice(m.index+m[0].length)};
  let m=/(\d{1,2})\s*(?:h|:|gio)\s*(\d{1,2})?\s*(?:-|–|den|toi)\s*(\d{1,2})\s*(?:h|:|gio)?\s*(\d{1,2})?/.exec(n);
  if(m&&+m[1]<24&&+m[3]<24){o.gio_bd=p2(m[1])+':'+p2(m[2]||0);o.gio_kt=p2(m[3])+':'+p2(m[4]||0);cut(m)}
  else{m=/(\d{1,2})\s*(?:h|:|gio)\s*(\d{1,2})?/.exec(n);if(m&&+m[1]<24){o.gio_bd=p2(m[1])+':'+p2(m[2]||0);cut(m)}}
  const hom=new Date(homIso+'T00:00:00');
  m=/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(\d{4}|\d{2}))?/.exec(n);
  if(m&&+m[1]>=1&&+m[1]<=31&&+m[2]>=1&&+m[2]<=12){let y=m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):hom.getFullYear();o.ngay=`${y}-${p2(m[2])}-${p2(m[1])}`;cut(m)}
  else if((m=/\bngay mai\b/.exec(n))){const d=new Date(hom);d.setDate(d.getDate()+1);o.ngay=iso(d);cut(m)}
  else if((m=/\bhom nay\b/.exec(n))){o.ngay=homIso;cut(m)}
  else if((m=/\b(?:thu\s*([2-7])|chu nhat|cn)\b/.exec(n))){const w=m[1]?+m[1]-1:0;const d=new Date(hom);while(d.getDay()!==w)d.setDate(d.getDate()+1);o.ngay=iso(d);cut(m)}
  t=t.replace(/\s+/g,' ').trim();
  for(let i=0;i<3;i++)t=t.replace(/^(lúc|vào|ngày|từ|vào lúc)\s+/i,'').replace(/\s+(lúc|vào|ngày|từ|đến|tới|vào lúc)$/i,'').replace(/^[\s,;:\-–.]+|[\s,;:\-–.]+$/g,'');
  o.noi_dung=t;
  o.tp=tpText.split(/,|;|\n|&|\bvà\b/i).map(x=>x.replace(/[\s.]+$/,'').trim()).filter(Boolean);
  return o;
}
const PREFIX=/^(bs|ds|ys|ktv|kt|dd|nhs|cn|ths|cki|ckii|pgd|gd|pho giam doc|giam doc|truong khoa|truong phong|bac si|duoc si|y si|dieu duong|ho sinh|thac si)\.?\s+/;
const HINT={bs:/bac s|\bbs\b/,'bac si':/bac s|\bbs\b/,ds:/duoc/,'duoc si':/duoc/,nhs:/nhs|ho sinh/,'ho sinh':/nhs|ho sinh/,dd:/dieu duong|\bdd\b/,'dieu duong':/dieu duong|\bdd\b/,ys:/y s[yi]|\bys\b/,'y si':/y s[yi]|\bys\b/,ktv:/ky thuat|ktv/,kt:/ky thuat|ktv/};
function timNguoi(tok,PL,khoa){
  let nt=f(tok).replace(/\./g,' ').replace(/\s+/g,' ').trim();const hints=[];
  for(;;){const m=PREFIX.exec(nt);if(!m)break;hints.push(m[1]);nt=nt.slice(m[0].length)}
  if(nt==='toan vien'||nt==='toan benh vien')return{khoa:khoa.map(k=>k.id)};
  const kk=khoa.find(k=>k.al.includes(nt));if(kk)return{khoa:[kk.id]};
  let c=PL.filter(p=>{const full=f(p.ho_ten);return full===nt||(' '+full+' ').includes(' '+nt+' ')||f(p.ten_goi||'')===nt});
  const ex=c.filter(p=>f(p.ho_ten)===nt||f(p.ten_goi||'')===nt);if(ex.length)c=ex;
  for(const h of hints){const re=HINT[h];if(!re)continue;const c2=c.filter(p=>re.test(f((p.chuc_vu||'')+' '+(p.chuyen_mon||''))));if(c2.length)c=c2}
  return{ids:c.map(p=>p.id)};
}

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
    ${(e.nguoi_tao===mine||A().me.la_quan_tri)&&!e.huy?`<div class="row" style="margin-top:6px"><button class="sec" data-sua="${e.id}">Sửa</button>${A().me.la_quan_tri?`<button class="sec dng" data-xoa="${e.id}" style="margin-left:6px">Xóa</button>`:''}</div>`:A().me.la_quan_tri?`<div class="row" style="margin-top:6px"><button class="sec dng" data-xoa="${e.id}">Xóa</button></div>`:''}</div>`};
  const emap=Object.fromEntries((ev||[]).map(e=>[e.id,{...e,tp:tp[e.id]||[]}]));
  A().$('#nd').innerHTML=`<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><button class="sec" id="pv">‹</button><b>Tháng ${view.m+1}/${view.y}</b><button class="sec" id="nx">›</button></div>
   <div style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;gap:2px"><div class="mut">T2</div><div class="mut">T3</div><div class="mut">T4</div><div class="mut">T5</div><div class="mut">T6</div><div class="mut">T7</div><div class="mut">CN</div>${grid}</div></div>
   <div class="row" style="justify-content:space-between;margin:4px 0 8px"><b>Tuần ${dm(tuan[0])} – ${dm(tuan[6])}</b>${quyen?'<button id="them">+ Thêm lịch</button>':''}</div>
   ${tuan.map(d=>{const l=(ev||[]).filter(e=>e.ngay===d);return `<div style="margin:8px 0 2px;font-weight:700;color:${d===hom?'var(--pri)':'inherit'}">${TH[pd(d).getDay()]} ${dm(d)}</div>${l.map(the).join('')||'<div class="mut" style="margin-bottom:6px">Chưa có lịch</div>'}`}).join('')}`;
  document.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{chon=b.dataset.d;const n=pd(chon);view={y:n.getFullYear(),m:n.getMonth()};dung()});
  $('#pv').onclick=()=>{view.m--;if(view.m<0){view.m=11;view.y--}chon=iso(new Date(view.y,view.m,1));dung()};
  $('#nx').onclick=()=>{view.m++;if(view.m>11){view.m=0;view.y++}chon=iso(new Date(view.y,view.m,1));dung()};
  if($('#them'))$('#them').onclick=()=>form(null);
  document.querySelectorAll('[data-xoa]').forEach(b=>b.onclick=()=>A().xoaMuc('lich_cong_tac',b.dataset.xoa,'Xóa vĩnh viễn lịch này?',ve));
  document.querySelectorAll('[data-sua]').forEach(b=>b.onclick=()=>form(emap[b.dataset.sua]));
}

async function form(e){
  const {esc,toast}=A();
  const [{data:ks},{data:PL},{data:LD}]=await Promise.all([A().sb.rpc('ds_khoa'),A().sb.rpc('ds_nguoi_truc'),A().sb.rpc('ds_lanh_dao')]);
  const khoa=(ks||[]).map(k=>{const b=f(k.ten).replace(/^(khoa|phong) /,'');return{id:k.id,al:[b,f(k.ten),...(b==='ban giam doc'?['bgd','ban giam doc']:[]),...(b==='kham benh'?['kb']:[])]}});
  let amb=[],thieu=[],ghi='';
  const sua=!!e;let sel=new Set(e?e.tp:[]),kh=new Set();
  const ui=()=>{
    $('#nd').innerHTML=`<button class="sec" id="lui">← Quay lại</button><div class="card" style="margin-top:10px">
    ${sua?'':`<label>Dán nhanh (app tự tách ngày, giờ, địa điểm, thành phần)</label><textarea id="dan" placeholder="Ví dụ: Họp giao ban 8h-9h ngày 12/11 tại phòng họp. Thành phần: BS Quốc, DS Thành, KHTH"></textarea><button class="sec" id="pt" style="margin-top:6px">Phân tích</button>${ghi?`<div class="mut" style="margin-top:6px">${esc(ghi)}</div>`:''}
    ${amb.map((a,i)=>`<div class="card" style="margin:8px 0"><div class="mut">Có nhiều người tên "${esc(a.tok)}", chọn đúng người:</div>${a.ids.map(id=>{const p=PL.find(x=>x.id===id);return `<button class="sec" data-pick="${i}|${id}" style="margin:4px 4px 0 0">${esc(p.ho_ten)} · ${esc((p.khoa||'').replace(/^(KHOA|PHÒNG) /,''))}${p.nam_sinh?' · '+p.nam_sinh:''}</button>`}).join('')}</div>`).join('')}
    ${thieu.length?`<div class="banner">Không tìm thấy: ${thieu.map(esc).join(', ')}. Thêm tay ở phần Thành phần bên dưới.</div>`:''}`}
    <label>Ngày</label><input id="ng" type="date" value="${e?e.ngay:chon}">
    <div class="row"><div style="flex:1"><label>Từ giờ</label><input id="g1" type="time" value="${e?hm(e.gio_bd):''}"></div><div style="flex:1"><label>Đến giờ</label><input id="g2" type="time" value="${e?hm(e.gio_kt):''}"></div></div>
    <label>Nội dung</label><textarea id="nd2">${e?esc(e.noi_dung):''}</textarea><label>Địa điểm</label><input id="dd" value="${e?esc(e.dia_diem||''):''}">
    <label>Thành phần tham dự (app sẽ nhắn cho từng người)</label>
    <div class="mut">Khoa/phòng (chỉ nhắn trưởng khoa và ĐD trưởng):</div>
    <div id="kchips" style="margin:4px 0">${[...kh].map(i=>{const k=(ks||[]).find(x=>x.id===i);const l=(LD||[]).filter(x=>x.khoa_id===i).map(x=>x.ho_ten).join(', ');return `<span class="tag" data-xk="${i}" style="margin:2px;padding:4px 10px">${esc(k?k.ten:'?')}${l?' → '+esc(l):''} ✕</span>`}).join('')||'<span class="mut">Chưa chọn</span>'}</div>
    <input id="timk" placeholder="Gõ tên khoa/phòng để thêm…"><div id="kqk"></div>
    <div class="mut" style="margin-top:8px">Từng người:</div><div id="chips" style="margin:4px 0">${[...sel].map(i=>`<span class="tag" data-x="${i}" style="margin:2px;padding:4px 10px">${esc((ten[i]||{}).ho_ten||'?')} ✕</span>`).join('')||'<span class="mut">Chưa chọn</span>'}</div>
    <input id="tim" placeholder="Gõ tên để thêm…"><div id="kq"></div>
    <label style="font-weight:400;margin-top:10px"><input id="rt" type="checkbox" style="width:auto" ${e&&e.rieng_tu?'checked':''}> Lịch riêng (chỉ thành phần mới thấy)</label>
    <button class="full" id="luu">${sua?'Lưu và nhắn người liên quan':'Tạo lịch và nhắn thành phần'}</button>${sua?'<button class="full dng" id="huy">Hủy lịch này</button>':''}<p class="mut" id="loi"></p></div>`;
    $('#lui').onclick=dung;
    if($('#pt'))$('#pt').onclick=()=>{
      const txt=$('#dan').value;if(!txt.trim())return;keep();
      const r=phanTich(txt,iso(new Date()));
      if(r.ngay)e.ngay=r.ngay;if(r.gio_bd)e.gio_bd=r.gio_bd;if(r.gio_kt)e.gio_kt=r.gio_kt;if(r.dia_diem)e.dia_diem=r.dia_diem;if(r.noi_dung)e.noi_dung=r.noi_dung;
      amb=[];thieu=[];let ok=0;
      for(const tok of r.tp){const x=timNguoi(tok,PL,khoa);
        if(x.khoa){x.khoa.forEach(i=>kh.add(i));ok++}
        else if(x.ids.length===1){sel.add(x.ids[0]);ok++}
        else if(x.ids.length>1)amb.push({tok,ids:x.ids});
        else thieu.push(tok)}
      ghi=`Đã tách: ${r.ngay?'ngày '+r.ngay.split('-').reverse().join('/'):'chưa thấy ngày'}${r.gio_bd?', '+r.gio_bd+(r.gio_kt?'–'+r.gio_kt:''):', chưa thấy giờ'}; thành phần: ${ok} khớp${amb.length?', '+amb.length+' cần chọn':''}${thieu.length?', '+thieu.length+' không thấy':''}. Kiểm tra lại các ô bên dưới.`;
      ui();
    };
    document.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const [i,id]=b.dataset.pick.split('|');keep();sel.add(id);amb.splice(+i,1);ui()});
    document.querySelectorAll('[data-xk]').forEach(c=>c.onclick=()=>{kh.delete(c.dataset.xk);keep();ui()});
    $('#timk').oninput=()=>{const q=f($('#timk').value.trim());$('#kqk').innerHTML=q?(ks||[]).filter(k=>f(k.ten).includes(q)&&!kh.has(k.id)).slice(0,8).map(k=>`<div class="card" data-ak="${k.id}" style="padding:8px 12px;margin:4px 0">${esc(k.ten)}</div>`).join(''):'';
      document.querySelectorAll('[data-ak]').forEach(c=>c.onclick=()=>{kh.add(c.dataset.ak);keep();ui()})};
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
