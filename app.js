(()=>{
const $=s=>document.querySelector(s), app=$('#app');
const sb=supabase.createClient(BV.URL,BV.KEY,{auth:{persistSession:true,autoRefreshToken:true}});
let me=null, tab='toi', DB={}, PHAT=false;
const TRA_CUU=true;    // bật/tắt menu Tra cứu (xem ghi chú ở hàm dựng thanh điều hướng)
const ten=id=>(DB[id]&&DB[id].ho_ten)||'(không rõ)';
async function napDanhBa(){const {data}=await sb.from('danh_ba').select('id,ho_ten,chuc_vu').order('ho_ten');DB={};(data||[]).forEach(u=>DB[u.id]=u);return data||[]}
const TT={moi:'Mới',dang_lam:'Đang làm',cho_xac_nhan:'Chờ xác nhận',da_dong:'Đã đóng',huy:'Hủy'};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=d=>d?new Date(d).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
const uid=()=>crypto.randomUUID();
const TEP_DUOI=['doc','docx','xls','xlsx','pdf'],TEP_MAX=10*1024*1024;
const TEP_MIME={doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pdf:'application/pdf'};
const duoiTep=n=>((n||'').split('.').pop()||'').toLowerCase();
const kiemTep=f=>!f?null:!TEP_DUOI.includes(duoiTep(f.name))?'Chỉ nhận file Word (.doc, .docx), Excel (.xls, .xlsx) hoặc PDF':f.size>TEP_MAX?'File quá 10 MB':null;
const bieuTuongTep=n=>/^xls/.test(duoiTep(n))?'📊':duoiTep(n)==='pdf'?'📕':/^(jpe?g|png|webp)$/.test(duoiTep(n))?'🖼':'📄';
async function linkTep(path,ten){const r=await sb.storage.from('anh').createSignedUrl(path,3600,{download:ten||true});return r.data?.signedUrl||null}
window.BVAPP={xoaMuc,sb,$,esc,fmt,toast,troLy,chiTiet,khungSoan,ban,veTab(t){doiTab(t)},get me(){return me}};
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
  let fpath=null;
  if(o.tep){const d=duoiTep(o.tep_ten);fpath=`${o.viec_id}/${o.ma_khach}-f.${d}`;
    const {error}=await sb.storage.from('anh').upload(fpath,o.tep,{contentType:TEP_MIME[d],upsert:true});
    if(error)throw error}
  const {error}=await sb.from('cap_nhat_hien_trang').insert({viec_id:o.viec_id,nguoi_id:me.id,trang_thai:o.trang_thai,buoc:Number.isInteger(o.buoc)?o.buoc:null,ghi_chu:o.ghi_chu,anh_path:path,file_path:fpath,file_ten:o.tep?o.tep_ten:null,vi_do:o.vi_do,kinh_do:o.kinh_do,vi_tri_loi:o.vi_tri_loi||null,do_chinh_xac:o.do_chinh_xac||null,gio_bam:o.gio_bam,ma_khach:o.ma_khach});
  if(error&&error.code!=='23505')throw error; // trùng mã = đã gửi rồi
  if(o.trang_thai){const {error:e2}=await sb.from('viec').update({trang_thai:o.trang_thai,...(o.trang_thai==='da_dong'?{dong_luc:new Date().toISOString()}:{})}).eq('id',o.viec_id);if(e2)throw e2}
}
let dangDay=false;
async function day(){
  if(dangDay||!me||!navigator.onLine)return;dangDay=true;
  let loiCuoi='';
  try{for(const o of await qAll()){
    if(o.hong)continue;
    try{await guiMot(o);await qDel(o.ma_khach)}
    catch(e){const m=String(e&&e.message||e);console.warn(m);loiCuoi=m;
      const n=(o.so_loi||0)+1;
      if(n>=3){await qDel(o.ma_khach);await qAdd({...o,ma_khach:'hong-'+o.ma_khach,hong:true,loi:m,anh:null,tep:null})}
      else await qAdd({...o,so_loi:n});
      if(!navigator.onLine)break}
  }}finally{dangDay=false}
  await demHang(loiCuoi);
}
// Đếm việc còn trong hàng đợi. Một mục hỏng hẳn không được chặn các mục sau; bấm vào để xem lý do và bỏ.
async function demHang(loi){
  const ds=await qAll(),cho=ds.filter(o=>!o.hong),hong=ds.filter(o=>o.hong),b=$('#hang');
  if(!b)return;
  b.textContent=hong.length?`⚠ ${hong.length} cập nhật gửi hỏng`:cho.length?`${cho.length} cập nhật chờ gửi`:'';
  b.style.cursor=ds.length?'pointer':'';
  b.onclick=!ds.length?null:async()=>{
    if(hong.length){
      if(!confirm(hong.length+' cập nhật không gửi được (đã thử 3 lần):\n\n'+hong.map(o=>'• '+(o.ghi_chu||'(không ghi chú)')+'\n  Lỗi: '+(o.loi||'')).join('\n')+'\n\nBỏ các mục này đi?'))return;
      for(const o of hong)await qDel(o.ma_khach);
      toast('Đã bỏ');await demHang('')}
    else{toast('Đang thử gửi lại…');await day()}};
  if(loi&&hong.length)toast('Có cập nhật không gửi được: '+loi.slice(0,90));
}
addEventListener('online',day);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)day()});

// ---- đăng nhập ----
const email=p=>p.replace(/\D/g,'')+'@bv.local';
function manHinhDangNhap(){
  app.innerHTML=`<div class="login"><img class="lg" src="logo.png" alt="" width="36" height="36"><h1>Bệnh viện Đa khoa Cao su Dầu Tiếng</h1><div class="mut">Quản lý hành chính</div>
  <label for="sdt">Số điện thoại</label><input id="sdt" name="sdt" inputmode="tel" autocomplete="username" spellcheck="false" enterkeyhint="next" placeholder="vd: 0909…">
  <label for="mk">Mật khẩu</label><input id="mk" name="mk" type="password" autocomplete="current-password" enterkeyhint="go">
  <button class="full" id="vao">🔑 Đăng nhập</button><p class="mut" id="loi" role="alert"></p></div>`;
  // Enter ở ô mật khẩu là đăng nhập luôn, khỏi phải với tay bấm nút
  $('#mk').onkeydown=e=>{if(e.key==='Enter')$('#vao').click()};
  $('#sdt').onkeydown=e=>{if(e.key==='Enter')$('#mk').focus()};
  $('#vao').onclick=async()=>{
    ban($('#vao'));$('#loi').textContent='';
    const {error}=await sb.auth.signInWithPassword({email:email($('#sdt').value),password:$('#mk').value});
    ban($('#vao'),false);
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
// Nút đang xử lý thì GIỮ NGUYÊN nhãn và thêm vòng xoay (aria-busy), không đổi chữ:
// đổi chữ làm người dùng mất chỗ bám và nút nhảy kích thước.
// Nhiều thẻ trong app là <div> bấm được (thẻ việc, thẻ thông báo, dòng bảng).
// Chuột thì bấm được, nhưng bàn phím thì không tới được. Mỗi lần màn hình vẽ lại,
// gắn role=button + tabindex cho chúng và cho Enter/Space hoạt động như một cú bấm.
const BAM='[data-id],[data-tb],[data-ex],[data-lv],.tb tbody tr';
function nutHoa(goc){
  (goc||document).querySelectorAll(BAM).forEach(el=>{
    if(el.hasAttribute('role')||el.tagName==='BUTTON'||el.tagName==='A')return;
    el.setAttribute('role','button'); el.setAttribute('tabindex','0');
  });
}
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const el=e.target.closest&&e.target.closest(BAM);
  if(!el||el.tagName==='BUTTON'||el.tagName==='A'||el.tagName==='INPUT'||el.tagName==='TEXTAREA')return;
  e.preventDefault(); el.click();
});
new MutationObserver(()=>nutHoa()).observe(document.documentElement,{childList:true,subtree:true});

function ban(b,on=true){ if(!b)return b; b.disabled=!!on; if(on)b.setAttribute('aria-busy','true'); else b.removeAttribute('aria-busy'); return b }

function khung(){
  const lanh=me.vai_tro!=='nhan_vien';
  // Menu Tra cứu nay là TRA CỨU THUỐC (thuoc.js) — tờ hướng dẫn sử dụng do khoa Dược quản lý,
  // đúng thứ bác sĩ và điều dưỡng cần hằng ngày.
  // Tra cứu từ điển dữ liệu y tế (tc.js, bảng tu_dien_*) vẫn còn nguyên nhưng KHÔNG gắn vào menu:
  // nội dung đó thuộc mảng y tế - CNTT. Muốn mở lại thì trỏ 'tc' sang window.TRACUU.ve.
  app.innerHTML=`<header><img class="lg" src="logo.png" alt="" width="36" height="36"><span class="ten">${esc(me.ho_ten)}<small>${esc(me.chuc_vu||'')}</small></span><small><span id="hang"></span> v105</small></header>
  <main id="nd"></main>
  <nav><button data-t="toi"><svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/></svg><span>Việc</span></button>${lanh?`<button data-t="giao"><svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg><span>Giao</span></button>`:''}<button data-t="ct"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span>Lịch</span></button><button data-t="lt"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>Trực</span></button>${TRA_CUU?`<button data-t="tc"><svg viewBox="0 0 24 24"><path d="M10.5 3.5h3a4 4 0 014 4v9a4 4 0 01-4 4h-3a4 4 0 01-4-4v-9a4 4 0 014-4z"/><path d="M6.5 12h11"/></svg><span>Tra cứu</span></button>`:''}<button data-t="tb"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg><span>Tin<span id="dem" class="tag red" style="display:none;margin-left:3px;padding:0 6px"></span></span></button><button data-t="moi"><i><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6"/></svg></i><span class="l">Giao việc</span></button><button data-t="tk"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span>Tôi</span></button></nav>`;
  document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>doiTab(b.dataset.t));
  const h=(location.hash||'').slice(1); if(h&&h!==tab&&['toi','giao','ct','lt','tc','tb','moi','tk'].includes(h))tab=h;
  ve();day();demTB();sb.channel('tb').on('postgres_changes',{event:'*',schema:'public',table:'thong_bao_nguoi_nhan',filter:'nguoi_id=eq.'+me.id},()=>{demTB();if(tab==='tb')dsTB();else toast('Có thông báo mới')}).subscribe();
}
const ghiLoi=(m,ct)=>{try{if(!me||!me.id)return;const k=String(m).slice(0,200);if(ghiLoi.last===k)return;ghiLoi.last=k;sb.from('loi_app').insert({nguoi_id:me.id,ver:((document.querySelector('script[src*="app.js"]')||{}).src||'').split('v=')[1]||null,thong_diep:k,chi_tiet:String(ct||'').slice(0,1200)}).then(()=>{},()=>{})}catch(e){}};
window.addEventListener('unhandledrejection',e=>{const n=$('#nd');const m=e.reason&&e.reason.message||e.reason;if(n)n.innerHTML='<p class="mut">Lỗi: '+esc(m)+'</p>';ghiLoi('promise: '+m,e.reason&&e.reason.stack)});
window.addEventListener('error',e=>ghiLoi('js: '+e.message,(e.filename||'')+':'+e.lineno));
// Đổi tab thì ghi vào lịch sử trình duyệt. Trước đây bấm Back trên Android là THOÁT HẲN app.
function doiTab(t,tuLichSu){
  tab=t;
  if(!tuLichSu){ try{ history.pushState({tab:t},'','#'+t) }catch(e){} }
  ve();
}
window.addEventListener('popstate',e=>{
  if(!me)return;
  const t=(e.state&&e.state.tab)||(location.hash||'').slice(1)||'toi';
  if(t!==tab){ tab=t; ve() }
});
function ve(){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
  if(tab==='tc'&&!TRA_CUU)tab='toi';
  ({toi:dsToi,giao:dsGiao,ct:()=>window.LICHCT.ve(),lt:()=>window.LICH.ve(),tc:()=>window.TRACUU.ve(),tb:dsTB,moi:formViec,tk:taiKhoan})[tab]();
}
const qua=v=>v.han&&new Date(v.han)<new Date()&&!(['da_dong','huy'].includes(v.trang_thai));
// Quy trình theo bước: [{ten,goi_y,nut,xong,luc,boi,ghi,bo_qua}]
const dsBuoc=v=>Array.isArray(v&&v.cac_buoc)&&v.cac_buoc.length?v.cac_buoc:null;
const buocDang=B=>{const i=B.findIndex(b=>!b.xong);return i<0?B.length:i};
const nhanBuoc=v=>{const B=dsBuoc(v);if(!B)return '';const i=buocDang(B);
  return i>=B.length?'<span class="tag grn">Xong các bước</span>':`<span class="tag bq">Bước ${i+1}/${B.length}: ${esc(B[i].ten)}</span>`};
const the=v=>`<div class="card v ${qua(v)?'qua':v.trang_thai}" data-id="${v.id}"><h3>${esc(v.tieu_de)}</h3><div class="row">${nhanBuoc(v)||tag(v.trang_thai)}${v.uu_tien==2?'<span class="tag red">Gấp</span>':''}${qua(v)?'<span class="tag red">Quá hạn</span>':''}${v.han?`<span class="mut">Hạn ${fmt(v.han)}</span>`:''}</div>${v.ben?`<div class="mut">${esc(v.ben)}</div>`:''}</div>`;
async function dsToi(){
  $('#nd').innerHTML='Đang tải…';try{await dsToi2()}catch(e){$('#nd').innerHTML='<p class="mut">Lỗi: '+esc(e.message||e)+'</p>'}}
async function dsToi2(){
  const {data,error}=await sb.from('viec').select('*').eq('nguoi_nhan',me.id).not('trang_thai','in','(da_dong,huy)').order('han',{nullsFirst:false});
  if(error)return $('#nd').textContent=error.message;
  const nay=new Date().toDateString(),kq=data.filter(qua).length,kh=data.filter(v=>v.han&&new Date(v.han).toDateString()===nay).length,gio=new Date().getHours(),ch=gio<11?'Chào buổi sáng':gio<14?'Chào buổi trưa':gio<18?'Chào buổi chiều':'Chào buổi tối';
  const kpi=`<div class="hero"><div class="hi"><b>${ch}, ${esc((me.ho_ten||'').split(' ').slice(-1)[0])}</b><span class="mut">${data.length?'Bạn có '+data.length+' việc đang mở':'Hôm nay chưa có việc nào cho bạn'}</span></div><div class="kpi"><div class="r"><b>${kq}</b><span>Quá hạn</span></div><div class="a"><b>${kh}</b><span>Hạn hôm nay</span></div><div><b>${data.length}</b><span>Đang mở</span></div></div></div>`;
  const {sap,xa}=locGan(data,3);
  $('#nd').innerHTML=`<div class="hai"><div>${await theBatPush()}${kpi}`
    +(sap.length?sap.map(v=>the({...v,ben:v.tu_giao?'Tự giao':'Giao bởi '+ten(v.nguoi_giao)})).join(''):'<p class="mut">Không có việc nào tới hạn trong 3 ngày.</p>')
    +ghiLoc('3 ngày tới',xa)+`</div><div id="bnam"><p class="mut">Đang tải danh sách năm…</p></div></div>`;
  gan();ganNutPush();bangNam('toi');
}
async function dsGiao(){
  $('#nd').innerHTML='Đang tải…';
  const {data,error}=await sb.from('viec').select('*').neq('trang_thai','huy').not('trang_thai','eq','da_dong').order('han',{nullsFirst:false}).limit(300);
  if(error)return $('#nd').textContent=error.message;
  const con=locTuGiao(data),an=data.length-con.length;
  const {sap,xa}=locGan(con,7);
  $('#nd').innerHTML=`<div class="hai"><div>`
    +(sap.map(v=>the({...v,ben:'Người nhận: '+ten(v.nguoi_nhan)})).join('')||'<p class="mut">Không có việc nào tới hạn trong 7 ngày.</p>')
    +ghiLoc('7 ngày tới',xa)+nutTuGiao(an)+`</div><div id="bnam"><p class="mut">Đang tải danh sách năm…</p></div></div>`;
  gan();ganNutTuGiao();bangNam('giao');
}
// Việc nhân viên TỰ GIAO cho mình: trưởng phòng không cần thấy trong màn Giao, nhưng vẫn bật xem được khi cần
let hienTuGiao=false;
const locTuGiao=d=>hienTuGiao?d:(d||[]).filter(v=>!(v.tu_giao&&v.nguoi_giao!==me.id));
const nutTuGiao=an=>!an&&!hienTuGiao?'':`<p class="mut" style="margin-top:8px">${hienTuGiao?'Đang hiện cả việc nhân viên tự giao.':'Đã ẩn <b>'+an+'</b> việc nhân viên tự giao cho mình.'} <a href="#" id="tgtoggle">${hienTuGiao?'Ẩn lại':'Hiện ra'}</a></p>`;
const ganNutTuGiao=()=>{const a=$('#tgtoggle');if(a)a.onclick=e=>{e.preventDefault();hienTuGiao=!hienTuGiao;dsGiao()}};
const NGAY=864e5,TOI_DA_THE=6;
// Chỉ hiện việc gần tới hạn, xếp hạn gần nhất lên trước, nhiều quá thì cắt bớt — phần còn lại xem ở bảng cả năm
const locGan=(data,ngay)=>{
  const moc=Date.now()+ngay*NGAY;
  const g=data.filter(v=>!v.han||new Date(v.han)<=moc)
    .sort((a,b)=>(a.han?new Date(a.han):Infinity)-(b.han?new Date(b.han):Infinity));
  return {sap:g.slice(0,TOI_DA_THE),xa:data.length-Math.min(g.length,TOI_DA_THE)};
};
const ghiLoc=(ky,xa)=>`<p class="mut" style="margin-top:12px">Đang hiện tối đa ${TOI_DA_THE} việc tới hạn sớm nhất trong <b>${ky}</b>.${xa?' Còn <b>'+xa+'</b> việc nữa, xem ở bảng bên cạnh.':''}</p>`;

