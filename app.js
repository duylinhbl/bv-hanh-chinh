(()=>{
const $=s=>document.querySelector(s), app=$('#app');
const sb=supabase.createClient(BV.URL,BV.KEY,{auth:{persistSession:true,autoRefreshToken:true}});
let me=null, tab='toi', DB={}, PHAT=false;
const ten=id=>(DB[id]&&DB[id].ho_ten)||'(không rõ)';
async function napDanhBa(){const {data}=await sb.from('danh_ba').select('id,ho_ten,chuc_vu').order('ho_ten');DB={};(data||[]).forEach(u=>DB[u.id]=u);return data||[]}
const TT={moi:'Mới',dang_lam:'Đang làm',cho_xac_nhan:'Chờ xác nhận',da_dong:'Đã đóng',huy:'Hủy'};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=d=>d?new Date(d).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
const uid=()=>crypto.randomUUID();
window.BVAPP={sb,$,esc,fmt,toast,get me(){return me}};
function toast(m){const t=$('#toast');t.textContent=m;t.className='on';setTimeout(()=>t.className='',2600)}
const tag=s=>`<span class="tag ${s==='da_dong'?'grn':s==='cho_xac_nhan'?'amb':''}">${TT[s]||s}</span>`;

// ---- hàng đợi offline (IndexedDB) ----
const idb=new Promise((res,rej)=>{const r=indexedDB.open('bv',1);r.onupgradeneeded=()=>r.result.createObjectStore('q',{keyPath:'ma_khach'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const qop=async(m,f)=>{const db=await idb;return new Promise((res,rej)=>{const t=db.transaction('q',m),s=t.objectStore('q'),r=f(s);t.oncomplete=()=>res(r.result);t.onerror=()=>rej(t.error)})};
const qAdd=o=>qop('readwrite',s=>s.put(o)), qAll=()=>qop('readonly',s=>s.getAll()), qDel=k=>qop('readwrite',s=>s.delete(k));
async function guiMot(o){
  let path=null;
  if(o.anh){path=`${o.viec_id}/${o.ma_khach}.jpg`;
    const {error}=await sb.storage.from('anh').upload(path,o.anh,{contentType:'image/jpeg',upsert:true});
    if(error)throw error}
  const {error}=await sb.from('cap_nhat_hien_trang').insert({viec_id:o.viec_id,nguoi_id:me.id,trang_thai:o.trang_thai,ghi_chu:o.ghi_chu,anh_path:path,vi_do:o.vi_do,kinh_do:o.kinh_do,gio_bam:o.gio_bam,ma_khach:o.ma_khach});
  if(error&&error.code!=='23505')throw error; // trùng mã = đã gửi rồi
  if(o.trang_thai){const {error:e2}=await sb.from('viec').update({trang_thai:o.trang_thai,...(o.trang_thai==='da_dong'?{dong_luc:new Date().toISOString()}:{})}).eq('id',o.viec_id);if(e2)throw e2}
}
let dangDay=false;
async function day(){
  if(dangDay||!me||!navigator.onLine)return;dangDay=true;
  try{for(const o of await qAll()){try{await guiMot(o);await qDel(o.ma_khach)}catch(e){console.warn(e);break}}}finally{dangDay=false}
  const n=(await qAll()).length;const b=$('#hang');if(b)b.textContent=n?`${n} cập nhật chờ gửi`:'';
}
addEventListener('online',day);

// ---- đăng nhập ----
const email=p=>p.replace(/\D/g,'')+'@bv.local';
function manHinhDangNhap(){
  app.innerHTML=`<div class="login"><h1>BV Cao su Dầu Tiếng</h1><div class="mut">Quản lý hành chính</div>
  <label>Số điện thoại</label><input id="sdt" inputmode="tel" autocomplete="username">
  <label>Mật khẩu</label><input id="mk" type="password" autocomplete="current-password">
  <button class="full" id="vao">Đăng nhập</button><p class="mut" id="loi"></p></div>`;
  $('#vao').onclick=async()=>{
    $('#vao').disabled=true;$('#loi').textContent='';
    const {error}=await sb.auth.signInWithPassword({email:email($('#sdt').value),password:$('#mk').value});
    $('#vao').disabled=false;
    if(error)$('#loi').textContent='Sai số điện thoại hoặc mật khẩu';else khoiDong();
  };
}
function manHinhDoiMK(){
  app.innerHTML=`<div class="login"><h1>Đặt mật khẩu mới</h1><div class="mut">Lần đầu đăng nhập, hãy đổi mật khẩu của riêng bạn (tối thiểu 8 ký tự).</div>
  <label>Mật khẩu mới</label><input id="m1" type="password" autocomplete="new-password">
  <label>Nhập lại</label><input id="m2" type="password" autocomplete="new-password">
  <button class="full" id="luu">Lưu</button><p class="mut" id="loi"></p></div>`;
  $('#luu').onclick=async()=>{
    const a=$('#m1').value;if(a.length<8)return $('#loi').textContent='Ít nhất 8 ký tự';
    if(a!==$('#m2').value)return $('#loi').textContent='Hai mật khẩu chưa khớp';
    const {error}=await sb.auth.updateUser({password:a});if(error)return $('#loi').textContent=error.message;
    const r=await sb.rpc('doi_mat_khau_xong');if(r.error)return $('#loi').textContent=r.error.message;
    me.phai_doi_mat_khau=false;toast('Đã đổi mật khẩu');khung();
  };
}

// ---- khung chính ----
function khung(){
  const lanh=me.vai_tro!=='nhan_vien';
  app.innerHTML=`<header><span>${esc(me.ho_ten)}<br><small>${esc(me.chuc_vu||'')}</small></span><small><span id="hang"></span> v6</small></header>
  <main id="nd"></main>
  <nav><button data-t="toi">Việc của tôi</button>${lanh?'<button data-t="giao">Đã giao</button>':''}<button data-t="lt">Lịch trực</button><button data-t="tb">Thông báo<span id="dem" class="tag red" style="display:none;margin-left:4px"></span></button><button data-t="moi">+ Giao việc</button><button data-t="tk">Tài khoản</button></nav>`;
  document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;ve()});
  ve();day();demTB();sb.channel('tb').on('postgres_changes',{event:'*',schema:'public',table:'thong_bao_nguoi_nhan',filter:'nguoi_id=eq.'+me.id},()=>{demTB();if(tab==='tb')dsTB();else toast('Có thông báo mới')}).subscribe();
}
window.addEventListener('unhandledrejection',e=>{const n=$('#nd');if(n)n.innerHTML='<p class="mut">Lỗi: '+esc(e.reason&&e.reason.message||e.reason)+'</p>'});
function ve(){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
  ({toi:dsToi,giao:dsGiao,lt:()=>window.LICH.ve(),tb:dsTB,moi:formViec,tk:taiKhoan})[tab]();
}
const the=v=>`<div class="card" data-id="${v.id}"><h3>${esc(v.tieu_de)}</h3><div class="row">${tag(v.trang_thai)}${v.uu_tien==2?'<span class="tag red">Gấp</span>':''}${v.han?`<span class="mut">Hạn ${fmt(v.han)}</span>`:''}</div>${v.ben?`<div class="mut">${esc(v.ben)}</div>`:''}</div>`;
async function dsToi(){
  $('#nd').innerHTML='Đang tải…';try{await dsToi2()}catch(e){$('#nd').innerHTML='<p class="mut">Lỗi: '+esc(e.message||e)+'</p>'}}
async function dsToi2(){
  const {data,error}=await sb.from('viec').select('*').eq('nguoi_nhan',me.id).not('trang_thai','in','(da_dong,huy)').order('han',{nullsFirst:false});
  if(error)return $('#nd').textContent=error.message;
  $('#nd').innerHTML=data.length?data.map(v=>the({...v,ben:v.tu_giao?'Tự giao':'Giao bởi '+ten(v.nguoi_giao)})).join(''):'<p class="mut">Không có việc đang mở.</p>';
  gan();
}
async function dsGiao(){
  $('#nd').innerHTML='Đang tải…';
  const {data,error}=await sb.from('viec').select('*').neq('trang_thai','huy').order('tao_luc',{ascending:false}).limit(100);
  if(error)return $('#nd').textContent=error.message;
  $('#nd').innerHTML=data.map(v=>the({...v,ben:'Người nhận: '+ten(v.nguoi_nhan)})).join('')||'<p class="mut">Chưa có việc.</p>';
  gan();
}
const gan=()=>document.querySelectorAll('.card[data-id]').forEach(c=>c.onclick=()=>chiTiet(c.dataset.id));

async function formViec(){
  const ds=(await napDanhBa()).filter(u=>me.vai_tro!=='nhan_vien'||u.id===me.id);
  $('#nd').innerHTML=`<div class="card"><label>Việc cần làm</label><input id="tt"><label>Mô tả</label><textarea id="ms"></textarea>
  <label>Người nhận</label><select id="nn">${(ds||[]).map(u=>`<option value="${u.id}" ${u.id===me.id?'selected':''}>${esc(u.ho_ten)}${u.id===me.id?' (tôi)':''}</option>`).join('')}</select>
  <label>Hạn</label><input id="han" type="datetime-local"><label>Mức độ</label><select id="ut"><option value="1">Thường</option><option value="2">Gấp</option><option value="0">Thấp</option></select>
  <button class="full" id="g">Giao việc</button><p class="mut" id="loi"></p></div>`;
  $('#g').onclick=async()=>{
    if(!$('#tt').value.trim())return $('#loi').textContent='Nhập tên việc';
    const {error}=await sb.from('viec').insert({tieu_de:$('#tt').value.trim(),mo_ta:$('#ms').value||null,nguoi_giao:me.id,nguoi_nhan:$('#nn').value,han:$('#han').value?new Date($('#han').value).toISOString():null,uu_tien:+$('#ut').value});
    if(error)return $('#loi').textContent='Không giao được: '+error.message;
    toast('Đã giao việc');tab='toi';ve();
  };
}

async function chiTiet(id){
  const [{data:v},{data:cn}]=await Promise.all([
    sb.from('viec').select('*').eq('id',id).single(),
    sb.from('cap_nhat_hien_trang').select('*').eq('viec_id',id).order('gio_bam',{ascending:false})]);
  const urls={};
  for(const c of cn||[])if(c.anh_path){const r=await sb.storage.from('anh').createSignedUrl(c.anh_path,3600);urls[c.id]=r.data?.signedUrl}
  const laNhan=v.nguoi_nhan===me.id, laGiao=v.nguoi_giao===me.id||me.vai_tro==='tchc'||me.vai_tro==='bgd';
  const opts=[];if(laNhan){opts.push(['dang_lam','Đang làm'],['cho_xac_nhan','Báo hoàn thành (chờ xác nhận)'])}
  if(laGiao&&v.nguoi_giao===me.id)opts.push(['da_dong','Xác nhận đóng việc']);
  $('#nd').innerHTML=`<button class="sec" id="lui">← Quay lại</button>
  <div class="card" style="margin-top:10px"><h3>${esc(v.tieu_de)}</h3>${tag(v.trang_thai)}<p>${esc(v.mo_ta||'')}</p>
  <div class="mut">Giao: ${esc(ten(v.nguoi_giao))} → ${esc(ten(v.nguoi_nhan))}${v.han?'<br>Hạn '+fmt(v.han):''}</div></div>
  ${(laNhan||opts.length)?`<div class="card"><label>Cập nhật hiện trạng</label><select id="st"><option value="">Giữ nguyên trạng thái</option>${opts.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
  <label>Ghi chú</label><textarea id="gc"></textarea><label>Ảnh (chụp tại chỗ)</label><input id="anh" type="file" accept="image/*" capture="environment">
  <button class="full" id="gui">Gửi cập nhật</button><p class="mut">Vị trí GPS chỉ lấy tại lúc bấm Gửi.</p></div>`:''}
  <div class="timeline">${(cn||[]).map(c=>`<div class="it"><b>${esc(ten(c.nguoi_id))}</b> <span class="mut">${fmt(c.gio_bam)}</span> ${c.trang_thai?tag(c.trang_thai):''}<div>${esc(c.ghi_chu||'')}</div>${urls[c.id]?`<img src="${urls[c.id]}">`:''}${c.co_vi_tri?`<div class="mut"><a href="https://maps.google.com/?q=${c.vi_do},${c.kinh_do}" target="_blank" rel="noopener">📍 Xem vị trí</a></div>`:''}</div>`).join('')||'<p class="mut">Chưa có cập nhật.</p>'}</div>`;
  $('#lui').onclick=ve;
  if($('#gui'))$('#gui').onclick=()=>guiCapNhat(id);
}
const nen=f=>new Promise(res=>{if(!f)return res(null);const i=new Image();i.onload=()=>{const k=Math.min(1,1600/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(b=>res(b),'image/jpeg',.8)};i.onerror=()=>res(null);i.src=URL.createObjectURL(f)});
const viTri=()=>new Promise(res=>{if(!navigator.geolocation)return res({});navigator.geolocation.getCurrentPosition(p=>res({vi_do:p.coords.latitude,kinh_do:p.coords.longitude}),()=>res({}),{enableHighAccuracy:true,timeout:8000,maximumAge:0})});
async function guiCapNhat(id){
  const b=$('#gui');b.disabled=true;
  const gio=new Date().toISOString(), gps=await viTri(), anh=await nen($('#anh').files[0]);
  const o={ma_khach:uid(),viec_id:id,trang_thai:$('#st').value||null,ghi_chu:$('#gc').value.trim()||null,anh,gio_bam:gio,...gps};
  if(!o.ghi_chu&&!anh&&!o.trang_thai){b.disabled=false;return toast('Chưa có nội dung')}
  await qAdd(o);await day();
  toast((await qAll()).length?'Đã lưu, sẽ gửi khi có mạng':gps.vi_do?'Đã gửi (có vị trí)':'Đã gửi (không lấy được vị trí)');
  chiTiet(id);
}

async function demTB(){
  const {count}=await sb.from('thong_bao_nguoi_nhan').select('*',{count:'exact',head:true}).eq('nguoi_id',me.id).is('da_doc_luc',null);
  const e=$('#dem');if(!e)return;e.textContent=count||'';e.style.display=count?'inline-block':'none';
  try{navigator.setAppBadge&&(count?navigator.setAppBadge(count):navigator.clearAppBadge())}catch(_){}
}
async function dsTB(){
  $('#nd').innerHTML='Đang tải…';
  try{
    const [{data:tbs,error},{data:rc}]=await Promise.all([
      sb.from('thong_bao').select('*').order('tao_luc',{ascending:false}).limit(50),
      sb.from('thong_bao_nguoi_nhan').select('thong_bao_id,da_doc_luc').eq('nguoi_id',me.id)]);
    if(error)throw error;
    const doc={};(rc||[]).forEach(r=>doc[r.thong_bao_id]=r.da_doc_luc);
    $('#nd').innerHTML=(PHAT?'<button class="full" id="pt">+ Phát thông báo</button><div style="height:10px"></div>':'')+
      ((tbs||[]).map(t=>{const chua=(t.id in doc)&&!doc[t.id];
        return `<div class="card" data-tb="${t.id}" style="${chua?'border-color:var(--pri);border-width:2px':''}"><h3>${t.khan?'🔴 ':''}${esc(t.tieu_de)}</h3><div class="mut">${esc(ten(t.nguoi_phat))} · ${fmt(t.tao_luc)} ${chua?'<span class="tag red">Chưa đọc</span>':''}</div></div>`}).join('')||'<p class="mut">Chưa có thông báo.</p>');
    document.querySelectorAll('[data-tb]').forEach(c=>c.onclick=()=>chiTietTB(c.dataset.tb));
    if($('#pt'))$('#pt').onclick=formTB;
  }catch(e){$('#nd').innerHTML='<p class="mut">Lỗi: '+esc(e.message||e)+'</p>'}
}
async function chiTietTB(id){
  const {data:t}=await sb.from('thong_bao').select('*').eq('id',id).single();
  const {data:r}=await sb.from('thong_bao_nguoi_nhan').select('da_doc_luc').eq('thong_bao_id',id).eq('nguoi_id',me.id).maybeSingle();
  $('#nd').innerHTML=`<button class="sec" id="lui">← Quay lại</button><div class="card" style="margin-top:10px"><h3>${t.khan?'🔴 ':''}${esc(t.tieu_de)}</h3><div class="mut">${esc(ten(t.nguoi_phat))} · ${fmt(t.tao_luc)}</div><p style="white-space:pre-wrap">${esc(t.noi_dung)}</p>
  ${r&&!r.da_doc_luc?'<button class="full" id="doc">Đã đọc, đã hiểu</button>':r?`<div class="mut">Bạn đã đọc lúc ${fmt(r.da_doc_luc)}</div>`:''}</div><div id="th"></div>`;
  $('#lui').onclick=dsTB;
  if($('#doc'))$('#doc').onclick=async()=>{const {error}=await sb.from('thong_bao_nguoi_nhan').update({da_doc_luc:new Date().toISOString()}).eq('thong_bao_id',id).eq('nguoi_id',me.id);if(error)return toast('Lỗi: '+error.message);toast('Đã xác nhận');demTB();chiTietTB(id)};
  const {data:th}=await sb.rpc('tinh_hinh_doc',{p_tb:id});
  if(th&&th.length){const d=th.filter(x=>x.da_doc_luc).length;
    $('#th').innerHTML=`<div class="card"><h3>Tình hình đọc: ${d}/${th.length}</h3>${th.map(x=>`<div class="row" style="justify-content:space-between"><span>${x.da_doc_luc?'✅':'⬜'} ${esc(x.ho_ten)} <span class="mut">${esc(x.khoa||'')}</span></span><span class="mut">${x.da_doc_luc?fmt(x.da_doc_luc):'chưa đọc'}</span></div>`).join('')}</div>`}
}
async function formTB(){
  const {data:ks}=await sb.rpc('ds_khoa');
  $('#nd').innerHTML=`<button class="sec" id="lui">← Quay lại</button><div class="card" style="margin-top:10px"><label>Tiêu đề</label><input id="tt"><label>Nội dung</label><textarea id="nd2" style="min-height:140px"></textarea>
  <label>Nơi nhận</label><select id="pv"><option value="all">Toàn viện</option><option value="chon">Chọn khoa/phòng…</option></select>
  <div id="ks" style="display:none">${(ks||[]).map(k=>`<label style="font-weight:400;margin:6px 0"><input type="checkbox" value="${k.id}" style="width:auto"> ${esc(k.ten)}</label>`).join('')}</div>
  <label style="font-weight:400"><input id="kh" type="checkbox" style="width:auto"> Khẩn (nhắc lại sớm)</label>
  <button class="full" id="ph">Phát thông báo</button><p class="mut" id="loi"></p></div>`;
  $('#lui').onclick=dsTB;$('#pv').onchange=()=>$('#ks').style.display=$('#pv').value==='chon'?'block':'none';
  $('#ph').onclick=async()=>{
    const toan=$('#pv').value==='all', ids=[...document.querySelectorAll('#ks input:checked')].map(x=>x.value);
    $('#ph').disabled=true;
    const {error}=await sb.rpc('phat_thong_bao',{p_tieu_de:$('#tt').value,p_noi_dung:$('#nd2').value,p_khan:$('#kh').checked,p_nhac_gio:$('#kh').checked?2:24,p_toan_vien:toan,p_khoa:ids});
    $('#ph').disabled=false;if(error)return $('#loi').textContent=error.message;
    toast('Đã phát thông báo');dsTB();
  };
}
function taiKhoan(){
  $('#nd').innerHTML=`<div class="card"><h3>${esc(me.ho_ten)}</h3><div class="mut">${esc(me.chuc_vu||'')}<br>${esc(me.so_dien_thoai)}</div><button class="sec full" id="ra">Đăng xuất</button></div>`;
  $('#ra').onclick=async()=>{await sb.auth.signOut();me=null;manHinhDangNhap()};
}

async function khoiDong(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return manHinhDangNhap();
  const {data,error}=await sb.from('nguoi_dung').select('*').eq('auth_id',session.user.id).single();
  if(error||!data){await sb.auth.signOut();return manHinhDangNhap()}
  me=data;await napDanhBa();PHAT=!!(await sb.rpc('duoc_phat')).data;me.phai_doi_mat_khau?manHinhDoiMK():khung();
}
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
khoiDong();
})();
