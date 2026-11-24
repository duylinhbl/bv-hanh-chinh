// Tra cứu Từ điển dữ liệu dùng chung ngành Y tế (QĐ 3600/QĐ-BYT ngày 20/11/2026)
// Dữ liệu ở bảng tu_dien_dl / tu_dien_linh_vuc; trường bệnh viện đang dùng ở tu_dien_chon.
(()=>{
const A=()=>window.BVAPP,$=s=>document.querySelector(s);
const esc=s=>A().esc(s);
const kd=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();
const GH=80;                      // tối đa 80 dòng mỗi lần tra, tránh tải nặng trên điện thoại
let LV=[], DEM=null, st={man:'lv', q:'', lv:null, cde:false}, CHON=null;

// Chỉ hiện lĩnh vực ĐÃ NẠP dữ liệu. Bệnh viện chỉ dùng 4/8 lĩnh vực; 4 lĩnh vực còn lại
// vẫn giữ trong danh mục để sau này cần thì nạp thêm, nhưng không bày ra cho người dùng.
async function napLV(){ if(LV.length)return LV;
  const [{data:lv},d]=await Promise.all([A().sb.from('tu_dien_linh_vuc').select('*').order('thu_tu'), demLV()]);
  LV=(lv||[]).filter(x=>d[x.id]); return LV }
async function demLV(){ if(DEM)return DEM;
  const {data}=await A().sb.from('tu_dien_dl').select('lv');
  const d={}; (data||[]).forEach(r=>d[r.lv]=(d[r.lv]||0)+1); DEM=d; return d }
async function napChon(){ if(CHON)return CHON;
  const {data}=await A().sb.from('tu_dien_chon').select('dl_id,ghi_chu').eq('nguoi_id',A().me.id);
  CHON=new Map((data||[]).map(r=>[r.dl_id,r.ghi_chu||''])); return CHON }

async function ve(){
  const n=$('#nd'); n.innerHTML='Đang tải…';
  try{ await Promise.all([napLV(),napChon()]); }catch(e){ return n.innerHTML='<p class="mut">Lỗi: '+esc(e.message||e)+'</p>' }
  if(!LV.length)return n.innerHTML='<p class="mut">Chưa nạp dữ liệu từ điển.</p>';
  n.innerHTML=`<div class="hero"><div class="hi"><b>🔎 Tra cứu từ điển dữ liệu y tế</b>
    <span class="mut">Quyết định 3600/QĐ-BYT ngày 20/11/2026 · chuẩn tên, định nghĩa, kiểu, độ dài của các trường dữ liệu khi bệnh viện kết nối, chia sẻ dữ liệu (HIS/LIS/EMR, báo cáo, liên thông)</span></div></div>
  <div class="row tcnav" style="gap:6px;margin-bottom:10px">
    <button class="sec ${st.man==='lv'?'on':''}" data-m="lv">Lĩnh vực</button>
    <button class="sec ${st.man==='tim'?'on':''}" data-m="tim">Tìm trường</button>
    <button class="sec ${st.man==='bo'?'on':''}" data-m="bo">Bộ của BV (${CHON.size})</button>
  </div><div id="tcnd"></div>`;
  document.querySelectorAll('.tcnav button').forEach(b=>b.onclick=()=>{st.man=b.dataset.m;ve()});
  ({lv:veLV,tim:veTim,bo:veBo})[st.man]();
}

async function veLV(){
  const o=$('#tcnd'); o.innerHTML='<p class="mut">Đang đếm…</p>';
  const d=await demLV(); if(!$('#tcnd'))return;
  const tong=Object.values(d).reduce((a,b)=>a+b,0);
  o.innerHTML=`<p class="mut">Tổng <b>${tong}</b> trường dữ liệu, ${LV.length} lĩnh vực. Bấm một lĩnh vực để xem danh sách trường.</p>
  <div class="luoi">${LV.map(l=>`<div class="card" data-lv="${l.id}" style="cursor:pointer">
    <h3>${esc(l.ten)}</h3><div class="row"><span class="tag bq">${d[l.id]||0} trường</span></div>
    <div class="mut">${esc(l.don_vi||'')}${l.can_cu?'<br>'+esc(l.can_cu):''}</div></div>`).join('')}</div>`;
  o.querySelectorAll('[data-lv]').forEach(c=>c.onclick=()=>{st.lv=+c.dataset.lv;st.q='';st.man='tim';ve()});
}

function khungTim(){
  return `<div class="card"><label>Từ khóa <small class="mut">(gõ không dấu cũng ra)</small>
    <input id="tcq" placeholder="vd: ma benh, ho ten, ngay sinh" value="${esc(st.q)}"></label>
    <label>Lĩnh vực<select id="tclv"><option value="">— Tất cả —</option>${LV.map(l=>`<option value="${l.id}" ${st.lv===l.id?'selected':''}>${esc(l.ten)}</option>`).join('')}</select></label>
    <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="tccde" ${st.cde?'checked':''}> Chỉ trường có mã CDE</label>
    <button class="full" id="tcgo">Tra cứu</button></div>`;
}
async function veTim(){
  const o=$('#tcnd');
  o.innerHTML=`<div class="hai"><div>${khungTim()}</div><div id="tckq"><p class="mut">Nhập từ khóa hoặc chọn lĩnh vực rồi bấm Tra cứu.</p></div></div>`;
  const go=()=>{st.q=$('#tcq').value;st.lv=$('#tclv').value?+$('#tclv').value:null;st.cde=$('#tccde').checked;chay()};
  $('#tcgo').onclick=go; $('#tcq').onkeydown=e=>{if(e.key==='Enter')go()};
  if(st.q||st.lv)chay();
}
async function chay(){
  const o=$('#tckq'); if(!o)return; o.innerHTML='<p class="mut">Đang tra…</p>';
  let q=A().sb.from('tu_dien_dl').select('*').order('id').limit(GH);
  const k=kd(st.q); if(k)q=q.ilike('kd','%'+k+'%');
  if(st.lv)q=q.eq('lv',st.lv);
  if(st.cde)q=q.neq('cde','');
  const {data,error}=await q; if(!$('#tckq'))return;
  if(error)return o.innerHTML='<p class="mut">Lỗi: '+esc(error.message)+'</p>';
  if(!data.length)return o.innerHTML='<p class="mut">Không tìm thấy trường nào khớp.</p>';
  o.innerHTML=`<p class="mut">${data.length>=GH?'Hiện '+GH+' kết quả đầu, gõ thêm từ khóa để thu hẹp.':data.length+' kết quả.'}</p>`+data.map(dong).join('');
  ganDong(o,data);
}
const tenLV=id=>(LV.find(l=>l.id===id)||{}).ten||'';
const dong=r=>`<div class="card v" data-id="${r.id}" style="cursor:pointer"><h3>${esc(r.ten||r.truong||'(không có tên)')}</h3>
  <div class="row">${r.ma_cn?`<span class="tag">${esc(r.ma_cn)}</span>`:''}${r.cde?`<span class="tag grn">CDE ${esc(r.cde)}</span>`:''}${r.kieu?`<span class="tag bq">${esc(r.kieu)}${r.dai?'('+esc(r.dai)+')':''}</span>`:''}${CHON.has(r.id)?'<span class="tag amb">★ BV dùng</span>':''}</div>
  <div class="mut">${esc(tenLV(r.lv))}${r.csdl?' · '+esc(r.csdl):''}${r.nhom?' · '+esc(r.nhom):''}</div></div>`;
const ganDong=(o,data)=>o.querySelectorAll('[data-id]').forEach(c=>c.onclick=()=>chiTiet(data.find(x=>x.id==c.dataset.id)));

function chiTiet(r){
  if(!r)return;
  const ct=CHON.has(r.id), g=CHON.get(r.id)||'';
  const d=(k,v)=>v?`<div class="mut" style="margin-top:6px">${k}</div><div>${esc(v)}</div>`:'';
  const cu=$('#tcct'); if(cu)cu.remove();
  const n=$('#nd');
  n.insertAdjacentHTML('afterbegin',`<div class="card" id="tcct" style="border-color:var(--pri)">
    <div class="row" style="justify-content:space-between"><b>${esc(r.ten||r.truong||'(không có tên)')}</b><a href="#" id="tcdong">✕</a></div>
    ${d('Mã chuẩn ngành',r.ma_cn)}${d('Mã CDE',r.cde)}${d('Định nghĩa',r.dinh_nghia)}${d('Ngữ cảnh sử dụng',r.ngu_canh)}
    ${d('Tên trường kỹ thuật',r.truong)}${d('Kiểu dữ liệu',r.kieu+(r.dai?' ('+r.dai+')':''))}${d('Định dạng',r.dinh_dang)}
    ${d('Lĩnh vực',tenLV(r.lv))}${d('Cơ sở dữ liệu',r.csdl)}${d('Nhóm',r.nhom)}${d('Căn cứ pháp lý',r.can_cu)}${d('Ghi chú',r.ghi_chu)}
    ${r.trang?`<div class="mut" style="margin-top:6px">Trang ${r.trang} của phụ lục QĐ 3600/QĐ-BYT — đối chiếu bản gốc khi dùng chính thức</div>`:''}
    <label style="margin-top:10px">Cột tương ứng trong HIS/LIS của bệnh viện (tùy chọn)<input id="tcgc" value="${esc(g)}" placeholder="vd: BENHNHAN.HOTEN"></label>
    <button class="full ${ct?'dng':''}" id="tcsao">${ct?'✕ Bỏ khỏi bộ của bệnh viện':'★ Lưu vào bộ của bệnh viện'}</button></div>`);
  $('#tcct').scrollIntoView({block:'start'});
  $('#tcdong').onclick=e=>{e.preventDefault();$('#tcct').remove()};
  $('#tcsao').onclick=async()=>{
    const b=$('#tcsao'); b.disabled=true;
    try{
      if(ct){ const {error}=await A().sb.from('tu_dien_chon').delete().eq('nguoi_id',A().me.id).eq('dl_id',r.id);
        if(error)throw error; CHON.delete(r.id); A().toast('Đã bỏ khỏi bộ của bệnh viện') }
      else{ const {error}=await A().sb.from('tu_dien_chon').upsert({nguoi_id:A().me.id,dl_id:r.id,ghi_chu:$('#tcgc').value.trim()||null});
        if(error)throw error; CHON.set(r.id,$('#tcgc').value.trim()); A().toast('Đã lưu vào bộ của bệnh viện') }
      ve();
    }catch(e){ b.disabled=false; A().toast('Lỗi: '+(e.message||e)) }
  };
}

async function veBo(){
  const o=$('#tcnd');
  if(!CHON.size)return o.innerHTML='<p class="mut">Chưa chọn trường nào. Vào <b>Tìm trường</b>, mở một trường rồi bấm ★ để đưa vào bộ dùng của bệnh viện.</p>';
  o.innerHTML='<p class="mut">Đang tải…</p>';
  const {data,error}=await A().sb.from('tu_dien_dl').select('*').in('id',[...CHON.keys()]).order('lv').order('id');
  if(!$('#tcnd'))return;
  if(error)return o.innerHTML='<p class="mut">Lỗi: '+esc(error.message)+'</p>';
  o.innerHTML=`<p class="mut"><b>${data.length}</b> trường bệnh viện đang dùng. <a href="#" id="tccsv">⬇ Tải CSV (mở bằng Excel)</a></p>`+data.map(r=>
    dong(r).replace('</div></div>',`</div>${CHON.get(r.id)?`<div>HIS: <b>${esc(CHON.get(r.id))}</b></div>`:''}</div>`)).join('');
  ganDong(o,data);
  $('#tccsv').onclick=e=>{e.preventDefault();taiCSV(data)};
}
function taiCSV(data){
  const c=['Lĩnh vực','CSDL','Nhóm','Mã chuẩn','CDE','Tên trường dữ liệu','Định nghĩa','Tên kỹ thuật','Kiểu','Độ dài','Định dạng','Căn cứ','Trang','Cột trong HIS'];
  const o=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
  const csv='﻿'+[c.map(o).join(';')].concat(data.map(r=>[tenLV(r.lv),r.csdl,r.nhom,r.ma_cn,r.cde,r.ten,r.dinh_nghia,r.truong,r.kieu,r.dai,r.dinh_dang,r.can_cu,r.trang,CHON.get(r.id)].map(o).join(';'))).join('\r\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='Bo truong du lieu BV Da khoa Cao su Dau Tieng.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

window.TRACUU={ve};
})();