// Danh sách việc cả năm, hiện ngay bên cạnh (máy tính) hoặc bên dưới (điện thoại) để nhớ đủ số việc trong năm
async function bangNam(pv,nam){
  const o=$('#bnam');if(!o)return;
  let q=sb.from('viec').select('*').neq('trang_thai','huy').order('han',{nullsFirst:false}).limit(500);
  if(pv==='toi')q=q.eq('nguoi_nhan',me.id);
  let {data,error}=await q;
  if(error)return o.innerHTML='<p class="mut">Lỗi: '+esc(error.message)+'</p>';
  if(pv==='giao')data=locTuGiao(data);
  const namCua=v=>new Date(v.han||v.tao_luc).getFullYear();
  const nams=[...new Set((data||[]).map(namCua))].sort((x,y)=>y-x),n=nam||new Date().getFullYear();
  if(!nams.includes(n)){nams.push(n);nams.sort((x,y)=>y-x)}
  const ds=(data||[]).filter(v=>namCua(v)===n),mo=ds.filter(v=>v.trang_thai!=='da_dong').length;
  o.innerHTML=`<div class="card bnam"><div class="row" style="justify-content:space-between;align-items:center;gap:8px">
    <b>📋 Việc trong năm</b><select id="nnam" style="width:auto;min-height:38px;padding:6px 8px">${nams.map(y=>`<option value="${y}" ${y===n?'selected':''}>${y}</option>`).join('')}</select></div>
    <div class="mut">${ds.length} việc${mo?', '+mo+' đang mở':''}</div>
    ${ds.length?`<table class="tb"><thead><tr><th>STT</th><th>Nội dung</th><th>Đến hạn</th><th>Tình trạng</th></tr></thead><tbody>${ds.map((v,i)=>`<tr data-id="${v.id}"><td>${i+1}</td><td>${esc(v.tieu_de)}${pv==='giao'?`<div class="mut">${esc(ten(v.nguoi_nhan))}</div>`:''}</td><td class="han${qua(v)?' qua':''}">${v.han?new Date(v.han).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}):'chưa có'}</td><td>${nhanBuoc(v)||tag(v.trang_thai)}</td></tr>`).join('')}</tbody></table>`:'<p class="mut">Năm này chưa có việc nào.</p>'}</div>`;
  $('#nnam').onchange=()=>bangNam(pv,+$('#nnam').value);
  o.querySelectorAll('tr[data-id]').forEach(r=>r.onclick=()=>chiTiet(r.dataset.id));
}
const gan=()=>document.querySelectorAll('.card[data-id]').forEach(c=>c.onclick=()=>chiTiet(c.dataset.id));

// Xóa: người tạo (giao việc / phát thông báo / tạo lịch) hoặc quản trị. Máy chủ chặn bằng RLS.
async function xoaMuc(loai,id,hoi,sau){if(!confirm(hoi))return;
  const {data,error}=await sb.from(loai).delete().eq('id',id).select('id');
  if(error)return toast('Lỗi: '+error.message);
  if(!data||!data.length)return toast('Không xóa được: mục này không phải do bạn tạo');
  if(loai==='viec')await xoaTepCuaViec(id);   // các bảng con xóa theo việc, tệp trên Storage phải tự dọn
  toast('Đã xóa');sau()}
// Dọn thư mục tệp của một việc đã xóa; lỗi thì bỏ qua, lượt quét mồ côi hằng đêm sẽ nhặt nốt
async function xoaTepCuaViec(id){try{
  const {data}=await sb.storage.from('anh').list(String(id),{limit:1000});
  const ds=(data||[]).map(f=>id+'/'+f.name);
  if(ds.length)await sb.storage.from('anh').remove(ds);
}catch(e){}}
async function formViec(){
  const {data:nd}=await sb.from('nguoi_dung').select('id,ho_ten,chuc_vu,khoa_phong(ten)').eq('hoat_dong',true).order('ho_ten');
  const ds=(nd||[]).filter(u=>me.vai_tro!=='nhan_vien'||u.id===me.id);
  const kt=u=>((u.khoa_phong&&u.khoa_phong.ten)||'').replace(/^(KHOA|PHÒNG) /,'');
  const fx=t=>(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
  $('#nd').innerHTML=`<div class="card fgiao"><div class="f r2"><label>Việc cần làm</label><input id="tt"></div><div class="f r2"><label>Mô tả</label><textarea id="ms"></textarea></div>
  <div class="f"><label>Người nhận ${me.vai_tro==='nhan_vien'?'':'(chỉ hiện người trong khoa/phòng bạn phụ trách)'}</label>
  <input id="nq" placeholder="Gõ tên để lọc…" autocomplete="off"><select id="nn"></select><div id="pcb" class="mut" style="margin-top:6px"></div></div>
  <div class="f"><label>Hạn (bắt buộc, app sẽ nhắc trước 3 ngày, 1 ngày, 1 giờ và nhắc mỗi sáng nếu quá hạn)</label><input id="han" type="datetime-local"><div class="row" style="margin-top:6px;gap:6px;flex-wrap:wrap">${[["Hôm nay 17h",0],["Ngày mai",1],["3 ngày",3],["1 tuần",7],["1 tháng",30]].map(x=>`<button type="button" class="sec" data-hn="${x[1]}" style="padding:6px 10px">${x[0]}</button>`).join("")}</div></div>
  <div class="f"><label>Mức độ</label><select id="ut"><option value="1">Thường</option><option value="2">Gấp</option><option value="0">Thấp</option></select></div>
  <div class="f"><label>Loại việc (quyết định các bước phải làm và thư mục Drive tra cứu)</label><select id="lcv"></select><div class="mut" id="lcvb"></div></div>
  <div class="f r2"><label>Đính kèm file Word / Excel / PDF (không bắt buộc, tối đa 10 MB)</label><input id="tepg" type="file" accept=".doc,.docx,.xls,.xlsx,.pdf"></div>
  <div class="f r2"><button class="full" id="g">📤 Giao việc</button><p class="mut" id="loi"></p></div></div>`;
  const pcb=async()=>{const id=$('#nn').value,el=$('#pcb');if(!el)return;if(!id||id===me.id){el.textContent='';return}
    const {data}=await sb.rpc('so_may_push',{p_nguoi:id});if($('#nn').value!==id)return;
    el.innerHTML=data>0?'🔔 Người này đã bật thông báo ('+data+' máy)':'<span style="color:#b45309">⚠ Người này chưa bật thông báo trên máy, nên sẽ không có tin báo ngay. Hãy nhắc họ mở app → tab "Tôi" → bật thông báo.</span>'};
  const dien=q=>{const x=fx(q);const l=ds.filter(u=>!x||fx(u.ho_ten+' '+kt(u)).includes(x));$('#nn').innerHTML=l.map(u=>`<option value="${u.id}" ${u.id===me.id?'selected':''}>${esc(u.ho_ten)}${u.id===me.id?' (tôi)':''}${kt(u)?' · '+esc(kt(u)):''}</option>`).join('')||'<option value="">Không có ai khớp</option>';if(x&&l.length)$('#nn').value=l[0].id};
  let LV=[];
  sb.from('loai_viec').select('id,nhom,ten,buoc,can_cu').eq('hoat_dong',true).order('thu_tu').then(({data})=>{LV=data||[];
    const g={};LV.forEach(l=>{(g[l.nhom]=g[l.nhom]||[]).push(l)});
    $('#lcv').innerHTML='<option value="">— Chưa xếp loại —</option>'+Object.keys(g).map(n=>`<optgroup label="${esc(n)}">${g[n].map(l=>`<option value="${l.id}">${esc(l.ten)}</option>`).join('')}</optgroup>`).join('');
    $('#lcv').onchange=()=>{const l=LV.find(x=>x.id==$('#lcv').value),B=l&&Array.isArray(l.buoc)?l.buoc:[];
      $('#lcvb').innerHTML=B.length?'Việc này sẽ chạy theo '+B.length+' bước: '+B.map((b,i)=>(i+1)+'. '+esc(b.ten)).join(' → '):''}});
  const hanDat=n=>{const d=new Date();d.setDate(d.getDate()+n);d.setHours(17,0,0,0);if(d<new Date())d.setDate(d.getDate()+1);const z=x=>String(x).padStart(2,'0');$('#han').value=`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`};
  document.querySelectorAll('[data-hn]').forEach(b=>b.onclick=()=>hanDat(+b.dataset.hn));hanDat(1);
  dien('');$('#nq').oninput=()=>{dien($('#nq').value);pcb()};$('#nn').onchange=pcb;pcb();
  $('#g').onclick=async()=>{
    if(!$('#tt').value.trim())return $('#loi').textContent='Nhập tên việc';if(!$('#nn').value)return $('#loi').textContent='Chọn người nhận';if(!$('#han').value)return $('#loi').textContent='Chọn hạn hoàn thành để app nhắc đúng hẹn';
    const tep=$('#tepg').files[0]||null,lt=kiemTep(tep);if(lt)return $('#loi').textContent=lt;
    const vid=uid(),fp=tep?`${vid}/giao-${uid()}.${duoiTep(tep.name)}`:null;
    const {error}=await sb.from('viec').insert({id:vid,file_path:fp,file_ten:tep?tep.name:null,tieu_de:$('#tt').value.trim(),mo_ta:$('#ms').value||null,nguoi_giao:me.id,nguoi_nhan:$('#nn').value,han:$('#han').value?new Date($('#han').value).toISOString():null,uu_tien:+$('#ut').value,...(()=>{const l=LV.find(x=>x.id==$('#lcv').value);if(!l)return{};
      const B=(Array.isArray(l.buoc)?l.buoc:[]).map(b=>({ten:b.ten,goi_y:b.goi_y||'',nut:b.nut||null,xong:false}));
      return{loai_viec_id:l.id,thu_muc_dc:l.can_cu||null,cac_buoc:B.length?B:null}})()});
    if(error)return $('#loi').textContent='Không giao được: '+error.message;
    let canhTep='';
    if(tep){const {error:e3}=await sb.storage.from('anh').upload(fp,tep,{contentType:TEP_MIME[duoiTep(tep.name)],upsert:true});
      if(e3){canhTep=' Nhưng file đính kèm chưa tải lên được, hãy gửi lại file ở phần cập nhật.';await sb.from('viec').update({file_path:null,file_ten:null}).eq('id',vid)}}
    const nn=$('#nn').value;let canh='';
    if(nn!==me.id){const {data:sm}=await sb.rpc('so_may_push',{p_nguoi:nn});if(!sm)canh=' Lưu ý: người nhận chưa bật thông báo trên máy, hãy nhắc họ.'}
    toast('Đã giao việc.'+canh+canhTep);tab='toi';ve();
  };
}

const bando=c=>{const la=+c.vi_do,lo=+c.kinh_do,d=0.004;return `<div class="mut">📍 ${la.toFixed(5)}, ${lo.toFixed(5)}${c.do_chinh_xac?' (sai số ±'+c.do_chinh_xac+' m)':''} · <a href="https://www.google.com/maps?q=${la},${lo}" target="_blank" rel="noopener">Mở Google Maps</a></div><iframe class="bd" loading="lazy" title="Bản đồ" src="https://www.openstreetmap.org/export/embed.html?bbox=${lo-d},${la-d},${lo+d},${la+d}&layer=mapnik&marker=${la},${lo}"></iframe>`};
const napJs=u=>new Promise((ok,ko)=>{const t=document.createElement('script');const h=setTimeout(()=>ko(new Error('Bộ xem file tải quá lâu (mạng chậm hoặc bị chặn). Bấm Tải ở trên để mở bằng Word/Excel.')),20000);t.src=u;t.onload=()=>{clearTimeout(h);ok()};t.onerror=()=>{clearTimeout(h);ko(new Error('Không tải được bộ xem file, kiểm tra mạng'))};document.head.appendChild(t)});
let xlsxP,mamP;
const taiXlsx=()=>xlsxP||(xlsxP=napJs('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'));
const taiMam=()=>mamP||(mamP=napJs('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.2/mammoth.browser.min.js'));
function sach(html){const t=document.createElement('template');t.innerHTML=html;t.content.querySelectorAll('script,iframe,object,embed,link,style').forEach(e=>e.remove());t.content.querySelectorAll('*').forEach(e=>{[...e.attributes].forEach(a=>{if(/^on/i.test(a.name)||(/^(href|src)$/i.test(a.name)&&/^\s*javascript:/i.test(a.value)))e.removeAttribute(a.name)})});return t.innerHTML}

const GOI_Y=[['Tóm tắt','Tóm tắt nội dung chính của tệp này.'],['Soát số liệu','Soát tệp này, chỉ ra số liệu bất thường, thiếu hoặc không khớp.'],['Viết công thức','Tôi cần viết công thức Excel: ',1],['Soạn tờ trình','Dựa trên tệp này, soạn tờ trình. Nội dung chính: ',1],['Soạn quyết định','Dựa trên tệp này, soạn quyết định. Nội dung chính: ',1]];
async function goiAI(body){
  const {data,error}=await sb.functions.invoke('ai-file',{body});
  if(error){let m=error.message;try{const j=await error.context.json();m=j.loi||m}catch(_){}return {loi:m}}
  return data||{loi:'Không có phản hồi'}
}
function khungAI(ov,viecId,path,ten){
  const p=document.createElement('div');p.className='ai';
  p.innerHTML=`<div class="aih"><b>🤖 Hỏi AI về tệp này</b><span><button class="sec" id="aithu">Thu gọn</button> <button class="sec" id="aixoa">Xóa hội thoại</button></span></div><div class="aim" id="aim"></div><div class="aiq"><button id="aimau" style="background:#15803d;color:#fff">📝 Soạn tờ trình / quyết định từ file này</button>${GOI_Y.filter(g=>!/^Soạn/.test(g[0])).map((g,i)=>`<button class="sec" data-g="${GOI_Y.indexOf(g)}">${g[0]}</button>`).join('')}</div><div class="aii"><textarea id="aiq" rows="2" placeholder="Hỏi, nhờ tính toán, viết công thức, soạn văn bản…"></textarea><button id="aig">Gửi</button></div>`;
  ov.appendChild(p);
  const m=$('#aim'),base={viec_id:viecId,file_path:path};
  const them=(vai,tx)=>{const d=document.createElement('div');d.className='aib '+(vai==='user'?'u':'m');const t=document.createElement('div');t.className='ait';t.textContent=tx;d.appendChild(t);
    if(vai!=='user'){const a=document.createElement('div');a.className='aia';a.innerHTML='<button class="sec">⬇ Tải Word</button> <button class="sec">📋 Chép</button>';
      const [w,c]=a.querySelectorAll('button');
      w.onclick=async()=>{ban(w);const r=await goiAI({...base,action:'xuat_word',noi_dung:tx,ten_file:'Soan thao AI - '+(ten||'').replace(/\.\w+$/,'')});ban(w,false);if(r.url)taiVe(r.url,r.ten||'Soan thao AI.docx');else toast(r.loi||'Không tạo được file')};
      c.onclick=async()=>{try{await navigator.clipboard.writeText(tx);toast('Đã chép')}catch(_){toast('Máy không cho chép tự động')}};
      d.appendChild(a)}
    m.appendChild(d);m.scrollTop=m.scrollHeight;return d};
  $('#aithu').onclick=()=>{p.classList.toggle('nho');$('#aithu').textContent=p.classList.contains('nho')?'Mở ra':'Thu gọn'};
  $('#aixoa').onclick=async()=>{if(!confirm('Xóa toàn bộ hội thoại AI về tệp này?'))return;await goiAI({...base,action:'xoa_lich_su'});m.innerHTML=''};
  const gui=async tx=>{tx=tx.trim();if(!tx)return;const g=$('#aig');g.disabled=true;$('#aiq').value='';them('user',tx);const cho=them('model','Đang suy nghĩ…');cho.querySelector('.aia').remove();
    const r=await goiAI({...base,action:'chat',cau_hoi:tx});cho.remove();g.disabled=false;
    them('model',r.tra_loi||('⚠ '+(r.loi||'Lỗi không rõ')));if(r.cat)toast('Tệp dài, AI chỉ đọc phần đầu')};
  $('#aig').onclick=()=>gui($('#aiq').value);
  $('#aimau').onclick=()=>{const so=document.createElement('div');so.className='vw';
    so.innerHTML='<div class="vwh"><b>📝 Soạn văn bản từ file này</b><span><button class="sec" id="sox">✕ Đóng</button></span></div><div class="vwb" id="sob" style="overflow:auto"></div>';
    document.body.appendChild(so);$('#sox').onclick=()=>{if(so.dataset.vb)ov.dataset.vb=1;so.remove()};
    const kq=[...m.querySelectorAll('.aib.m .ait')].map(e=>e.textContent.trim()).filter(t=>t.length>60&&!/^⚠/.test(t));
    khungSoan($('#sob'),so,viecId,path,kq)};
  if(/^docx$/.test(duoiTep(ten))){const bt=document.createElement('button');bt.id='aidc';bt.style.cssText='background:#0f766e;color:#fff';bt.textContent='🔎 Đối chiếu với hồ sơ trong thư mục Drive';p.querySelector('.aiq').prepend(bt);
    bt.onclick=()=>doiChieuUI(viecId,path)}
  p.querySelectorAll('.aiq button[data-g]').forEach(x=>x.onclick=()=>{const g=GOI_Y[+x.dataset.g];if(g[2]){$('#aiq').value=g[1];$('#aiq').focus()}else gui(g[1])});
  goiAI({...base,action:'lich_su'}).then(r=>{(r.lich_su||[]).forEach(h=>them(h.vai,h.noi_dung))});
}
// Màn hình sửa danh mục loại việc (quản trị / TCHC / BGĐ)
async function dsLoaiViec(){
  const {data:ds,error}=await sb.from('loai_viec').select('*').order('thu_tu');
  const so=document.createElement('div');so.className='vw';
  so.innerHTML='<div class="vwh"><b>📂 Danh mục loại việc</b><span><button class="sec" id="lvx">✕ Đóng</button></span></div><div class="vwb" id="lvb" style="overflow:auto;padding:14px"></div>';
  document.body.appendChild(so);$('#lvx').onclick=()=>so.remove();
  const k=$('#lvb');if(error){k.innerHTML='<p style="color:#b91c1c">'+esc(error.message)+'</p>';return}
  const o=x=>`<div class="card" data-id="${x.id||''}"><label class="mut">Nhóm</label><input class="lv_n" value="${esc(x.nhom||'')}"><label class="mut">Tên loại việc</label><input class="lv_t" value="${esc(x.ten||'')}">
   <label class="mut">Thư mục Drive tham khảo (dán link, chỉ đọc)</label><input class="lv_f" value="${esc(x.thu_muc_goc||'')}">
   <label class="mut">Từ khóa giúp AI nhận ra</label><input class="lv_g" value="${esc(x.goi_y||'')}">
   <label class="mut">Các bước phải làm — mỗi dòng một bước, dạng: <b>Tên bước | gợi ý cho người làm | nút</b> (nút để trống, hoặc ghi <b>ai</b> / <b>doi_chieu</b>). Để trống cả ô thì việc chạy kiểu cũ.</label>
   <textarea class="lv_b" rows="6" placeholder="Lấy mẫu kỳ trước | Mở thư mục Drive, chọn báo cáo kỳ gần nhất | ai">${esc((Array.isArray(x.buoc)?x.buoc:[]).map(b=>[b.ten,b.goi_y||'',b.nut||''].join(' | ').replace(/( \| )+$/,'')).join('\n'))}</textarea>
   <label><input type="checkbox" class="lv_h" ${x.hoat_dong===false?'':'checked'}> Đang dùng</label>
   <div style="margin-top:6px"><button class="lv_s">💾 Lưu</button> ${x.id?'<button class="sec dng lv_d">Xóa</button>':''}</div></div>`;
  k.innerHTML='<p class="mut">Mỗi loại việc gắn một thư mục Drive để AI lấy mẫu và hồ sơ căn cứ (chỉ đọc, app không ghi vào), và một bộ bước phải làm. Việc giao theo loại nào sẽ chạy đúng các bước của loại đó.</p><button class="full" id="lvm">➕ Thêm loại việc</button><div id="lvl">'+(ds||[]).map(o).join('')+'</div>';
  const gan=c=>{
    c.querySelector('.lv_s').onclick=async()=>{
      const ten=c.querySelector('.lv_t').value.trim();if(!ten)return toast('Nhập tên loại việc');
      const row={nhom:c.querySelector('.lv_n').value.trim()||'Khác',ten,thu_muc_goc:c.querySelector('.lv_f').value.trim()||null,goi_y:c.querySelector('.lv_g').value.trim()||null,hoat_dong:c.querySelector('.lv_h').checked,
        buoc:c.querySelector('.lv_b').value.split('\n').map(d=>d.trim()).filter(Boolean).map(d=>{const p=d.split('|').map(y=>y.trim());
          return{ten:p[0],goi_y:p[1]||'',nut:['ai','doi_chieu'].includes(p[2])?p[2]:null}}).filter(b=>b.ten)};
      const id=c.dataset.id;
      const {data,error}=id?await sb.from('loai_viec').update(row).eq('id',id).select().single():await sb.from('loai_viec').insert({...row,thu_tu:200}).select().single();
      if(error)return toast('Không lưu được: '+error.message);
      c.dataset.id=data.id;toast('Đã lưu')};
    const d=c.querySelector('.lv_d');if(d)d.onclick=async()=>{if(!confirm('Xóa loại việc này? Các việc đã gắn sẽ bỏ gắn loại.'))return;
      const {error}=await sb.from('loai_viec').delete().eq('id',c.dataset.id);if(error)return toast(error.message);c.remove()}};
  k.querySelectorAll('#lvl .card').forEach(gan);
  $('#lvm').onclick=()=>{const t=document.createElement('div');t.innerHTML=o({});const c=t.firstElementChild;$('#lvl').prepend(c);gan(c)};
}
// Đối chiếu báo cáo với hồ sơ căn cứ trong thư mục Drive (AI chỉ gợi ý, người dùng quyết định)
async function dcGoi(body){
  const {data,error}=await sb.functions.invoke('doi-chieu',{body});
  const cu=j=>{if(j&&j.loi==='Dữ liệu sai')j.loi='Apps Script chưa có bản mới của DoiChieu.gs. Trưởng phòng cần dán lại file và triển khai phiên bản mới.';return j};
  if(error){let m=error.message;try{return cu(await error.context.json())}catch(_){}return {loi:m}}
  return cu(data)||{loi:'Không có phản hồi'}
}
// Đọc hết hồ sơ trong thư mục căn cứ (file lỗi được bỏ qua, không chặn file sau)
async function dcDocHet(viecId,bao){
  bao('⏳ Đang quét thư mục căn cứ…');
  const q=await dcGoi({action:'quet',viec_id:viecId});
  if(q.loi)return q;
  let con=q.can_doc;const tong=q.can_doc;
  while(con>0){
    bao(`📖 Đang đọc hồ sơ ${tong-con+1}/${tong} trong "${q.ten_thu_muc||''}"… (chỉ đọc lần đầu, lần sau dùng lại)`);
    const r=await dcGoi({action:'doc',viec_id:viecId,n:2});
    if(r.loi)return r;
    if(!r.da_doc)break;
    con=r.con_lai}
  return q;
}
async function doiChieuUI(viecId,path){
  const {data:v}=await sb.from('viec').select('thu_muc_dc').eq('id',viecId).single();
  if(!v||!v.thu_muc_dc){toast('Chưa chọn thư mục căn cứ. Mở "✨ Làm việc này cùng AI" để chọn.');return troLy(viecId)}
  const so=document.createElement('div');so.className='vw';
  so.innerHTML='<div class="vwh"><b>🔎 Đối chiếu báo cáo với hồ sơ</b><span><button class="sec" id="dcx">✕ Đóng</button></span></div><div class="vwb" id="dcb" style="overflow:auto;padding:14px"></div>';
  document.body.appendChild(so);$('#dcx').onclick=()=>so.remove();
  const k=$('#dcb');
  const chay=async()=>{
    const q=await dcDocHet(viecId,t=>{k.innerHTML='<p class="mut">'+esc(t)+'</p>'});
    if(q.loi){k.innerHTML=`<p style="color:#b91c1c">⚠ ${esc(q.loi)}</p>`;return}
    k.innerHTML='<p class="mut">🤖 AI đang đối chiếu báo cáo với hồ sơ… (khoảng 1 phút)</p>';
    const r=await dcGoi({action:'doi_chieu',viec_id:viecId,file_path:path});
    if(r.loi){k.innerHTML=`<p style="color:#b91c1c">⚠ ${esc(r.loi)}</p><button id="dcl3" class="full">Thử lại</button>`;$('#dcl3').onclick=chay;return}
    const KQ={khop:['✅ Khớp','#15803d'],lech:['❌ Lệch','#b91c1c'],thieu_can_cu:['❓ Thiếu căn cứ','#b45309'],can_dien:['✍ Có thể điền','#1d4ed8'],het_han:['⏰ Hết hạn','#b91c1c']};
    k.innerHTML=`<p>${esc(r.tong_quan||'')}</p><p class="mut">Đã đối chiếu với ${r.so_ho_so} hồ sơ.${(r.ho_so_khong_doc||[]).length?' Không đọc được '+r.ho_so_khong_doc.length+' file: '+r.ho_so_khong_doc.slice(0,8).map(x=>esc(x.ten)).join('; '):''}</p>
    <p class="mut">⚠ AI chỉ gợi ý, hãy mở hồ sơ gốc kiểm lại trước khi sửa báo cáo.</p>
    ${(r.muc||[]).map(x=>{const q=KQ[x.ket_qua]||[esc(x.ket_qua||''),'#555'];return `<div class="tlm" style="border-left-color:${q[1]}">
      <b>${x.do?'🔴 ':''}${esc(x.muc||'')}</b> <span style="color:${q[1]}">${q[0]}</span>
      ${x.bao_cao_ghi?`<div><span class="mut">Báo cáo ghi:</span> ${esc(x.bao_cao_ghi)}</div>`:''}
      ${x.can_cu?`<div><span class="mut">Hồ sơ:</span> ${esc(x.can_cu)}</div>`:''}
      ${x.de_xuat?`<div><span class="mut">Đề xuất:</span> ${esc(x.de_xuat)}</div>`:''}</div>`}).join('')}
    <button id="dcl5" class="sec">Chạy lại đối chiếu</button>`;
    $('#dcl5').onclick=chay};
  chay();
}
// ===== TRỢ LÝ VIỆC: một màn hình, 4 bước: văn bản → loại việc → mẫu & căn cứ (Drive chỉ đọc) → AI soạn, sửa, lưu =====
async function troLy(viecId){
  const so=document.createElement('div');so.className='vw';
  so.innerHTML='<div class="vwh"><b>✨ Làm việc này cùng AI</b><span><button class="sec" id="tlx">✕ Đóng</button></span></div><div class="vwb tl2"><div id="tlA"></div><div id="tlB"></div></div>';
  document.body.appendChild(so);
  let doi=false;$('#tlx').onclick=()=>{so.remove();if(doi)chiTiet(viecId)};
  const A=$('#tlA'),B=$('#tlB');A.innerHTML='<p class="mut">Đang mở…</p>';
  const [{data:v},{data:cn},{data:loai}]=await Promise.all([
    sb.from('viec').select('*').eq('id',viecId).single(),
    sb.from('cap_nhat_hien_trang').select('file_path,file_ten,anh_path,gio_bam').eq('viec_id',viecId).order('gio_bam',{ascending:false}),
    sb.from('loai_viec').select('*').eq('hoat_dong',true).order('thu_tu')]);
  if(!v){A.innerHTML='<p>Không mở được việc.</p>';return}
  const teps=[];if(v.file_path)teps.push({p:v.file_path,t:v.file_ten,g:'kèm khi giao việc'});(cn||[]).forEach(c=>{if(c.file_path&&!/\/nhap-bc-/.test(c.file_path))teps.push({p:c.file_path,t:c.file_ten,g:'gửi '+fmt(c.gio_bam)});if(c.anh_path)teps.push({p:c.anh_path,t:'Ảnh chụp.jpg',g:'ảnh gửi '+fmt(c.gio_bam)})});
  const S={fp:teps.length?teps[0].p:'',goiY:null,dangGY:false,kq:null,tenCC:'',dr:null};
  const lv=()=>(loai||[]).find(x=>x.id===v.loai_viec_id);
  const idTM=x=>{const m=String(x||'').match(/folders\/([A-Za-z0-9_-]{10,})/);return m?m[1]:String(x||'').trim()};
  const capNhatViec=async o=>{const {error}=await sb.from('viec').update(o).eq('id',viecId);if(error){toast('Không lưu được: '+error.message);return false}Object.assign(v,o);doi=true;return true};

  const veA=()=>{
    const l=lv(),tepChon=teps.find(t=>t.p===S.fp);
    A.innerHTML=`<div class="card"><h3>${esc(v.tieu_de)}</h3><div class="mut">${esc(v.mo_ta||'')}</div></div>
    <div class="card"><b>① Văn bản đề nghị</b>
      ${teps.map((t,i)=>`<label class="vlb"><input type="radio" name="tlf" class="vck" value="${i}" ${t.p===S.fp?'checked':''}><span>${bieuTuongTep(t.t)} ${esc(t.t||'Tệp')} <span class="mut">(${esc(t.g)})</span> · <a href="#" data-xem="${i}">xem</a></span></label>`).join('')}
      <label class="vlb"><input type="radio" name="tlf" class="vck" value="-1" ${S.fp?'':'checked'}><span>Không có văn bản, tôi tự ghi yêu cầu</span></label>
      <label class="mut" style="display:block;margin-top:6px">📎 Thả, chọn hoặc chụp văn bản khác (Word, Excel, PDF, ảnh)</label><input type="file" id="tlup" accept="image/*,.doc,.docx,.xls,.xlsx,.pdf">
      <textarea id="tlyc" rows="2" placeholder="Ghi thêm yêu cầu cho AI (không bắt buộc). VD: báo cáo ATBX năm 2026, nộp Sở KH&CN">${esc(S.yc||'')}</textarea></div>
    <div class="card"><b>② Loại việc</b> <span class="mut">${S.dangGY?'(AI đang đọc và gợi ý…)':l?'':'(AI gợi ý, bạn chọn)'}</span>
      ${l?`<div class="tlchon">✅ <b>${esc(l.ten)}</b> <span class="mut">· ${esc(l.nhom)}</span> <a href="#" id="tldoi">đổi</a></div>`:
        `${(S.goiY||[]).map(g=>{const x=(loai||[]).find(y=>y.id===g.id);return x?`<button class="full tlgy" data-lv="${x.id}"><b>${esc(x.ten)}</b><br><span>${esc(g.ly_do||x.nhom)}</span></button>`:''}).join('')}
        <select id="tlsel"><option value="">${(S.goiY||[]).length?'Hoặc chọn loại khác…':'Chọn loại việc…'}</option>${(loai||[]).map(x=>`<option value="${x.id}">${esc(x.nhom)} · ${esc(x.ten)}</option>`).join('')}</select>
        ${S.goiY||S.dangGY?'':'<button class="sec" id="tlgyb">🤖 Nhờ AI gợi ý</button>'}`}
    </div>
    ${l?`<div class="card"><b>③ Mẫu và hồ sơ căn cứ</b> <span class="mut">(lần sau app nhớ)</span> <a href="#" id="tlden">📂 Chọn trong Drive</a>
      <div class="tlchon">📄 Mẫu (báo cáo kỳ trước): ${v.mau_file_id?'<b>'+esc(v.mau_ten||'đã chọn')+'</b>':'<span style="color:#b45309">chưa chọn</span>'}</div>
      <div class="tlchon">📁 Hồ sơ căn cứ: ${v.thu_muc_dc?'<b>'+esc(S.tenCC||'đã chọn')+'</b>':'<span class="mut">chưa chọn (AI chỉ dựa vào văn bản và yêu cầu)</span>'}</div></div>
    <div class="card"><b>④ Soạn</b>
      <button class="full" id="tlsoan" ${v.mau_file_id?'':'disabled'}>✨ AI soạn báo cáo từ mẫu</button>
      ${v.mau_file_id?'':'<p class="mut">Chọn file mẫu ở bước ③ trước.</p>'}
      <p class="mut" id="tltt"></p><div id="tlkq"></div>
      <details style="margin-top:8px"><summary class="mut">Việc khác với văn bản đang chọn</summary>
        <button class="sec full" id="tlvb" ${S.fp&&/^(docx|xlsx)$/.test(duoiTep(tepChon&&tepChon.t))?'':'disabled'}>📝 Soạn tờ trình / quyết định theo mẫu bệnh viện</button>
        <button class="sec full" id="tldc" ${S.fp&&duoiTep(tepChon&&tepChon.t)==='docx'&&v.thu_muc_dc?'':'disabled'}>🔎 Đối chiếu văn bản đang chọn với hồ sơ căn cứ</button></details></div>`:''}`;
    A.querySelectorAll('input[name=tlf]').forEach(r=>r.onchange=()=>{S.yc=$('#tlyc').value;S.fp=+r.value<0?'':teps[+r.value].p;veA()});
    A.querySelectorAll('[data-xem]').forEach(a=>a.onclick=e=>{e.preventDefault();const t=teps[+a.dataset.xem];xemTep(t.p,t.t,null)});
    $('#tlyc').oninput=()=>{S.yc=$('#tlyc').value};
    $('#tlup').onchange=async()=>{const f=$('#tlup').files[0];if(!f)return;
      const laAnh=/^image\//.test(f.type)||/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name),lt=laAnh?null:kiemTep(f);if(lt)return toast(lt);
      toast('Đang đưa văn bản lên…');const mk=uid(),anh=laAnh?await nen(f):null;
      if(laAnh&&!anh)return toast('Không đọc được ảnh này');
      await qAdd({ma_khach:mk,viec_id:viecId,trang_thai:null,ghi_chu:'Văn bản đưa vào để xử lý',anh,tep:laAnh?null:f,tep_ten:laAnh?null:f.name,gio_bam:new Date().toISOString(),vi_tri_loi:'Không lấy vị trí khi thêm văn bản'});await day();
      if((await qAll()).length)return toast('Chưa có mạng, văn bản sẽ gửi sau');
      const p=laAnh?`${viecId}/${mk}.jpg`:`${viecId}/${mk}-f.${duoiTep(f.name)}`;teps.unshift({p,t:laAnh?'Ảnh chụp.jpg':f.name,g:'vừa thêm'});S.fp=p;doi=true;S.goiY=null;veA();if(!lv())goiY()};
    A.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>chonLoai(+b.dataset.lv));
    if($('#tlsel'))$('#tlsel').onchange=()=>{if($('#tlsel').value)chonLoai(+$('#tlsel').value)};
    if($('#tlgyb'))$('#tlgyb').onclick=goiY;
    if($('#tldoi'))$('#tldoi').onclick=async e=>{e.preventDefault();if(await capNhatViec({loai_viec_id:null})){S.kq=null;veA();B.innerHTML=''}};
    if($('#tlsoan'))$('#tlsoan').onclick=()=>soan();
    if($('#tlden'))$('#tlden').onclick=e=>{e.preventDefault();B.scrollIntoView({behavior:'smooth'})};
    if($('#tlvb'))$('#tlvb').onclick=()=>{const o=document.createElement('div');o.className='vw';o.innerHTML='<div class="vwh"><b>📝 Soạn văn bản theo mẫu bệnh viện</b><span><button class="sec" id="sox">✕ Đóng</button></span></div><div class="vwb" id="sob" style="overflow:auto"></div>';document.body.appendChild(o);$('#sox').onclick=()=>{doi=true;o.remove()};khungSoan($('#sob'),o,viecId,S.fp)};
    if($('#tldc'))$('#tldc').onclick=()=>doiChieuUI(viecId,S.fp);
    if(S.kq)veKQ();
  };
  const goiY=async()=>{
    S.dangGY=true;S.yc=$('#tlyc')?$('#tlyc').value:S.yc;veA();
    const r=await dcGoi({action:'goi_y_loai',viec_id:viecId,file_path:S.fp||undefined,van_ban:S.yc||''});
    S.dangGY=false;S.goiY=r.goi_y||[];if(r.loi)toast(r.loi);if(!lv())veA()};
  const chonLoai=async id=>{
    const l=(loai||[]).find(x=>x.id===id);if(!l)return;
    if(!await capNhatViec({loai_viec_id:id,mau_file_id:l.mau_file_id||null,mau_ten:l.mau_ten||null,thu_muc_dc:l.can_cu||null}))return;
    S.tenCC='';S.kq=null;veA();duyet()};

  // Drive chỉ đọc: duyệt từng tầng trong thư mục của loại việc
  const duong=[];
  const duyet=async(id,ten)=>{
    const l=lv();if(!l){B.innerHTML='';return}
    if(!l.thu_muc_goc){B.innerHTML='<div class="card"><b>📂 Drive</b><p class="mut">Loại việc này chưa gắn thư mục Drive. Trưởng phòng gắn trong Tài khoản → Danh mục loại việc.</p></div>';return}
    B.innerHTML='<div class="card"><b>📂 Drive (chỉ xem)</b><p class="mut">Đang mở thư mục…</p></div>';
    const r=await dcGoi({action:'duyet',viec_id:viecId,folder_id:id||''});
    if(r.loi){let em='';if(r.chua_chia_se){const w=await dcGoi({action:'who'});em=w.email||''}
      B.innerHTML=`<div class="card"><b>📂 Drive</b><p style="color:#b91c1c">⚠ ${esc(r.loi)}</p>${em?`<p>Chia sẻ thư mục <b>${esc(l.nhom)}</b> (quyền <b>Người xem</b>) cho: <b>${esc(em)}</b></p>`:''}<button class="sec" id="tlthu">Thử lại</button></div>`;
      $('#tlthu').onclick=()=>duyet(id,ten);return}
    if(!id)duong.length=0;
    if(!duong.length&&!r.la_goc)duong.push({id:idTM(l.thu_muc_goc),ten:l.nhom});
    const i=duong.findIndex(d=>d.id===r.id);if(i>=0)duong.length=i+1;else duong.push({id:r.id,ten:r.ten});
    if(idTM(v.thu_muc_dc)===r.id&&!S.tenCC){S.tenCC=r.ten;veA()}
    const laCC=idTM(v.thu_muc_dc)===r.id;
    B.innerHTML=`<div class="card"><b>📂 Drive của trưởng phòng</b> <span class="mut">(chỉ xem, app không ghi vào đây)</span>
      <div class="tlbc">${duong.map((d,k)=>k<duong.length-1?`<a href="#" data-di="${d.id}">${esc(d.ten)}</a> › `:`<b>${esc(d.ten)}</b>`).join('')}</div>
      <button class="${laCC?'sec':''} full" id="tlcc">${laCC?'✅ Đang dùng thư mục này làm hồ sơ căn cứ':'📁 Dùng thư mục này làm hồ sơ căn cứ'}</button>
      ${r.thu_muc.map(t=>`<div class="tlf" data-di="${t.id}">📁 ${esc(t.ten)}</div>`).join('')}
      ${r.files.map(f=>{const dx=/\.docx$/i.test(f.ten),la=v.mau_file_id===f.id;return `<div class="tlf tep">${/\.pdf$/i.test(f.ten)?'📕':/\.xlsx?$/i.test(f.ten)?'📊':'📄'} <span>${esc(f.ten)}</span>${dx?`<button class="${la?'':'sec'}" data-mau="${f.id}" data-ten="${esc(f.ten)}">${la?'✅ Mẫu':'Dùng làm mẫu'}</button>`:''}</div>`}).join('')}
      ${r.thu_muc.length+r.files.length?'':'<p class="mut">Thư mục trống.</p>'}
      <p class="mut">Mẫu phải là file Word .docx. File .doc đời cũ: mở bằng Word, Lưu thành .docx.</p></div>`;
    B.querySelectorAll('[data-di]').forEach(x=>x.onclick=e=>{e.preventDefault();duyet(x.dataset.di)});
    B.querySelectorAll('[data-mau]').forEach(x=>x.onclick=async()=>{if(await capNhatViec({mau_file_id:x.dataset.mau,mau_ten:x.dataset.ten})){S.kq=null;veA();duyet(r.id)}});
    $('#tlcc').onclick=async()=>{if(laCC)return;if(await capNhatViec({thu_muc_dc:r.id})){S.tenCC=r.ten;S.kq=null;veA();duyet(r.id)}};
  };

  const soan=async sua=>{
    const tt=t=>{const e=$('#tltt');if(e)e.textContent=t};
    const b=$('#tlsoan');b.disabled=true;S.yc=$('#tlyc').value;
    if(v.thu_muc_dc){const q=await dcDocHet(viecId,tt);if(q.loi){b.disabled=false;return tt('⚠ '+q.loi)}S.tenCC=q.ten_thu_muc||S.tenCC}
    tt(sua?'🤖 AI đang sửa lại theo ý bạn…':'🤖 AI đang soạn báo cáo từ mẫu… (khoảng 1 phút)');
    const r=await dcGoi({action:'soan_bc',viec_id:viecId,mau_file_id:v.mau_file_id,file_path:S.fp||undefined,yeu_cau:S.yc||'',sua:sua||undefined,thay_cu:sua&&S.kq?S.kq.thay:undefined});
    b.disabled=false;
    if(r.loi)return tt('⚠ '+r.loi);
    S.kq=r;S.daLuu=false;tt('');veKQ();
  };
  const veKQ=()=>{
    const r=S.kq,k=$('#tlkq');if(!k||!r)return;
    const dung=r.thay.filter(t=>t.ok),hong=r.thay.filter(t=>!t.ok),ngo=dung.filter(t=>!t.chac);
    k.innerHTML=`<div class="tlm" style="border-left-color:#15803d"><b>📄 ${esc(r.ten)}</b><div>${esc(r.tom_tat||'')}</div>
      <div class="mut">Mẫu: ${esc(r.mau)} · ${r.so_ho_so} hồ sơ căn cứ${r.khong_doc?' ('+r.khong_doc+' file không đọc được)':''} · đã thay ${dung.length} chỗ${ngo.length?', '+ngo.length+' chỗ cần bạn kiểm':''}</div>
      <button id="tlxem">👁 Xem bản soạn</button> <button class="sec" id="tltai">⬇ Tải Word</button></div>
    ${(r.thieu||[]).length?`<div class="tlm" style="border-left-color:#b45309"><b>❓ Còn thiếu căn cứ (${r.thieu.length})</b>${r.thieu.map(x=>`<div>• ${esc(x)}</div>`).join('')}</div>`:''}
    ${(r.chan||[]).length?`<div class="tlm" style="border-left-color:#b91c1c"><b>🛑 ${r.chan.length} chỗ GIỮ NGUYÊN theo mẫu: hồ sơ trong Drive cũ hơn số liệu đang ghi</b><div class="mut">Thư mục căn cứ chưa có hồ sơ mới cho các chỗ này. Bổ sung file mới vào Drive rồi soạn lại, hoặc tự kiểm số liệu trong mẫu.</div>${r.chan.map(t=>`<div>• Mẫu ghi: <b>${esc(t.cu)}</b><br><span class="mut">Hồ sơ chỉ có: ${esc(t.moi)} (${esc(t.ly_do||'')})</span></div>`).join('')}</div>`:''}
    ${(r.khong_doc_ds||[]).length?`<details class="tlm" style="border-left-color:#b45309"><summary><b>📁 ${r.khong_doc_ds.length} file trong thư mục căn cứ AI chưa đọc được</b></summary>${r.khong_doc_ds.map(x=>`<div>• ${esc(x.ten)} <span class="mut">(${esc(x.ly_do)})</span></div>`).join('')}</details>`:''}
    ${hong.length?`<div class="tlm" style="border-left-color:#b91c1c"><b>⚠ ${hong.length} chỗ AI đề xuất nhưng chưa thay được vào file, cần sửa tay</b>${hong.map(t=>`<div>• <s>${esc(t.cu)}</s> → <b>${esc(t.moi)}</b></div>`).join('')}</div>`:''}
    <details ${dung.length<=12?'open':''}><summary><b>Các chỗ đã thay (${dung.length})</b></summary>
    ${dung.map(t=>`<div class="tlm" style="border-left-color:${t.chac?'#15803d':'#b45309'}">${t.chac?'':'⚠ <b>Cần kiểm:</b> '}<s>${esc(t.cu)}</s> → <b>${esc(t.moi)}</b><div class="mut">${esc(t.can_cu||'')}</div></div>`).join('')}</details>
    <textarea id="tlsua" rows="2" placeholder="Chỗ nào chưa đúng? Gõ vào đây cho AI sửa. VD: ngày cấp giấy phép là 05/03/2026; giữ nguyên mục III"></textarea>
    <button class="sec full" id="tlsuab">✏️ AI sửa lại theo ý trên</button>
    ${v.nguoi_nhan===me.id&&v.trang_thai!=='da_dong'?'<label style="display:block;margin:8px 0"><input type="checkbox" id="tlht"> Lưu xong báo hoàn thành luôn (chờ người giao xác nhận)</label>':''}
    <button class="full" id="tlluu" ${S.daLuu?'disabled':''}>${S.daLuu?'✅ Đã lưu vào việc':'💾 Đã đọc, đồng ý. Lưu vào việc'}</button>
    <p class="mut">AI chỉ hỗ trợ soạn. Bạn đọc lại toàn văn trước khi in, trình ký.</p>`;
    $('#tlxem').onclick=()=>xemTep(null,r.ten,null,r.url);
    $('#tltai').onclick=()=>taiVe(r.url,r.ten);
    $('#tlsuab').onclick=()=>{const t=$('#tlsua').value.trim();if(!t)return toast('Gõ chỗ cần sửa');soan(t)};
    $('#tlluu').onclick=async()=>{const b=ban($('#tlluu'));
      try{const bl=await (await fetch(r.url)).blob();const f=new File([bl],r.ten,{type:TEP_MIME.docx});
        const ht=$('#tlht')&&$('#tlht').checked;
        await qAdd({ma_khach:uid(),viec_id:viecId,trang_thai:ht?'cho_xac_nhan':null,ghi_chu:'Bản soạn từ mẫu "'+r.mau+'" (AI hỗ trợ, người làm đã đọc lại)',anh:null,tep:f,tep_ten:r.ten,gio_bam:new Date().toISOString(),vi_tri_loi:'Không lấy vị trí khi lưu văn bản'});
        await day();S.daLuu=true;doi=true;toast(ht?'Đã lưu và báo hoàn thành':'Đã lưu vào việc');veKQ()}
      catch(e){b.disabled=false;b.textContent='💾 Đã đọc, đồng ý. Lưu vào việc';toast('Không lưu được: '+(e.message||e))}};
  };
  veA();
  if(lv())duyet(idTM(v.thu_muc_dc)||'');else if(teps.length)goiY();
}
// Soạn tờ trình / quyết định theo mẫu bệnh viện: 1 màn hình, AI tự gợi ý loại + ý chính
async function khungSoan(k,ov,viecId,path,aiKQ){
  k.innerHTML='<div style="padding:14px"><p class="mut">🤖 AI đang đọc file và gợi ý loại văn bản…</p></div>';
  const [{data:mau},{data:vv}]=await Promise.all([sb.from('mau_van_ban').select('ma,ten,loai,mo_ta').eq('hoat_dong',true).order('thu_tu'),sb.from('viec').select('nguoi_giao,trang_thai').eq('id',viecId).single()]);
  const choKet=vv&&vv.nguoi_giao===me.id&&vv.trang_thai!=='da_dong';
  // Số liệu đưa vào văn bản = câu trả lời MỚI NHẤT của AI trong khung chat về tệp (người dùng tự bảo AI đưa bản đầy đủ)
  const KQ=Array.isArray(aiKQ)?aiKQ:[],layKQ=()=>KQ.length?KQ[KQ.length-1]:'';
  const goiYP=goiVB({action:'goi_y',viec_id:viecId,file_path:path,ket_qua_ai:layKQ()});
  k.innerHTML=`<div class="aisoan">
  <b>① Loại văn bản</b> <span class="mut" id="vgy">(AI đang gợi ý…)</span>
  ${(mau||[]).map(m=>`<label class="vlb"><input type="radio" name="vmau" class="vck" value="${m.ma}"><span><b>${esc(m.ten)}</b><br><span class="mut">${esc(m.mo_ta||'')}</span></span></label>`).join('')}
  <b>② Ý chính</b> <span class="mut">(AI viết sẵn, bạn sửa lại cho đúng ý)</span>
  <textarea id="vyc" rows="5" placeholder="Đang chờ AI gợi ý… hoặc tự gõ ý của bạn"></textarea>
  <button id="vsoan" class="full">✨ Soạn văn bản</button>
  <p class="mut" id="vtt"></p><div id="vkq"></div></div>
  <div class="vfoot"><button id="vluu" class="full" disabled>💾 Lưu</button><button id="vtai" class="sec" disabled>⬇ Tải Word</button>${choKet?'<button id="vket" class="full" style="background:#15803d">✔ Kết thúc việc</button>':''}</div>`;
  const kq=$('#vkq'),DS=[];
  // AI trả lời chậm hơn người dùng: nếu người dùng đã tự chọn loại văn bản thì KHÔNG được đè lên
  k.querySelectorAll('.vck').forEach(c=>c.addEventListener('change',()=>{k.dataset.tuchon='1';$('#vgy').textContent='(bạn đã chọn)'}));
  goiYP.then(r=>{
    const daChon=k.dataset.tuchon==='1'||k.querySelector('.vck:checked');
    if(r.mau_ma&&!daChon){const x=k.querySelector(`.vck[value="${r.mau_ma}"]`);if(x)x.checked=true}
    if(r.y_chinh&&!$('#vyc').value)$('#vyc').value=r.y_chinh;
    $('#vgy').textContent=daChon?'(bạn đã chọn)':r.loi?'(không gợi ý được, bạn tự chọn)':(r.mau_ma?'(AI đã chọn sẵn, bạn đổi được)':'(bạn chọn giúp)');
    if(r.loi)toast(r.loi)});
  const capNhatNut=()=>{const chua=DS.filter(d=>!d.luu).length;$('#vluu').disabled=!DS.length||!chua;$('#vluu').textContent=!DS.length?'💾 Lưu':chua?`💾 Lưu (${chua} văn bản)`:'✅ Đã lưu hết';$('#vtai').disabled=!DS.length};
  const xem=async r=>{const x=await goiVB({action:'tai',van_ban_id:r.id});if(!x.url)return toast(x.loi||'Lỗi');xemTep(null,r.ten,null,x.url,r.text)};
  const dichLoi=t=>{t=String(t||'');
    if(/항목이 없습니다|No item with the given ID|not found/i.test(t))return 'Tài khoản chạy Apps Script không mở được thư mục Drive. Cần dán lại mã VanBan.gs rồi Triển khai > Phiên bản MỚI.';
    if(/permission|권한/i.test(t))return 'Thư mục Drive chưa chia sẻ quyền sửa cho tài khoản chạy Apps Script.';
    return t};
  const luuMot=async r=>{const x=await goiVB({action:'luu',van_ban_id:r.id});if(x.loi){toast(dichLoi(x.loi));return null}r.luu=true;r.drive=!!x.drive;r.thu=x.thu_muc||'';r.canh=dichLoi(x.canh||'');return x};
  const veVB=r=>{
    const d=r.el||(r.el=document.createElement('div'));d.className='aib m';
    d.innerHTML=`<div class="ait">📄 ${esc(r.ten)}</div><div class="mut">${r.luu?(r.drive?'✅ Đã lưu vào Drive: '+esc(r.thu):'✅ Đã lưu trong app'+(r.canh?' (chưa vào Drive: '+esc(r.canh)+')':'')):'Chưa lưu'}</div><div class="aia"><button class="sec" data-x>👁 Xem</button> <button class="sec" data-c>✏️ Chỉnh lại</button></div>
    <div data-cf style="display:none;margin-top:6px"><textarea rows="2" placeholder="Chỗ nào chưa vừa ý? VD: thêm căn cứ Quy chế chi tiêu, đổi mức chi thành 2.500.000 đ" style="width:100%"></textarea><button data-cg style="width:100%">Chỉnh &amp; soạn lại</button></div>`;
    d.querySelector('[data-x]').onclick=()=>xem(r);
    d.querySelector('[data-c]').onclick=()=>{const f=d.querySelector('[data-cf]');f.style.display=f.style.display==='none'?'block':'none'};
    d.querySelector('[data-cg]').onclick=async e=>{const t=d.querySelector('textarea').value.trim();if(!t)return toast('Ghi chỗ cần chỉnh');const b=ban(e.target);
      const x=await goiVB({action:'soan',viec_id:viecId,mau_ma:r.mau,file_path:path,van_ban_cu:r.id,ket_qua_ai:layKQ(),yeu_cau:'CHỈNH SỬA văn bản đã soạn theo ý sau: '+t});
      if(x.loi){b.disabled=false;b.textContent='Chỉnh & soạn lại';return toast(x.loi)}
      const n={id:x.id,ten:x.ten,mau:r.mau,luu:false,text:x.text};DS.splice(DS.indexOf(r),1,n);veVB(n);kq.insertBefore(n.el,d);d.remove();
      for(const q of (x.phu_lucs&&x.phu_lucs.length?x.phu_lucs:(x.phu_luc?[x.phu_luc]:[]))){if(!q||!q.id)continue;const pl={id:q.id,ten:q.ten,mau:r.mau,luu:false,text:q.text};DS.push(pl);veVB(pl)}
      capNhatNut();xem(n)};
    if(!d.parentNode)kq.appendChild(d)};
  $('#vsoan').onclick=async()=>{
    const ma=(k.querySelector('.vck:checked')||{}).value;
    if(!ma)return toast('Chọn loại văn bản ở bước ①');
    if(!$('#vyc').value.trim())return toast('Nhập ý chính ở bước ②');
    const b=$('#vsoan');b.disabled=true;$('#vtt').textContent='⏳ AI đang viết vào khung Word của bệnh viện… (khoảng 10–40 giây)';
    const r=await goiVB({action:'soan',viec_id:viecId,mau_ma:ma,file_path:path,ket_qua_ai:layKQ(),yeu_cau:$('#vyc').value.trim()});
    b.disabled=false;
    if(r.loi){$('#vtt').textContent='⚠ '+r.loi;return}
    ov.dataset.vb=1;const o={id:r.id,ten:r.ten,mau:ma,luu:false,text:r.text};DS.push(o);veVB(o);
    for(const q of (r.phu_lucs&&r.phu_lucs.length?r.phu_lucs:(r.phu_luc?[r.phu_luc]:[]))){if(!q||!q.id)continue;const pl={id:q.id,ten:q.ten,mau:ma,luu:false,text:q.text};DS.push(pl);veVB(pl)}
    capNhatNut();
    $('#vtt').textContent=(r.canh_bao?'⚠ '+r.canh_bao+'\n':'')+'✅ Đã soạn xong. Bấm "👁 Xem" kiểm tra, chưa vừa ý thì "✏️ Chỉnh lại", ổn thì bấm 💾 Lưu.';
    $('#vtt').style.whiteSpace='pre-line';xem(o)};
  $('#vluu').onclick=async()=>{
    const b=ban($('#vluu'));let nd=0,loiN=0,canh='';
    for(const r of DS.filter(d=>!d.luu)){const x=await luuMot(r);if(x){x.drive?nd++:canh=x.canh;veVB(r)}else loiN++}
    capNhatNut();
    $('#vtt').textContent=loiN?'⚠ Có văn bản chưa lưu được, bấm Lưu lần nữa.':nd?'✅ Đã lưu vào thư mục Drive của loại công việc. Xem lại xong thì bấm ✔ Kết thúc việc.':'✅ Đã lưu trong app. Chưa đưa được vào Drive'+(canh?': '+dichLoi(canh):'')+'. Tải Word về để tự cất nếu cần.'};
  $('#vtai').onclick=async()=>{for(const r of DS){const x=await goiVB({action:'tai',van_ban_id:r.id});if(x.url){await taiVe(x.url,r.ten);await new Promise(o=>setTimeout(o,600))}else toast(x.loi||'Lỗi')}};
  if($('#vket'))$('#vket').onclick=async()=>{
    const chua=DS.filter(d=>!d.luu).length;
    if(!confirm((chua?`Còn ${chua} văn bản chưa lưu.\n\n`:'')+'Kết thúc việc này, xem như đã hoàn chỉnh?'))return;
    await qAdd({ma_khach:uid(),viec_id:viecId,trang_thai:'da_dong',ghi_chu:'Kết thúc: hồ sơ đã hoàn chỉnh',anh:null,tep:null,tep_ten:null,gio_bam:new Date().toISOString(),vi_tri_loi:'Không lấy vị trí khi kết thúc việc'});
    await day();
    if((await qAll()).some(o=>o.viec_id===viecId))return toast('Chưa gửi được, bấm dòng chữ góc trên bên phải để xem lý do');
    document.querySelectorAll('.vw').forEach(x=>x.remove());toast('Đã kết thúc việc, việc không còn trong danh sách');ve();
  };
}
// ---- Trình xem Word tự viết (không cần tải thư viện ngoài, không bị treo) ----
async function giaiNen(buf,ten){
  const dv=new DataView(buf),u8=new Uint8Array(buf);let e=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-70000);i--)if(dv.getUint32(i,true)===0x06054b50){e=i;break}
  if(e<0)throw new Error('Không phải file Word hợp lệ');
  let n=dv.getUint16(e+10,true),o=dv.getUint32(e+16,true);
  for(;n>0;n--){
    const m=dv.getUint16(o+10,true),cs=dv.getUint32(o+20,true),nl=dv.getUint16(o+28,true),xl=dv.getUint16(o+30,true),cl=dv.getUint16(o+32,true),lh=dv.getUint32(o+42,true);
    const nm=new TextDecoder().decode(u8.subarray(o+46,o+46+nl));
    if(nm===ten){const st=lh+30+dv.getUint16(lh+26,true)+dv.getUint16(lh+28,true),dt=u8.subarray(st,st+cs);
      if(m===0)return dt;
      return new Uint8Array(await new Response(new Blob([dt]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())}
    o+=46+nl+xl+cl}
  throw new Error('Không thấy nội dung trong file Word');
}
async function docxHtml(buf){
  const xml=new TextDecoder().decode(await giaiNen(buf,'word/document.xml'));
  const d=new DOMParser().parseFromString(xml,'application/xml');
  if(d.querySelector('parsererror'))throw new Error('File Word bị lỗi cấu trúc');
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',L=(el,t)=>[...el.children].filter(c=>c.localName===t);
  const val=(el,t)=>{const x=L(el,t)[0];return x?x.getAttributeNS(W,'val')||x.getAttribute('w:val')||'':null};
  const bat=(rp,t)=>{if(!rp)return false;const x=L(rp,t)[0];if(!x)return false;const v=x.getAttributeNS(W,'val')||x.getAttribute('w:val');return v!=='0'&&v!=='false'};
  const txt=el=>{let r='';(function w(n){for(const c of n.children){
    if(c.localName==='Fallback')continue;
    if(c.localName==='t')r+=c.textContent;else if(c.localName==='tab')r+=' ';else if(c.localName==='br'||c.localName==='cr')r+='\n';else w(c)}})(el);return r};
  const HL={yellow:'#ffff00',green:'#00ff00',cyan:'#00ffff',magenta:'#ff00ff',blue:'#9ec5ff',red:'#ff9d9d',darkYellow:'#cccc00',lightGray:'#d3d3d3'};
  const xoa=r=>r.parentNode&&r.parentNode.localName==='del';
  const run=r=>{let t=txt(r);if(!t&&xoa(r)){(function w(n){for(const c of n.children)if(c.localName==='delText')t+=c.textContent;else w(c)})(r)}
    if(!t)return '';t=esc(t).replace(/\n/g,'<br>');const rp=L(r,'rPr')[0];
    if(bat(rp,'b'))t='<b>'+t+'</b>';if(bat(rp,'i'))t='<i>'+t+'</i>';if(rp&&L(rp,'u')[0]&&val(rp,'u')!=='none')t='<u>'+t+'</u>';
    let st='';const mau=rp&&val(rp,'color'),hl=rp&&val(rp,'highlight'),sh=rp&&L(rp,'shd')[0];
    if(mau&&/^[0-9a-f]{6}$/i.test(mau)&&mau.toLowerCase()!=='000000')st+='color:#'+mau+';';
    if(hl&&HL[hl])st+='background:'+HL[hl]+';';else if(sh){const f=sh.getAttributeNS(W,'fill')||sh.getAttribute('w:fill');if(f&&/^[0-9a-f]{6}$/i.test(f)&&f.toLowerCase()!=='ffffff')st+='background:#'+f+';'}
    if(bat(rp,'strike')||xoa(r)){st+='text-decoration:line-through;';if(xoa(r)&&!/color:/.test(st))st+='color:#c00;'}
    if(rp&&val(rp,'vertAlign')==='superscript')t='<sup>'+t+'</sup>';else if(rp&&val(rp,'vertAlign')==='subscript')t='<sub>'+t+'</sub>';
    return st?`<span style="${st}">${t}</span>`:t};
  const para=p=>{const pp=L(p,'pPr')[0];const jc=pp?val(pp,'jc'):'';const al=jc==='center'?'center':jc==='right'||jc==='end'?'right':jc==='both'?'justify':'left';
    let h='';(function w(n){for(const c of n.children){if(c.localName==='Fallback')continue;if(c.localName==='r')h+=run(c);else if(c.localName==='p')continue;else w(c)}})(p);
    const ind=pp&&L(pp,'ind')[0],A=(e,k)=>e?parseInt(e.getAttributeNS(W,k)||e.getAttribute('w:'+k)||0):0,fl=A(ind,'firstLine'),lf=A(ind,'left'),rt=A(ind,'right'),hg=A(ind,'hanging');
    const sp=pp&&L(pp,'spacing')[0],bf=sp?A(sp,'before'):0,af=sp?A(sp,'after'):0,ln=sp?A(sp,'line'):0,lr=sp?(sp.getAttributeNS(W,'lineRule')||sp.getAttribute('w:lineRule')||'auto'):'auto';
    const st=`text-align:${al};margin:${(bf/20).toFixed(1)}pt 0 ${(af/20).toFixed(1)}pt 0;${ln&&lr==='auto'?'line-height:'+(ln/240).toFixed(2)+';':''}${fl>0?'text-indent:'+(fl/20)+'pt;':''}${hg>0?'text-indent:-'+(hg/20)+'pt;':''}${lf>0?'padding-left:'+(lf/20+(hg>0?0:0))+'pt;':''}${rt>0?'padding-right:'+(rt/20)+'pt;':''}`;
    return `<p style="${st}">${h||'&nbsp;'}</p>`};
  const bang=t=>{const pr=L(t,'tblPr')[0],bd=pr&&L(pr,'tblBorders')[0],cob=!!bd&&[...bd.children].some(c=>!/^(none|nil)$/.test(c.getAttributeNS(W,'val')||c.getAttribute('w:val')||'')),kv=cob?'1px solid #666':'none';return `<table style="border-collapse:collapse;width:100%;margin:6px 0">`+L(t,'tr').map(tr=>'<tr>'+L(tr,'tc').map(tc=>`<td style="border:${kv};padding:3px 6px;vertical-align:${(tc=>{const v=L(tc,'tcPr')[0]&&L(L(tc,'tcPr')[0],'vAlign')[0];return v&&(v.getAttributeNS(W,'val')||v.getAttribute('w:val'))==='center'?'middle':'top'})(tc)}">${L(tc,'p').map(para).join('')||''}</td>`).join('')+'</tr>').join('')+'</table>'};
  let out='';const body=d.getElementsByTagNameNS(W,'body')[0];
  for(const c of body.children){if(c.localName==='p')out+=para(c);else if(c.localName==='tbl')out+=bang(c);else if(c.localName==='sdt'){const k=L(c,'sdtContent')[0];if(k)for(const x of k.children){if(x.localName==='p')out+=para(x);else if(x.localName==='tbl')out+=bang(x)}}}
  return out;
}
async function xemTep(path,ten,viecId,urlSan,textDP){
  const ov=document.createElement('div');ov.className='vw';
  ov.innerHTML=`<div class="vwh"><b>${esc(ten||'Tệp')}</b><span><a id="vwtai" href="#" download>⬇ Tải</a> <button class="sec" id="vwx">✕ Đóng</button></span></div><div class="vwb" id="vwb">Đang mở…</div>`;
  document.body.appendChild(ov);ov.querySelector('#vwx').onclick=()=>{const cap=ov.dataset.vb&&viecId;ov.remove();if(cap)chiTiet(viecId)};
  const b=ov.querySelector('#vwb');
  if(viecId&&/^(xlsx|docx)$/.test(duoiTep(ten)))khungAI(ov,viecId,path,ten);
  try{
    const url=urlSan||await linkTep(path,ten);if(!url)throw new Error('Không lấy được đường dẫn file');ov.querySelector('#vwtai').href=url;
    const d=duoiTep(ten);
    if(d==='pdf'||/^(jpe?g|png|webp)$/.test(d)){const u2=urlSan||(await sb.storage.from('anh').createSignedUrl(path,3600)).data?.signedUrl;ov.querySelector('#vwtai').href=urlSan||await linkTep(path,ten)||u2;b.style.padding='0';b.innerHTML=d==='pdf'?`<iframe src="${u2}" style="width:100%;height:100%;border:0"></iframe>`:`<img src="${u2}" alt="Ảnh đính kèm" loading="lazy" decoding="async" style="max-width:100%;aspect-ratio:4/3;object-fit:cover;background:var(--soft);border-radius:8px">`;return}
    const hen=(pr,ms,tb)=>Promise.race([pr,new Promise((_,no)=>setTimeout(()=>no(new Error(tb||'Mở file quá lâu')),ms))]);
    if(textDP){
      const bn='<div class="vwdoc" style="white-space:pre-wrap;font-family:\'Times New Roman\',serif;font-size:17px;line-height:1.5">'+esc(textDP)+'</div><p class="mut" style="padding:8px">Đây là bản xem nhanh nội dung. File Word tải về có đủ quốc hiệu, bảng, chữ ký đúng mẫu bệnh viện.</p>';
      b.innerHTML=bn;
      try{const bf=await hen((async()=>(await fetch(url)).arrayBuffer())(),15000);const h=await docxHtml(bf);if(document.body.contains(ov))b.innerHTML='<div class="vwdoc" style="font-family:\'Times New Roman\',serif;font-size:17px">'+sach(h)+'</div>'}catch(er){b.dataset.err=String(er.message||er)}
      return}
    const buf=await hen((async()=>(await fetch(url)).arrayBuffer())(),20000,'Tải file quá lâu, kiểm tra mạng rồi mở lại');
    if(d==='xlsx'||d==='xls'){
      await taiXlsx();const wb=XLSX.read(buf,{type:'array'});
      const ve1=i=>{const ws=wb.Sheets[wb.SheetNames[i]];const r=XLSX.utils.decode_range(ws['!ref']||'A1');
        const cat=r.e.r>1000||r.e.c>40;if(cat){r.e.r=Math.min(r.e.r,1000);r.e.c=Math.min(r.e.c,40);ws['!ref']=XLSX.utils.encode_range(r)}
        ov.querySelector('#vwt').innerHTML=sach(XLSX.utils.sheet_to_html(ws,{header:'',footer:''}))+(cat?'<p class="mut">Chỉ hiển thị 1000 dòng × 40 cột đầu, tải file để xem đủ.</p>':'');
        ov.querySelectorAll('.vwtab').forEach((x,k)=>x.classList.toggle('on',k===i))};
      b.innerHTML=`<div class="vwtabs">${wb.SheetNames.map((n,i)=>`<button class="vwtab sec" data-i="${i}">${esc(n)}</button>`).join('')}</div><div id="vwt" class="vwt"></div>`;
      b.querySelectorAll('.vwtab').forEach(x=>x.onclick=()=>ve1(+x.dataset.i));ve1(0);
    }else if(d==='docx'){
      b.innerHTML='<div class="vwdoc" style="font-family:\'Times New Roman\',serif;font-size:17px">'+sach(await hen(docxHtml(buf),15000,'Không đọc được file này, bấm Tải ở trên để mở bằng Word'))+'</div>';
    }else b.innerHTML='<p>File .doc đời cũ chưa xem trực tiếp được, bấm "Tải" ở trên để mở bằng Word.</p>';
  }catch(e){b.innerHTML='<p style="color:#b91c1c">Không mở được file: '+esc(e.message||String(e))+'</p>'}
}
// ---- Soạn văn bản theo mẫu bệnh viện (v48) ----
async function goiVB(body){
  const {data,error}=await sb.functions.invoke('soan-mau',{body});
  if(error){let m=error.message;const st=error.context&&error.context.status;
    try{const j=await error.context.json();m=j.loi||m}catch(_){
      if(st===546||st===504)m='AI soạn lâu quá nên máy chủ cắt ngang. Bồ bấm "✨ Soạn văn bản" lại, hoặc rút gọn ý chính cho ngắn hơn.';
      else if(st===502||st===503)m='Máy chủ AI đang bận. Bồ bấm soạn lại sau ít phút.';
      else if(st)m='Máy chủ báo lỗi '+st+'. Bồ bấm soạn lại, còn lỗi thì báo tui.'}
    return {loi:m}}
  return data||{loi:'Không có phản hồi'}
}
async function taiVe(url,ten){
  try{const b=await (await fetch(url)).blob(),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=ten||'van-ban.docx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),20000)}
  catch(_){const a=document.createElement('a');a.href=url;a.download=ten||'';document.body.appendChild(a);a.click();a.remove()}}
async function bangVB(v,laGiao){
  const id=v.id,nd=$('#nd');
  const [{data:mau},{data:lcv},{data:ds}]=await Promise.all([
    sb.from('mau_van_ban').select('ma,ten,loai,mo_ta').eq('hoat_dong',true).order('thu_tu'),
    sb.from('loai_cong_viec').select('ma,ten').order('thu_tu'),
    sb.from('van_ban_viec').select('id,mau_ma,ten_file,drive_url,tao_luc,luu_luc').eq('viec_id',id).order('tao_luc',{ascending:false})]);
  if(!(mau||[]).length)return;
  const nhom=[['to_trinh','Tờ trình'],['quyet_dinh','Quyết định']];
  const dong=v.trang_thai==='da_dong';
  const c=document.createElement('div');c.className='card';c.id='vbp';
  const ve_ds=l=>(l||[]).map(d=>`<div class="it" style="padding:8px 0"><div>📄 ${esc(d.ten_file)}</div><div class="mut">${fmt(d.tao_luc)} · ${d.drive_url?'✅ Đã lưu Drive · <a href="'+esc(d.drive_url)+'" target="_blank" rel="noopener">Mở</a>':'chưa lưu Drive'}</div>
    <button class="sec" data-vt="${d.id}" data-vn="${esc(d.ten_file)}">⬇ Tải</button> ${d.drive_url?'':`<button class="sec" data-vl="${d.id}">💾 Lưu Drive</button>`}</div>`).join('')||'<p class="mut">Chưa soạn văn bản nào.</p>';
  c.innerHTML=`<h3>📁 Văn bản đã soạn &amp; hoàn tất việc</h3>
  <label style="display:none">Loại công việc</label><select id="vlcv" style="display:none" ${laGiao?'':'disabled'}>${(lcv||[]).map(l=>`<option value="${l.ma}" ${l.ma===(v.loai_cv||'khac')?'selected':''}>${esc(l.ten)}</option>`).join('')}</select>
  <p class="mut">Muốn soạn báo cáo, tờ trình, quyết định: bấm "✨ Làm việc này cùng AI" ở trên.</p>
  <div id="vds">${ve_ds(ds)}</div>
  ${laGiao&&v.nguoi_giao===me.id&&!dong?'<button class="full" id="vket" style="margin-top:10px;background:#15803d">✔ Kết thúc việc (hồ sơ đã hoàn chỉnh)</button>':''}`;
  const tl=nd.querySelector('.timeline');tl?nd.insertBefore(c,tl):nd.appendChild(c);
  const lamMoi=async()=>{const {data}=await sb.from('van_ban_viec').select('id,mau_ma,ten_file,drive_url,tao_luc,luu_luc').eq('viec_id',id).order('tao_luc',{ascending:false});$('#vds').innerHTML=ve_ds(data);gan2()};
  const gan2=()=>{
    c.querySelectorAll('[data-vt]').forEach(b=>b.onclick=async()=>{ban(b);const r=await goiVB({action:'tai',van_ban_id:b.dataset.vt});ban(b,false);r.url?taiVe(r.url,b.dataset.vn):toast(r.loi||'Lỗi')});
    c.querySelectorAll('[data-vl]').forEach(b=>b.onclick=async()=>{ban(b);const r=await goiVB({action:'luu',van_ban_id:b.dataset.vl});if(r.loi){ban(b,false);return toast(r.loi)}toast('Đã lưu vào Drive: '+(r.thu_muc||''));lamMoi()})};
  gan2();
  $('#vlcv').onchange=async()=>{const {error}=await sb.from('viec').update({loai_cv:$('#vlcv').value}).eq('id',id);toast(error?'Không đổi được: '+error.message:'Đã đổi loại công việc');if(!error)v.loai_cv=$('#vlcv').value};
  if($('#vket'))$('#vket').onclick=async()=>{
    const {data}=await sb.from('van_ban_viec').select('drive_url').eq('viec_id',id);
    const chua=(data||[]).filter(d=>!d.drive_url).length;
    if(!confirm((chua?`Còn ${chua} văn bản chưa lưu vào Drive.\n\n`:'')+'Kết thúc việc này, xem như đã hoàn chỉnh?'))return;
    await qAdd({ma_khach:uid(),viec_id:id,trang_thai:'da_dong',ghi_chu:'Kết thúc: hồ sơ đã hoàn chỉnh',anh:null,tep:null,tep_ten:null,gio_bam:new Date().toISOString(),vi_tri_loi:'Không lấy vị trí khi kết thúc việc'});
    await day();
    if((await qAll()).some(o=>o.viec_id===id))return toast('Chưa gửi được, bấm dòng chữ góc trên bên phải để xem lý do');
    toast('Đã kết thúc việc, việc không còn trong danh sách');ve();
  };
}
async function chiTiet(id){
  const [{data:v},{data:cn}]=await Promise.all([
    sb.from('viec').select('*').eq('id',id).single(),
    sb.from('cap_nhat_hien_trang').select('*').eq('viec_id',id).order('gio_bam',{ascending:false})]);
  const urls={},furls={};
  for(const c of cn||[]){if(c.anh_path){const r=await sb.storage.from('anh').createSignedUrl(c.anh_path,3600);urls[c.id]=r.data?.signedUrl}
    if(c.file_path)furls[c.id]=await linkTep(c.file_path,c.file_ten)}
  const vurl=v.file_path?await linkTep(v.file_path,v.file_ten):null;
  const laNhan=v.nguoi_nhan===me.id, laGiao=v.nguoi_giao===me.id||me.vai_tro==='tchc'||me.vai_tro==='bgd';
  const B=dsBuoc(v),iB=B?buocDang(B):-1,duocLam=(laNhan||v.nguoi_giao===me.id)&&v.trang_thai!=='da_dong';
  const opts=[];if(laNhan&&!B){opts.push(['dang_lam','Đang làm'],['cho_xac_nhan','Báo hoàn thành (chờ xác nhận)'])}
  if(laGiao&&v.nguoi_giao===me.id&&!B)opts.push(['da_dong','Xác nhận đóng việc']);
  const thanhBuoc=!B?'':`<div class="card bsteps">${B.map((b,i)=>`<div class="bs ${b.xong?(b.bo_qua?'bqua':'xong'):i===iB?'dang':''}" data-bs="${i}"><i>${b.xong?(b.bo_qua?'⤼':'✓'):i+1}</i><span>${esc(b.ten)}</span>${b.luc?`<small>${fmt(b.luc)}${b.boi?' · '+esc(ten(b.boi)):''}</small>`:''}${b.ghi?`<small>${esc(b.ghi)}</small>`:''}</div>`).join('')}</div>`;
  const cardBuoc=!B?'':(iB>=B.length
    ?`<div class="card" style="border-left:4px solid #15803d"><b>✓ Đã xong cả ${B.length} bước.</b> <span class="mut">${v.trang_thai==='da_dong'?'Việc đã đóng.':'Đang chờ người giao xác nhận đóng việc.'}</span></div>`
    :`<div class="card bnow"><div class="mut">Bước ${iB+1}/${B.length}</div><h3>${esc(B[iB].ten)}</h3>${B[iB].goi_y?`<p class="mut">${esc(B[iB].goi_y)}</p>`:''}
      ${duocLam?`${B[iB].nut==='ai'?'<button class="full" id="bai">✨ Làm bước này cùng AI</button>':B[iB].nut==='doi_chieu'?'<button class="full" id="bdc">🔎 Đối chiếu báo cáo với hồ sơ</button>':''}
      <label>Ghi lại kết quả bước này (không bắt buộc)</label><textarea id="bgc" rows="2"></textarea>
      <label>📎 Hồ sơ của bước này</label><input id="bdk" type="file" accept="image/*,.doc,.docx,.xls,.xlsx,.pdf">
      <button class="full" id="bxong">✔ Xong bước này${iB+1<B.length?', sang bước '+(iB+2):', báo hoàn thành'}</button>
      <button class="sec" id="bbo" style="width:100%;margin-top:6px">⤼ Bỏ qua bước này</button>`:'<p class="mut">Chỉ người nhận hoặc người giao việc mới ghi được bước.</p>'}</div>`);
  $('#nd').innerHTML=`<button class="sec" id="lui">← Quay lại</button>
  <div class="card" style="margin-top:10px"><h3>${esc(v.tieu_de)}</h3>${tag(v.trang_thai)}<p>${esc(v.mo_ta||'')}</p>
  <div class="mut">Giao: ${esc(ten(v.nguoi_giao))} → ${esc(ten(v.nguoi_nhan))}${v.han?'<br>Hạn '+fmt(v.han):'<br><b style="color:#b45309">⚠ Chưa có hạn nên app không nhắc được</b>'}${(laNhan||v.nguoi_giao===me.id)&&v.trang_thai!=='da_dong'?` · <a href="#" id="dhan">⏰ ${v.han?'Đổi':'Đặt'} hạn</a><div id="hanbox" style="display:none;margin-top:6px"><input id="han2" type="datetime-local"> <button class="sec" id="luuhan">Lưu hạn</button></div>`:''}</div>${v.file_path?`<p><a href="${vurl||'#'}" download>${bieuTuongTep(v.file_ten)} ${esc(v.file_ten||'Tệp đính kèm')}</a> · <a href="#" data-xp="${esc(v.file_path)}" data-xt="${esc(v.file_ten||'')}">👁 Xem</a></p>`:''}</div>
  ${thanhBuoc}${cardBuoc}
  ${!B&&duocLam?`<div class="card" id="apq"><b>Chạy việc này theo quy trình?</b><div class="mut">Chọn loại việc để app bày sẵn các bước phải làm, làm tới đâu tích tới đó.</div><select id="apl"><option value="">Đang tải…</option></select><button class="sec" id="apb" style="width:auto;margin-top:6px">⚙ Áp quy trình</button></div>`:''}
  ${(laNhan||opts.length)&&!B?`<div class="card"><label>Cập nhật hiện trạng</label><select id="st"><option value="">Giữ nguyên trạng thái</option>${opts.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
  <label>Ghi chú</label><textarea id="gc"></textarea><label>📎 Ảnh hoặc file Word / Excel / PDF (chụp ảnh tại chỗ hoặc chọn file, tối đa 10 MB)</label><input id="dk" type="file" accept="image/*,.doc,.docx,.xls,.xlsx,.pdf">
  <button class="full" id="gui">📷 Gửi cập nhật</button><p class="mut">Vị trí GPS chỉ lấy tại lúc bấm Gửi.</p></div>`:''}
  ${B&&duocLam?`<div class="card"><label>Ghi chú thêm / gửi hồ sơ ngoài các bước</label><textarea id="gc" rows="2"></textarea><input id="dk" type="file" accept="image/*,.doc,.docx,.xls,.xlsx,.pdf"><button class="sec full" id="gui">📷 Gửi cập nhật</button></div>`:''}
  <div class="timeline">${(cn||[]).map(c=>`<div class="it"><b>${esc(ten(c.nguoi_id))}</b> <span class="mut">${fmt(c.gio_bam)}</span> ${c.trang_thai?tag(c.trang_thai):''}<div>${esc(c.ghi_chu||'')}</div>${urls[c.id]?`<img src="${urls[c.id]}" alt="Ảnh hiện trường" loading="lazy" decoding="async">`:''}${c.file_path?`<div><a href="${furls[c.id]||'#'}" download>${bieuTuongTep(c.file_ten)} ${esc(c.file_ten||'Tệp đính kèm')}</a> · <a href="#" data-xp="${esc(c.file_path)}" data-xt="${esc(c.file_ten||'')}">👁 Xem</a></div>`:''}${c.co_vi_tri?bando(c):`<div class="mut" style="color:#b45309">⚠ Không có vị trí${c.vi_tri_loi?': '+esc(c.vi_tri_loi):''}</div>`}</div>`).join('')||'<p class="mut">Chưa có cập nhật.</p>'}</div>`;
  if(me.la_quan_tri||v.nguoi_giao===me.id){
    const nk=(cn||[]).filter(c=>c.nguoi_id!==me.id).length;
    $('#nd').insertAdjacentHTML('beforeend',`<button class="full dng" id="xoa" style="margin-top:10px">🗑 Xóa việc này${me.la_quan_tri&&v.nguoi_giao!==me.id?' (quản trị)':''}</button>`);
    $('#xoa').onclick=()=>xoaMuc('viec',id,'Xóa vĩnh viễn việc này cùng lịch sử cập nhật?'+(nk?'\n\n⚠ Việc này đã có '+nk+' cập nhật của người khác, xóa là mất luôn.':''),ve)}
  $('#lui').onclick=ve;
  if(v.trang_thai!=='da_dong'&&(laNhan||v.nguoi_giao===me.id)&&!B){
    $('#nd').querySelector('.card').insertAdjacentHTML('afterend','<button class="full" id="tlmo" style="margin:0 0 10px;padding:14px;font-size:1.05em">✨ Làm việc này cùng AI<br><span style="font-weight:400;font-size:.8em">đọc văn bản · gợi ý loại việc · soạn báo cáo từ mẫu năm trước</span></button>');
    $('#tlmo').onclick=()=>troLy(id)}
  if(v.trang_thai==='cho_xac_nhan'&&v.nguoi_giao===me.id){
    $('#nd').querySelector('.card').insertAdjacentHTML('afterend',`<div class="card" style="border:2px solid #2e7d4f"><b>${esc(ten(v.nguoi_nhan))} đã báo hoàn thành, đang chờ bồ xác nhận.</b><p class="mut">Xem báo cáo/tệp bên dưới xong thì bấm một trong hai nút. Việc chưa đóng thì app còn nhắc bồ.</p>
      <button class="full" id="xnd">✔ Xác nhận, đóng việc</button><button class="sec" id="xnl" style="width:100%;margin-top:6px">↩ Chưa đạt, yêu cầu làm lại</button></div>`);
    const chot=async(tt,gc)=>{[$('#xnd'),$('#xnl')].forEach(b=>b.disabled=true);
      await qAdd({ma_khach:uid(),viec_id:id,trang_thai:tt,ghi_chu:gc,anh:null,tep:null,tep_ten:null,gio_bam:new Date().toISOString()});await day();
      if((await qAll()).some(o=>o.viec_id===id)){[$('#xnd'),$('#xnl')].forEach(b=>b&&(b.disabled=false));return toast('Chưa gửi được, bấm dòng chữ góc trên bên phải để xem lý do')}
      toast(tt==='da_dong'?'Đã đóng việc':'Đã trả lại để làm lại');if(tt==='da_dong')ve();else chiTiet(id)};
    $('#xnd').onclick=()=>chot('da_dong','Đã xem và xác nhận hoàn thành');
    $('#xnl').onclick=()=>{const g=prompt('Cần làm lại điểm nào? (ghi ngắn để người nhận biết)');if(g===null)return;chot('dang_lam',g.trim()||'Chưa đạt, làm lại')};
  }
  if($('#apq'))sb.from('loai_viec').select('id,nhom,ten,buoc,can_cu').eq('hoat_dong',true).order('thu_tu').then(({data})=>{
    const L=(data||[]).filter(l=>Array.isArray(l.buoc)&&l.buoc.length);if(!$('#apl'))return;
    if(!L.length){$('#apq').innerHTML='<div class="mut">Chưa loại việc nào khai báo các bước. Vào Tôi → Danh mục loại việc để khai báo.</div>';return}
    $('#apl').innerHTML=L.map(l=>`<option value="${l.id}" ${l.id===v.loai_viec_id?'selected':''}>${esc(l.nhom)} · ${esc(l.ten)} (${l.buoc.length} bước)</option>`).join('');
    $('#apb').onclick=async()=>{const l=L.find(x=>x.id==$('#apl').value);if(!l)return;
      const {error}=await sb.from('viec').update({loai_viec_id:l.id,thu_muc_dc:v.thu_muc_dc||l.can_cu||null,
        cac_buoc:l.buoc.map(x=>({ten:x.ten,goi_y:x.goi_y||'',nut:x.nut||null,xong:false}))}).eq('id',id);
      if(error)return toast('Không áp được: '+error.message);toast('Đã áp quy trình '+l.ten);chiTiet(id)}});
  if($('#bai'))$('#bai').onclick=()=>troLy(id);
  if($('#bdc'))$('#bdc').onclick=()=>{const t=(cn||[]).find(c=>c.file_path&&/\.docx$/i.test(c.file_ten||''))||(v.file_path&&/\.docx$/i.test(v.file_ten||'')?v:null);
    if(!t)return toast('Chưa có báo cáo Word nào trong việc này để đối chiếu');doiChieuUI(id,t.file_path)};
  const ghiBuoc=async bo=>{
    const bt=$('#bxong'),bb=$('#bbo');[bt,bb].forEach(x=>x&&(x.disabled=true));
    const ghi=($('#bgc').value||'').trim();
    if(bo&&!ghi){toast('Bỏ qua bước thì ghi lý do vào ô ghi chú');[bt,bb].forEach(x=>x&&(x.disabled=false));return}
    const M=B.map(x=>({...x}));M[iB]={...M[iB],xong:true,bo_qua:!!bo,luc:new Date().toISOString(),boi:me.id,ghi:ghi||null};
    const xongHet=M.every(x=>x.xong),tt=xongHet&&v.trang_thai!=='da_dong'?'cho_xac_nhan':null;
    const {error}=await sb.from('viec').update({cac_buoc:M}).eq('id',id);
    if(error){[bt,bb].forEach(x=>x&&(x.disabled=false));return toast('Không lưu được: '+error.message)}
    const f=$('#bdk').files[0],laAnh=f&&(/^image\//.test(f.type)||/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
    await qAdd({ma_khach:uid(),viec_id:id,trang_thai:tt,buoc:iB,ghi_chu:(bo?'⤼ Bỏ qua bước ':'✓ Xong bước ')+(iB+1)+'. '+M[iB].ten+(ghi?' — '+ghi:''),
      anh:laAnh?await nen(f):null,tep:f&&!laAnh?f:null,tep_ten:f&&!laAnh?f.name:null,gio_bam:new Date().toISOString(),vi_tri_loi:'Không lấy vị trí khi ghi bước'});
    await day();toast(xongHet?'Xong cả quy trình, đã báo hoàn thành':'Đã ghi bước '+(iB+1));chiTiet(id)};
  if($('#bxong'))$('#bxong').onclick=()=>ghiBuoc(false);
  if($('#bbo'))$('#bbo').onclick=()=>ghiBuoc(true);
  document.querySelectorAll('[data-xp]').forEach(a=>a.onclick=e=>{e.preventDefault();xemTep(a.dataset.xp,a.dataset.xt,id)});
  if($('#gui'))$('#gui').onclick=()=>guiCapNhat(id);
  if($('#dhan')){$('#dhan').onclick=e=>{e.preventDefault();$('#hanbox').style.display='block';const d=new Date(v.han||Date.now()+864e5),z=x=>String(x).padStart(2,'0');$('#han2').value=`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`};
    $('#luuhan').onclick=async()=>{if(!$('#han2').value)return toast('Chọn hạn');const {error}=await sb.from('viec').update({han:new Date($('#han2').value).toISOString()}).eq('id',id);if(error)return toast('Không lưu được hạn: '+error.message);toast('Đã lưu hạn, app sẽ nhắc đúng hẹn');chiTiet(id)}}
}
const nen=f=>new Promise(res=>{if(!f)return res(null);const i=new Image();i.onload=()=>{const k=Math.min(1,1600/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(b=>res(b),'image/jpeg',.8)};i.onerror=()=>res(null);i.src=URL.createObjectURL(f)});
const viTri=()=>new Promise(res=>{if(!navigator.geolocation)return res({vi_tri_loi:'Máy không hỗ trợ định vị'});
  const lay=(cao,tiep)=>navigator.geolocation.getCurrentPosition(p=>res({vi_do:p.coords.latitude,kinh_do:p.coords.longitude,do_chinh_xac:Math.round(p.coords.accuracy)}),e=>e.code!==1&&tiep?tiep():res({vi_tri_loi:e.code===1?'Chưa cho phép định vị (vào Cài đặt, bật Vị trí cho trình duyệt hoặc app)':e.code===3?'Hết thời gian chờ GPS':'Không xác định được vị trí'}),{enableHighAccuracy:cao,timeout:10000,maximumAge:0});
  lay(true,()=>lay(false,null))});
async function guiCapNhat(id){
  const b=$('#gui');
  const f=$('#dk').files[0]||null,laAnh=!!f&&(/^image\//.test(f.type)||/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name));
  const tep=laAnh?null:f,lt=kiemTep(tep);if(lt)return toast(lt);
  b.disabled=true;
  const gio=new Date().toISOString(), gps=await viTri(), anh=laAnh?await nen(f):null;
  const o={ma_khach:uid(),viec_id:id,trang_thai:$('#st').value||null,ghi_chu:$('#gc').value.trim()||null,anh,tep,tep_ten:tep?tep.name:null,gio_bam:gio,...gps};
  if(!o.ghi_chu&&!anh&&!tep&&!o.trang_thai){b.disabled=false;return toast('Chưa có nội dung')}
  await qAdd(o);await day();
  toast((await qAll()).length?'Đã lưu, sẽ gửi khi có mạng':gps.vi_do?'Đã gửi (có vị trí)':'Đã gửi, nhưng KHÔNG có vị trí: '+(gps.vi_tri_loi||''));
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
    $('#nd').innerHTML=(PHAT?'<button class="full" id="pt">📢 Phát thông báo</button><div style="height:10px"></div>':'')+
      '<div class="luoi">'+((tbs||[]).map(t=>{const chua=(t.id in doc)&&!doc[t.id];
        return `<div class="card" data-tb="${t.id}" style="${chua?'border-color:var(--pri);border-width:2px':''}"><h3>${t.khan?'🔴 ':''}${esc(tieuGon(t.tieu_de,t.noi_dung))}</h3><div class="mut">${esc(ten(t.nguoi_phat))} · ${fmt(t.tao_luc)} ${chua?'<span class="tag red">Chưa đọc</span>':''}</div></div>`}).join('')||'<p class="mut">Chưa có thông báo.</p>')+'</div>';
    document.querySelectorAll('[data-tb]').forEach(c=>c.onclick=()=>chiTietTB(c.dataset.tb));
    if($('#pt'))$('#pt').onclick=formTB;
  }catch(e){$('#nd').innerHTML='<p class="mut">Lỗi: '+esc(e.message||e)+'</p>'}
}
// Nội dung thông báo vốn là văn bản nhiều dòng do máy ghép (ngày giờ, nội dung, địa điểm, thành phần).
// Tách ra thành từng mục có nhãn cho dễ đọc; thành phần đông thì gom thành thẻ tên, quá 6 người thì thu lại.
// Tiêu đề thông báo lịch do máy ghép, bản cũ cắt cứng 140 ký tự nên đứt ngang chữ.
// Dựng lại tiêu đề gọn, cắt theo TỪ, lấy nội dung đầy đủ từ thân thông báo nếu tiêu đề bị cụt.
const catTu=(s,n)=>{s=String(s||'').trim();if(s.length<=n)return s;const c=s.slice(0,n).replace(/\s+\S*$/,'');return (c||s.slice(0,n))+'…'};
function tieuGon(tt,nd){
  const m=String(tt||'').match(/^(Lịch mới|Thay đổi lịch|HỦY lịch)\s*:?\s*(\d{1,2}\/\d{1,2})?\s*(\d{1,2}:\d{2})?\s*(.*)$/);
  if(!m)return catTu(tt,110);
  let p=(m[4]||'').replace(/…$/,'');
  const than=String(nd||'').split('\n')[1]||'';
  if(than&&p&&than.slice(0,16)===p.slice(0,16))p=than;      // tiêu đề cụt thì lấy bản đầy đủ ở thân
  return m[1]+(m[2]?' '+m[2]:'')+': '+catTu(p||than,64);
}
const NHAN_TB=/^(Địa điểm|Thành phần|Thời gian|Chủ trì|Chuẩn bị|Ghi chú|Lưu ý)\s*[:：]\s*(.+)$/i;
function veNoiDungTB(s){
  const dong=String(s||'').replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);
  if(!dong.length)return '';
  const muc=[]; const than=[];
  dong.forEach((l,i)=>{
    const m=l.match(NHAN_TB);
    if(m)return muc.push([m[1],m[2]]);
    if(i===0&&/^\d{1,2}\/\d{1,2}(\/\d{2,4})?/.test(l))return muc.unshift(['Thời gian',l]);
    than.push(l);
  });
  const the=v=>v.split(/\s*,\s*/).filter(Boolean);
  let h='<div class="tb-than">';
  if(than.length)h+=`<p class="tb-chinh">${esc(than.join(' '))}</p>`;
  muc.forEach(([n,v])=>{
    if(/^thành phần$/i.test(n)){
      const ds=the(v);
      h+=`<div class="dl"><span class="dl-n">${esc(n)} (${ds.length})</span><span class="chips">`
        +ds.map((x,i)=>`<span class="chip${i>=6?' an':''}">${esc(x)}</span>`).join('')
        +(ds.length>6?`<a href="#" id="themtp" class="chip them">+${ds.length-6} người</a>`:'')+'</span></div>';
    } else h+=`<div class="dl"><span class="dl-n">${esc(n)}</span><span>${esc(v)}</span></div>`;
  });
  return h+'</div>';
}

async function chiTietTB(id){
  const {data:t}=await sb.from('thong_bao').select('*').eq('id',id).single();
  const {data:r}=await sb.from('thong_bao_nguoi_nhan').select('da_doc_luc').eq('thong_bao_id',id).eq('nguoi_id',me.id).maybeSingle();
  $('#nd').innerHTML=`<button class="sec" id="lui">← Quay lại</button><div class="card tb-ct" style="margin-top:10px"><h3>${t.khan?'🔴 ':''}${esc(tieuGon(t.tieu_de,t.noi_dung))}</h3><div class="mut">${esc(ten(t.nguoi_phat))} · ${fmt(t.tao_luc)}</div>${veNoiDungTB(t.noi_dung)}
  ${r&&!r.da_doc_luc?'<button id="doc" class="xacnhan">✅ Đã đọc, đã hiểu</button>':r?`<div class="mut">✅ Bạn đã đọc lúc ${fmt(r.da_doc_luc)}</div>`:''}</div><div id="th"></div>`;
  const mt=$('#themtp'); if(mt)mt.onclick=e=>{e.preventDefault();mt.parentElement.querySelectorAll('.an').forEach(x=>x.classList.remove('an'));mt.remove()};
  if(me.la_quan_tri||t.nguoi_phat===me.id){$('#nd').insertAdjacentHTML('beforeend',`<button class="full dng" id="xoa" style="margin-top:10px">🗑 Xóa thông báo này${me.la_quan_tri&&t.nguoi_phat!==me.id?' (quản trị)':''}</button>`);$('#xoa').onclick=()=>xoaMuc('thong_bao',id,'Xóa vĩnh viễn thông báo này, người nhận sẽ không còn thấy?',dsTB)}
  $('#lui').onclick=dsTB;
  if($('#doc'))$('#doc').onclick=async()=>{const {error}=await sb.from('thong_bao_nguoi_nhan').update({da_doc_luc:new Date().toISOString()}).eq('thong_bao_id',id).eq('nguoi_id',me.id);if(error)return toast('Lỗi: '+error.message);toast('Đã xác nhận');demTB();chiTietTB(id)};
  const {data:th}=await sb.rpc('tinh_hinh_doc',{p_tb:id});
  if(th&&th.length&&$('#th')){const d=th.filter(x=>x.da_doc_luc).length;
    $('#th').innerHTML=`<div class="card"><h3>Tình hình đọc: ${d}/${th.length}</h3>${th.map(x=>`<div class="row" style="justify-content:space-between"><span>${x.da_doc_luc?'✅':'⬜'} ${esc(x.ho_ten)} <span class="mut">${esc(x.khoa||'')}</span></span><span class="mut">${x.da_doc_luc?fmt(x.da_doc_luc):'chưa đọc'}</span></div>`).join('')}</div>`}
}
async function formTB(){
  const {data:ks}=await sb.rpc('ds_khoa');
  $('#nd').innerHTML=`<button class="sec" id="lui">← Quay lại</button><div class="card" style="margin-top:10px"><label>Tiêu đề</label><input id="tt"><label>Nội dung</label><textarea id="nd2" style="min-height:140px"></textarea>
  <label>Nơi nhận</label><select id="pv"><option value="all">Toàn viện</option><option value="chon">Chọn khoa/phòng…</option></select>
  <div id="ks" style="display:none">${(ks||[]).map(k=>`<label style="font-weight:400;margin:6px 0"><input type="checkbox" value="${k.id}" style="width:auto"> ${esc(k.ten)}</label>`).join('')}</div>
  <label style="font-weight:400"><input id="kh" type="checkbox" style="width:auto"> Khẩn (nhắc lại sớm)</label>
  <button class="full" id="ph">📢 Phát thông báo</button><p class="mut" id="loi"></p></div>`;
  $('#lui').onclick=dsTB;$('#pv').onchange=()=>$('#ks').style.display=$('#pv').value==='chon'?'block':'none';
  $('#ph').onclick=async()=>{
    const toan=$('#pv').value==='all', ids=[...document.querySelectorAll('#ks input:checked')].map(x=>x.value);
    ban($('#ph'));
    const {error}=await sb.rpc('phat_thong_bao',{p_tieu_de:$('#tt').value,p_noi_dung:$('#nd2').value,p_khan:$('#kh').checked,p_nhac_gio:$('#kh').checked?2:24,p_toan_vien:toan,p_khoa:ids});
    ban($('#ph'),false);if(error)return $('#loi').textContent=error.message;
    toast('Đã phát thông báo');dsTB();
  };
}
// ---- thông báo đẩy ----
const b64=s=>{const p='='.repeat((4-s.length%4)%4),r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...r].map(c=>c.charCodeAt(0)))};
const pushHoTro=()=>'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
async function pushTrangThai(){
  if(!pushHoTro())return /iphone|ipad/i.test(navigator.userAgent)?'ios':'khong';
  if(Notification.permission==='denied')return 'chan';
  const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
  return sub&&Notification.permission==='granted'?'bat':'tat';
}
async function batPush(){
  const p=await Notification.requestPermission();if(p!=='granted')throw new Error('Bạn chưa cho phép thông báo');
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(BV.VAPID)});
  const j=sub.toJSON();
  const {error}=await sb.rpc('dang_ky_push',{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_ua:navigator.userAgent});
  if(error)throw error;
}
// tự đăng ký lại: máy đã cho phép thông báo nhưng đăng ký bị mất/hết hạn ở máy chủ -> ghi lại, không cần bấm gì
async function dongBoPush(ep){
  try{
    if(!pushHoTro()||Notification.permission!=='granted'||!me)return;
    const k='push_db_'+me.id,gan=+(localStorage.getItem(k)||0);
    if(!ep&&Date.now()-gan<6*3600e3)return;
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(BV.VAPID)});
    const j=sub.toJSON();
    const {error}=await sb.rpc('dang_ky_push',{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_ua:navigator.userAgent});
    if(!error)try{localStorage.setItem(k,String(Date.now()))}catch(_){}
  }catch(_){}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)dongBoPush()});
async function tatPush(){const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){await sb.rpc('huy_dang_ky_push',{p_endpoint:sub.endpoint});await sub.unsubscribe()}}
async function theBatPush(){
  const st=await pushTrangThai();
  if(st==='bat')return'';
  const msg={ios:'Trên iPhone: bấm nút Chia sẻ → "Thêm vào Màn hình chính", rồi mở app từ biểu tượng đó để bật thông báo.',chan:'Thông báo đang bị chặn. Vào Cài đặt của trình duyệt/máy để cho phép lại.',khong:'Máy này chưa hỗ trợ thông báo đẩy.'}[st];
  return `<div class="banner">${msg?esc(msg):'<b>Bật thông báo</b> để máy báo ngay khi có việc, lịch trực, lịch họp.'}${st==='tat'?'<div><button id="bpush" style="margin-top:8px">🔔 Bật thông báo trên máy này</button></div>':''}</div>`;
}
function ganNutPush(){const b=$('#bpush');if(b)b.onclick=async()=>{ban(b);try{await batPush();toast('Đã bật thông báo');ve()}catch(e){toast(e.message||'Không bật được');ban(b,false)}}}
function diDen(u){
  try{const q=new URL(u,location.href).searchParams;
    if(q.get('tb')){tab='tb';ve();chiTietTB(q.get('tb'))}
    else if(q.get('v')){tab='toi';ve();chiTiet(q.get('v'))}
    else if(q.get('t')==='lt'){tab='lt';ve()}
    else if(q.get('ct')){tab='ct';ve()}
  }catch(_){}
}
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.dongbo&&me)dongBoPush(true);if(e.data&&e.data.di&&me)diDen(e.data.di)});
let TC=false;
// Sức khỏe hệ thống (chỉ quản trị): đêm qua sao lưu, kiểm thử và báo cáo tuần ra sao
async function suckhoe(){
  const el=$('#skht'); if(!el)return;
  const gio=t=>t?new Date(t).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'chưa có';
  const [sl,kt,bc]=await Promise.all([
    sb.from('sao_luu_log').select('luc,so_bang,so_dong,so_tep,byte,ok,loi').order('luc',{ascending:false}).limit(1),
    sb.from('kiem_thu_log').select('dot,luc,ten,dat').order('luc',{ascending:false}).limit(60),
    sb.from('bc_tuan_log').select('tu,luc,ok,dry,so_viec,loi').eq('dry',false).order('luc',{ascending:false}).limit(1)]);
  if(!$('#skht'))return;
  if(sl.error&&kt.error&&bc.error)return el.innerHTML='<h3>Sức khỏe hệ thống</h3><div class="mut">Không xem được: '+esc(sl.error.message)+'</div>';
  const dong=(ten,dat,ct)=>`<div class="row" style="justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--vien)">
    <span>${dat?'✅':'⚠️'} ${esc(ten)}</span><span class="mut" style="text-align:right">${esc(ct)}</span></div>`;
  let h='<h3>Sức khỏe hệ thống</h3>';
  const s0=(sl.data||[])[0];
  h+=dong('Sao lưu', !!(s0&&s0.ok&&Date.now()-new Date(s0.luc)<36*3600e3),
     s0?`${gio(s0.luc)} · ${s0.so_bang} bảng, ${s0.so_dong} dòng, ${s0.so_tep} tệp`+(s0.ok?'':' · LỖI'):'chưa có lần nào');
  const kd=(kt.data||[]), dot=kd.length?kd[0].dot:null, bai=kd.filter(x=>x.dot===dot), hong=bai.filter(x=>!x.dat);
  h+=dong('Kiểm thử đêm', bai.length>0&&hong.length===0,
     bai.length?`${gio(bai[0].luc)} · ${bai.length-hong.length}/${bai.length} đạt`:'chưa chạy');
  if(hong.length)h+=`<div class="mut" style="padding:4px 0 8px">Lỗi: ${hong.slice(0,4).map(x=>esc(x.ten)).join('; ')}</div>`;
  const b0=(bc.data||[])[0];
  h+=dong('Báo cáo tuần gửi VP Công ty', !!(b0&&b0.ok),
     b0?`${gio(b0.luc)} · tuần ${b0.tu.slice(8,10)}/${b0.tu.slice(5,7)} · ${b0.so_viec} việc`+(b0.ok?'':' · LỖI'):'chưa gửi lần nào');
  el.innerHTML=h;
}

async function taiKhoan(){
  TC=!!(await sb.rpc('xem_tai_chinh')).data;
  const st=await pushTrangThai();
  $('#nd').innerHTML=`<div class="luoi"><div class="card"><h3>${esc(me.ho_ten)}</h3><div class="mut">${esc(me.chuc_vu||'')}<br>${esc(me.so_dien_thoai)}</div></div>
  <div class="card"><h3>Thông báo trên máy này</h3><div class="mut">${{bat:'Đang bật',tat:'Chưa bật',chan:'Đang bị chặn',ios:'Cần thêm app vào Màn hình chính',khong:'Máy không hỗ trợ'}[st]}</div>${st==='tat'?'<button class="full" id="bp">🔔 Bật thông báo</button>':st==='bat'?'<button class="sec full" id="tp">🔕 Tắt thông báo trên máy này</button>':''}</div>
  ${(me.vai_tro==='tchc'||me.vai_tro==='bgd'||me.la_quan_tri)?'<div class="card" id="cpb"><h3>Ai chưa bật thông báo</h3><div class="mut">Đang tải…</div></div>':''}
  ${me.la_quan_tri?'<div class="card" id="skht"><h3>Sức khỏe hệ thống</h3><div class="mut">Đang tải…</div></div>':''}
  <div class="card tkn"><h3 class="chimay">Chức năng</h3>${TC?'<button class="full" id="kh">📊 Kế hoạch – sử dụng chi phí</button>':''}
  ${(me.vai_tro==='tchc'||me.vai_tro==='bgd'||me.la_quan_tri)?'<button class="sec full" id="lvds">📂 Danh mục loại việc</button>':''}
  <button class="sec full" id="ra">🚪 Đăng xuất</button></div></div>`;
  if($('#bp'))$('#bp').onclick=async()=>{try{await batPush();toast('Đã bật thông báo');taiKhoan()}catch(e){toast(e.message||'Không bật được')}};
  if($('#tp'))$('#tp').onclick=async()=>{await tatPush();toast('Đã tắt');taiKhoan()};
  if($('#skht'))suckhoe();
  if($('#cpb'))sb.rpc('ds_chua_bat_push').then(({data,error})=>{const el=$('#cpb');if(!el)return;if(error)return el.innerHTML='<h3>Ai chưa bật thông báo</h3><div class="mut">Không xem được</div>';
    const dn=(data||[]).filter(x=>x.da_dang_nhap),ch=(data||[]).filter(x=>!x.da_dang_nhap);
    el.innerHTML='<h3>Ai chưa bật thông báo</h3><div class="mut">'+(dn.length?'<b>Đã đăng nhập nhưng chưa bật ('+dn.length+'):</b><br>'+dn.map(x=>esc(x.ho_ten)+(x.khoa?' · '+esc(x.khoa):'')).join('<br>')+'<br><br>':'')+'<b>Chưa đăng nhập lần nào:</b> '+ch.length+' người</div>'});
  if($('#kh'))$('#kh').onclick=()=>window.KH.ve();
  if($('#lvds'))$('#lvds').onclick=dsLoaiViec;
  $('#ra').onclick=async()=>{await sb.auth.signOut();me=null;manHinhDangNhap()};
}

async function khoiDong(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return manHinhDangNhap();
  const {data,error}=await sb.from('nguoi_dung').select('*').eq('auth_id',session.user.id).single();
  if(error||!data){await sb.auth.signOut();return manHinhDangNhap()}
  me=data;await napDanhBa();PHAT=!!(await sb.rpc('duoc_phat')).data;me.phai_doi_mat_khau?manHinhDoiMK():khung();dongBoPush(true);
}
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
khoiDong().then(()=>{if(me&&location.search){const u=location.search;history.replaceState(null,'',location.pathname);diDen(u)}});
})();
