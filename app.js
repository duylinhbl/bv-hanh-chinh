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
const TEP_DUOI=['doc','docx','xls','xlsx'],TEP_MAX=10*1024*1024;
const TEP_MIME={doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
const duoiTep=n=>((n||'').split('.').pop()||'').toLowerCase();
const kiemTep=f=>!f?null:!TEP_DUOI.includes(duoiTep(f.name))?'Chỉ nhận file Word (.doc, .docx) hoặc Excel (.xls, .xlsx)':f.size>TEP_MAX?'File quá 10 MB':null;
const bieuTuongTep=n=>/^xls/.test(duoiTep(n))?'📊':'📄';
async function linkTep(path,ten){const r=await sb.storage.from('anh').createSignedUrl(path,3600,{download:ten||true});return r.data?.signedUrl||null}
window.BVAPP={xoaMuc,sb,$,esc,fmt,toast,get me(){return me}};
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
  const {error}=await sb.from('cap_nhat_hien_trang').insert({viec_id:o.viec_id,nguoi_id:me.id,trang_thai:o.trang_thai,ghi_chu:o.ghi_chu,anh_path:path,file_path:fpath,file_ten:o.tep?o.tep_ten:null,vi_do:o.vi_do,kinh_do:o.kinh_do,vi_tri_loi:o.vi_tri_loi||null,do_chinh_xac:o.do_chinh_xac||null,gio_bam:o.gio_bam,ma_khach:o.ma_khach});
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
  app.innerHTML=`<div class="login"><img class="lg" src="logo.png" alt=""><h1>Bệnh viện Đa khoa Cao su Dầu Tiếng</h1><div class="mut">Quản lý hành chính</div>
  <label>Số điện thoại</label><input id="sdt" inputmode="tel" autocomplete="username">
  <label>Mật khẩu</label><input id="mk" type="password" autocomplete="current-password">
  <button class="full" id="vao">🔑 Đăng nhập</button><p class="mut" id="loi"></p></div>`;
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
  app.innerHTML=`<header><img class="lg" src="logo.png" alt=""><span class="ten">${esc(me.ho_ten)}<small>${esc(me.chuc_vu||'')}</small></span><small><span id="hang"></span> v49</small></header>
  <main id="nd"></main>
  <nav><button data-t="toi"><svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/></svg><span>Việc</span></button>${lanh?`<button data-t="giao"><svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg><span>Giao</span></button>`:''}<button data-t="ct"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span>Lịch</span></button><button data-t="lt"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>Trực</span></button><button data-t="tb"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg><span>Tin<span id="dem" class="tag red" style="display:none;margin-left:3px;padding:0 6px"></span></span></button><button data-t="moi"><i><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.6"/></svg></i><span class="l">Giao việc</span></button><button data-t="tk"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span>Tôi</span></button></nav>`;
  document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;ve()});
  ve();day();demTB();sb.channel('tb').on('postgres_changes',{event:'*',schema:'public',table:'thong_bao_nguoi_nhan',filter:'nguoi_id=eq.'+me.id},()=>{demTB();if(tab==='tb')dsTB();else toast('Có thông báo mới')}).subscribe();
}
const ghiLoi=(m,ct)=>{try{if(!me||!me.id)return;const k=String(m).slice(0,200);if(ghiLoi.last===k)return;ghiLoi.last=k;sb.from('loi_app').insert({nguoi_id:me.id,ver:((document.querySelector('script[src*="app.js"]')||{}).src||'').split('v=')[1]||null,thong_diep:k,chi_tiet:String(ct||'').slice(0,1200)}).then(()=>{},()=>{})}catch(e){}};
window.addEventListener('unhandledrejection',e=>{const n=$('#nd');const m=e.reason&&e.reason.message||e.reason;if(n)n.innerHTML='<p class="mut">Lỗi: '+esc(m)+'</p>';ghiLoi('promise: '+m,e.reason&&e.reason.stack)});
window.addEventListener('error',e=>ghiLoi('js: '+e.message,(e.filename||'')+':'+e.lineno));
function ve(){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
  ({toi:dsToi,giao:dsGiao,ct:()=>window.LICHCT.ve(),lt:()=>window.LICH.ve(),tb:dsTB,moi:formViec,tk:taiKhoan})[tab]();
}
const qua=v=>v.han&&new Date(v.han)<new Date()&&!(['da_dong','huy'].includes(v.trang_thai));
const the=v=>`<div class="card v ${qua(v)?'qua':v.trang_thai}" data-id="${v.id}"><h3>${esc(v.tieu_de)}</h3><div class="row">${tag(v.trang_thai)}${v.uu_tien==2?'<span class="tag red">Gấp</span>':''}${qua(v)?'<span class="tag red">Quá hạn</span>':''}${v.han?`<span class="mut">Hạn ${fmt(v.han)}</span>`:''}</div>${v.ben?`<div class="mut">${esc(v.ben)}</div>`:''}</div>`;
async function dsToi(){
  $('#nd').innerHTML='Đang tải…';try{await dsToi2()}catch(e){$('#nd').innerHTML='<p class="mut">Lỗi: '+esc(e.message||e)+'</p>'}}
async function dsToi2(){
  const {data,error}=await sb.from('viec').select('*').eq('nguoi_nhan',me.id).not('trang_thai','in','(da_dong,huy)').order('han',{nullsFirst:false});
  if(error)return $('#nd').textContent=error.message;
  const nay=new Date().toDateString(),kq=data.filter(qua).length,kh=data.filter(v=>v.han&&new Date(v.han).toDateString()===nay).length,gio=new Date().getHours(),ch=gio<11?'Chào buổi sáng':gio<14?'Chào buổi trưa':gio<18?'Chào buổi chiều':'Chào buổi tối';
  const kpi=`<div class="hero"><div class="hi"><b>${ch}, ${esc((me.ho_ten||'').split(' ').slice(-1)[0])}</b><span class="mut">${data.length?'Bạn có '+data.length+' việc đang mở':'Hôm nay chưa có việc nào cho bạn'}</span></div><div class="kpi"><div class="r"><b>${kq}</b><span>Quá hạn</span></div><div class="a"><b>${kh}</b><span>Hạn hôm nay</span></div><div><b>${data.length}</b><span>Đang mở</span></div></div></div>`;
  $('#nd').innerHTML=(await theBatPush())+kpi+(data.length?data.map(v=>the({...v,ben:v.tu_giao?'Tự giao':'Giao bởi '+ten(v.nguoi_giao)})).join(''):'<p class="mut">Không có việc đang mở.</p>');
  gan();ganNutPush();
}
async function dsGiao(){
  $('#nd').innerHTML='Đang tải…';
  const {data,error}=await sb.from('viec').select('*').neq('trang_thai','huy').order('tao_luc',{ascending:false}).limit(100);
  if(error)return $('#nd').textContent=error.message;
  $('#nd').innerHTML=data.map(v=>the({...v,ben:'Người nhận: '+ten(v.nguoi_nhan)})).join('')||'<p class="mut">Chưa có việc.</p>';
  gan();
}
const gan=()=>document.querySelectorAll('.card[data-id]').forEach(c=>c.onclick=()=>chiTiet(c.dataset.id));

async function xoaMuc(loai,id,hoi,sau){if(!confirm(hoi))return;const {error}=await sb.rpc('xoa_muc',{p_loai:loai,p_id:id});if(error)return toast('Lỗi: '+error.message);toast('Đã xóa');sau()}
async function formViec(){
  const {data:nd}=await sb.from('nguoi_dung').select('id,ho_ten,chuc_vu,khoa_phong(ten)').eq('hoat_dong',true).order('ho_ten');
  const ds=(nd||[]).filter(u=>me.vai_tro!=='nhan_vien'||u.id===me.id);
  const kt=u=>((u.khoa_phong&&u.khoa_phong.ten)||'').replace(/^(KHOA|PHÒNG) /,'');
  const fx=t=>(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
  $('#nd').innerHTML=`<div class="card"><label>Việc cần làm</label><input id="tt"><label>Mô tả</label><textarea id="ms"></textarea>
  <label>Người nhận ${me.vai_tro==='nhan_vien'?'':'(chỉ hiện người trong khoa/phòng bạn phụ trách)'}</label>
  <input id="nq" placeholder="Gõ tên để lọc…" autocomplete="off"><select id="nn"></select>
  <label>Hạn</label><input id="han" type="datetime-local"><label>Mức độ</label><select id="ut"><option value="1">Thường</option><option value="2">Gấp</option><option value="0">Thấp</option></select>
  <label>Loại công việc (để lưu văn bản vào đúng thư mục Drive)</label><select id="lcv"></select>
  <label>Đính kèm file Word / Excel (không bắt buộc, tối đa 10 MB)</label><input id="tepg" type="file" accept=".doc,.docx,.xls,.xlsx">
  <div id="pcb" class="mut" style="margin-top:6px"></div>
  <button class="full" id="g">📤 Giao việc</button><p class="mut" id="loi"></p></div>`;
  const pcb=async()=>{const id=$('#nn').value,el=$('#pcb');if(!el)return;if(!id||id===me.id){el.textContent='';return}
    const {data}=await sb.rpc('so_may_push',{p_nguoi:id});if($('#nn').value!==id)return;
    el.innerHTML=data>0?'🔔 Người này đã bật thông báo ('+data+' máy)':'<span style="color:#b45309">⚠ Người này chưa bật thông báo trên máy, nên sẽ không có tin báo ngay. Hãy nhắc họ mở app → tab "Tôi" → bật thông báo.</span>'};
  const dien=q=>{const x=fx(q);const l=ds.filter(u=>!x||fx(u.ho_ten+' '+kt(u)).includes(x));$('#nn').innerHTML=l.map(u=>`<option value="${u.id}" ${u.id===me.id?'selected':''}>${esc(u.ho_ten)}${u.id===me.id?' (tôi)':''}${kt(u)?' · '+esc(kt(u)):''}</option>`).join('')||'<option value="">Không có ai khớp</option>';if(x&&l.length)$('#nn').value=l[0].id};
  sb.from('loai_cong_viec').select('ma,ten').order('thu_tu').then(({data})=>{$('#lcv').innerHTML=(data||[]).map(l=>`<option value="${l.ma}" ${l.ma==='khac'?'selected':''}>${esc(l.ten)}</option>`).join('')});
  dien('');$('#nq').oninput=()=>{dien($('#nq').value);pcb()};$('#nn').onchange=pcb;pcb();
  $('#g').onclick=async()=>{
    if(!$('#tt').value.trim())return $('#loi').textContent='Nhập tên việc';if(!$('#nn').value)return $('#loi').textContent='Chọn người nhận';
    const tep=$('#tepg').files[0]||null,lt=kiemTep(tep);if(lt)return $('#loi').textContent=lt;
    const vid=uid(),fp=tep?`${vid}/giao-${uid()}.${duoiTep(tep.name)}`:null;
    const {error}=await sb.from('viec').insert({id:vid,file_path:fp,file_ten:tep?tep.name:null,tieu_de:$('#tt').value.trim(),mo_ta:$('#ms').value||null,nguoi_giao:me.id,nguoi_nhan:$('#nn').value,han:$('#han').value?new Date($('#han').value).toISOString():null,uu_tien:+$('#ut').value,loai_cv:$('#lcv').value||'khac'});
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
const napJs=u=>new Promise((ok,ko)=>{const t=document.createElement('script');t.src=u;t.onload=ok;t.onerror=()=>ko(new Error('Không tải được bộ xem file, kiểm tra mạng'));document.head.appendChild(t)});
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
  p.innerHTML=`<div class="aih"><b>🤖 Hỏi AI về tệp này</b><span><button class="sec" id="aithu">Thu gọn</button> <button class="sec" id="aixoa">Xóa hội thoại</button></span></div><div class="aim" id="aim"></div><div class="aiq"><button id="aimau" style="background:#15803d;color:#fff">📝 Soạn tờ trình / quyết định theo mẫu BV</button>${GOI_Y.filter(g=>!/^Soạn/.test(g[0])).map((g,i)=>`<button class="sec" data-g="${GOI_Y.indexOf(g)}">${g[0]}</button>`).join('')}</div><div id="aisoan" style="display:none"></div><div class="aii"><textarea id="aiq" rows="2" placeholder="Hỏi, nhờ tính toán, viết công thức, soạn văn bản…"></textarea><button id="aig">Gửi</button></div>`;
  ov.appendChild(p);
  const m=$('#aim'),base={viec_id:viecId,file_path:path};
  const them=(vai,tx)=>{const d=document.createElement('div');d.className='aib '+(vai==='user'?'u':'m');const t=document.createElement('div');t.className='ait';t.textContent=tx;d.appendChild(t);
    if(vai!=='user'){const a=document.createElement('div');a.className='aia';a.innerHTML='<button class="sec">⬇ Tải Word</button> <button class="sec">📋 Chép</button>';
      const [w,c]=a.querySelectorAll('button');
      w.onclick=async()=>{w.disabled=true;w.textContent='Đang tạo…';const r=await goiAI({...base,action:'xuat_word',noi_dung:tx,ten_file:'Soan thao AI - '+(ten||'').replace(/\.\w+$/,'')});w.disabled=false;w.textContent='⬇ Tải Word';if(r.url)window.open(r.url,'_blank');else toast(r.loi||'Không tạo được file')};
      c.onclick=async()=>{try{await navigator.clipboard.writeText(tx);toast('Đã chép')}catch(_){toast('Máy không cho chép tự động')}};
      d.appendChild(a)}
    m.appendChild(d);m.scrollTop=m.scrollHeight;return d};
  $('#aithu').onclick=()=>{p.classList.toggle('nho');$('#aithu').textContent=p.classList.contains('nho')?'Mở ra':'Thu gọn'};
  $('#aixoa').onclick=async()=>{if(!confirm('Xóa toàn bộ hội thoại AI về tệp này?'))return;await goiAI({...base,action:'xoa_lich_su'});m.innerHTML=''};
  const gui=async tx=>{tx=tx.trim();if(!tx)return;const g=$('#aig');g.disabled=true;$('#aiq').value='';them('user',tx);const cho=them('model','Đang suy nghĩ…');cho.querySelector('.aia').remove();
    const r=await goiAI({...base,action:'chat',cau_hoi:tx});cho.remove();g.disabled=false;
    them('model',r.tra_loi||('⚠ '+(r.loi||'Lỗi không rõ')));if(r.cat)toast('Tệp dài, AI chỉ đọc phần đầu')};
  $('#aig').onclick=()=>gui($('#aiq').value);
  $('#aimau').onclick=()=>{const k=$('#aisoan');if(k.style.display==='none'){k.style.display='block';if(!k.dataset.ok){k.dataset.ok=1;khungSoan(k,ov,viecId,path)}}else k.style.display='none'};
  p.querySelectorAll('.aiq button').forEach(x=>x.onclick=()=>{const g=GOI_Y[+x.dataset.g];if(g[2]){$('#aiq').value=g[1];$('#aiq').focus()}else gui(g[1])});
  goiAI({...base,action:'lich_su'}).then(r=>{(r.lich_su||[]).forEach(h=>them(h.vai,h.noi_dung))});
}
// Soạn tờ trình / quyết định theo mẫu bệnh viện, ngay trong khung AI của tệp đang xem
async function khungSoan(k,ov,viecId,path){
  k.innerHTML='<p class="mut">Đang tải danh sách mẫu…</p>';
  const {data:mau}=await sb.from('mau_van_ban').select('ma,ten,loai,mo_ta').eq('hoat_dong',true).order('thu_tu');
  const nhom=[['to_trinh','Tờ trình'],['quyet_dinh','Quyết định']];
  k.innerHTML=`<div class="aisoan"><b>1. Chọn loại văn bản</b>
  ${nhom.map(([g,t])=>`<div class="mut" style="margin-top:6px">${t}</div>`+(mau||[]).filter(m=>m.loai===g).map(m=>`<label style="display:flex;gap:8px;align-items:flex-start;font-weight:400;margin:6px 0"><input type="checkbox" class="vck" value="${m.ma}" style="width:22px;height:22px;flex:none"><span>${esc(m.ten)}<br><span class="mut">${esc(m.mo_ta||'')}</span></span></label>`).join('')).join('')}
  <b>2. Ý của bạn</b><textarea id="vyc" rows="3" placeholder="VD: Trình duyệt chi hỗ trợ theo bảng này, nguồn chi thường xuyên, thực hiện tháng 12"></textarea>
  <b>3. AI đọc tệp này + ý bạn, viết vào khung Word của bệnh viện</b>
  <div style="display:flex;gap:8px;margin-top:6px"><button id="vtai" style="flex:1">⬇ Tải Word</button><button id="vluu" style="flex:1">💾 Lưu vào Drive</button></div>
  <p class="mut" id="vtt"></p><div id="vkq"></div></div>`;
  const kq=$('#vkq');
  const them=(r,daLuu)=>{const d=document.createElement('div');d.className='aib m';d.innerHTML=`<div class="ait">📄 ${esc(r.ten)}</div><div class="aia"><button class="sec" data-t>⬇ Tải</button> ${daLuu?'<span class="mut">✅ Đã lưu Drive</span>':'<button class="sec" data-l>💾 Lưu Drive</button>'}</div>`;
    d.querySelector('[data-t]').onclick=async()=>{const x=await goiVB({action:'tai',van_ban_id:r.id});x.url?taiVe(x.url):toast(x.loi||'Lỗi')};
    const l=d.querySelector('[data-l]');if(l)l.onclick=async()=>{l.disabled=true;l.textContent='Đang lưu…';const x=await goiVB({action:'luu',van_ban_id:r.id});if(x.loi){l.disabled=false;l.textContent='💾 Lưu Drive';return toast(x.loi)}l.replaceWith(Object.assign(document.createElement('span'),{className:'mut',textContent:'✅ Đã lưu Drive'}));toast('Đã lưu vào: '+(x.thu_muc||'Drive'))};
    kq.appendChild(d)};
  const chay=async luu=>{
    const ck=[...k.querySelectorAll('.vck:checked')].map(x=>x.value);
    if(!ck.length)return toast('Tích chọn ít nhất một loại văn bản');
    $('#vtai').disabled=$('#vluu').disabled=true;let loi='',n=0;
    for(const [i,ma] of ck.entries()){
      $('#vtt').textContent=`Đang soạn ${i+1}/${ck.length}… (mỗi bản khoảng 10–40 giây)`;
      const r=await goiVB({action:'soan',viec_id:viecId,mau_ma:ma,file_path:path,yeu_cau:$('#vyc').value.trim()});
      if(r.loi){loi=r.loi;break}
      n++;ov.dataset.vb=1;let ok=false;
      if(luu){$('#vtt').textContent=`Đang lưu vào Drive ${i+1}/${ck.length}…`;const x=await goiVB({action:'luu',van_ban_id:r.id});if(x.loi)loi='Đã soạn nhưng chưa lưu được Drive: '+x.loi;else ok=true}
      else{taiVe(r.url);await new Promise(o=>setTimeout(o,700))}
      them(r,ok);if(loi)break;
    }
    $('#vtai').disabled=$('#vluu').disabled=false;
    $('#vtt').textContent=loi?'⚠ '+loi:(luu?`✅ Đã soạn và lưu ${n} văn bản vào Drive. Đóng tệp rồi bấm "Kết thúc việc" khi xong.`:`✅ Đã soạn ${n} văn bản, Word đã tải về. Muốn lưu Drive bấm "💾 Lưu Drive" ở từng bản.`);
  };
  $('#vtai').onclick=()=>chay(false);$('#vluu').onclick=()=>chay(true);
}
async function xemTep(path,ten,viecId){
  const ov=document.createElement('div');ov.className='vw';
  ov.innerHTML=`<div class="vwh"><b>${esc(ten||'Tệp')}</b><span><a id="vwtai" href="#" download>⬇ Tải</a> <button class="sec" id="vwx">✕ Đóng</button></span></div><div class="vwb" id="vwb">Đang mở…</div>`;
  document.body.appendChild(ov);$('#vwx').onclick=()=>{const cap=ov.dataset.vb&&viecId;ov.remove();if(cap)chiTiet(viecId)};
  const b=$('#vwb');
  if(viecId&&/^(xlsx|docx)$/.test(duoiTep(ten)))khungAI(ov,viecId,path,ten);
  try{
    const url=await linkTep(path,ten);if(!url)throw new Error('Không lấy được đường dẫn file');$('#vwtai').href=url;
    const d=duoiTep(ten),buf=await (await fetch(url)).arrayBuffer();
    if(d==='xlsx'||d==='xls'){
      await taiXlsx();const wb=XLSX.read(buf,{type:'array'});
      const ve1=i=>{const ws=wb.Sheets[wb.SheetNames[i]];const r=XLSX.utils.decode_range(ws['!ref']||'A1');
        const cat=r.e.r>1000||r.e.c>40;if(cat){r.e.r=Math.min(r.e.r,1000);r.e.c=Math.min(r.e.c,40);ws['!ref']=XLSX.utils.encode_range(r)}
        $('#vwt').innerHTML=sach(XLSX.utils.sheet_to_html(ws,{header:'',footer:''}))+(cat?'<p class="mut">Chỉ hiển thị 1000 dòng × 40 cột đầu, tải file để xem đủ.</p>':'');
        document.querySelectorAll('.vwtab').forEach((x,k)=>x.classList.toggle('on',k===i))};
      b.innerHTML=`<div class="vwtabs">${wb.SheetNames.map((n,i)=>`<button class="vwtab sec" data-i="${i}">${esc(n)}</button>`).join('')}</div><div id="vwt" class="vwt"></div>`;
      b.querySelectorAll('.vwtab').forEach(x=>x.onclick=()=>ve1(+x.dataset.i));ve1(0);
    }else if(d==='docx'){
      await taiMam();const r=await mammoth.convertToHtml({arrayBuffer:buf});b.innerHTML='<div class="vwdoc">'+sach(r.value)+'</div>';
    }else b.innerHTML='<p>File .doc đời cũ chưa xem trực tiếp được, bấm "Tải" ở trên để mở bằng Word.</p>';
  }catch(e){b.innerHTML='<p style="color:#b91c1c">Không mở được file: '+esc(e.message||String(e))+'</p>'}
}
// ---- Soạn văn bản theo mẫu bệnh viện (v48) ----
async function goiVB(body){
  const {data,error}=await sb.functions.invoke('soan-mau',{body});
  if(error){let m=error.message;try{const j=await error.context.json();m=j.loi||m}catch(_){}return {loi:m}}
  return data||{loi:'Không có phản hồi'}
}
function taiVe(url){const a=document.createElement('a');a.href=url;a.download='';document.body.appendChild(a);a.click();a.remove()}
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
    <button class="sec" data-vt="${d.id}">⬇ Tải</button> ${d.drive_url?'':`<button class="sec" data-vl="${d.id}">💾 Lưu Drive</button>`}</div>`).join('')||'<p class="mut">Chưa soạn văn bản nào.</p>';
  c.innerHTML=`<h3>📁 Văn bản đã soạn &amp; hoàn tất việc</h3>
  <label>Loại công việc</label><select id="vlcv" ${laGiao?'':'disabled'}>${(lcv||[]).map(l=>`<option value="${l.ma}" ${l.ma===(v.loai_cv||'khac')?'selected':''}>${esc(l.ten)}</option>`).join('')}</select>
  <p class="mut">Muốn soạn tờ trình / quyết định: mở file Excel/Word của việc (👁 Xem) rồi bấm "📝 Soạn theo mẫu BV".</p>
  <div id="vds">${ve_ds(ds)}</div>
  ${laGiao&&v.nguoi_giao===me.id&&!dong?'<button class="full" id="vket" style="margin-top:10px;background:#15803d">✔ Kết thúc việc (hồ sơ đã hoàn chỉnh)</button>':''}`;
  const tl=nd.querySelector('.timeline');tl?nd.insertBefore(c,tl):nd.appendChild(c);
  const lamMoi=async()=>{const {data}=await sb.from('van_ban_viec').select('id,mau_ma,ten_file,drive_url,tao_luc,luu_luc').eq('viec_id',id).order('tao_luc',{ascending:false});$('#vds').innerHTML=ve_ds(data);gan2()};
  const gan2=()=>{
    c.querySelectorAll('[data-vt]').forEach(b=>b.onclick=async()=>{b.disabled=true;const r=await goiVB({action:'tai',van_ban_id:b.dataset.vt});b.disabled=false;r.url?taiVe(r.url):toast(r.loi||'Lỗi')});
    c.querySelectorAll('[data-vl]').forEach(b=>b.onclick=async()=>{b.disabled=true;b.textContent='Đang lưu…';const r=await goiVB({action:'luu',van_ban_id:b.dataset.vl});if(r.loi){b.disabled=false;b.textContent='💾 Lưu Drive';return toast(r.loi)}toast('Đã lưu vào Drive: '+(r.thu_muc||''));lamMoi()})};
  gan2();
  $('#vlcv').onchange=async()=>{const {error}=await sb.from('viec').update({loai_cv:$('#vlcv').value}).eq('id',id);toast(error?'Không đổi được: '+error.message:'Đã đổi loại công việc');if(!error)v.loai_cv=$('#vlcv').value};
  if($('#vket'))$('#vket').onclick=async()=>{
    const {data}=await sb.from('van_ban_viec').select('drive_url').eq('viec_id',id);
    const chua=(data||[]).filter(d=>!d.drive_url).length;
    if(!confirm((chua?`Còn ${chua} văn bản chưa lưu vào Drive.\n\n`:'')+'Kết thúc việc này, xem như đã hoàn chỉnh?'))return;
    await qAdd({ma_khach:uid(),viec_id:id,trang_thai:'da_dong',ghi_chu:'Kết thúc: hồ sơ đã hoàn chỉnh',anh:null,tep:null,tep_ten:null,gio_bam:new Date().toISOString(),vi_tri_loi:'Không lấy vị trí khi kết thúc việc'});
    await day();toast('Đã kết thúc việc');chiTiet(id);
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
  const opts=[];if(laNhan){opts.push(['dang_lam','Đang làm'],['cho_xac_nhan','Báo hoàn thành (chờ xác nhận)'])}
  if(laGiao&&v.nguoi_giao===me.id)opts.push(['da_dong','Xác nhận đóng việc']);
  $('#nd').innerHTML=`<button class="sec" id="lui">← Quay lại</button>
  <div class="card" style="margin-top:10px"><h3>${esc(v.tieu_de)}</h3>${tag(v.trang_thai)}<p>${esc(v.mo_ta||'')}</p>
  <div class="mut">Giao: ${esc(ten(v.nguoi_giao))} → ${esc(ten(v.nguoi_nhan))}${v.han?'<br>Hạn '+fmt(v.han):''}</div>${v.file_path?`<p><a href="${vurl||'#'}" download>${bieuTuongTep(v.file_ten)} ${esc(v.file_ten||'Tệp đính kèm')}</a> · <a href="#" data-xp="${esc(v.file_path)}" data-xt="${esc(v.file_ten||'')}">👁 Xem</a></p>`:''}</div>
  ${(laNhan||opts.length)?`<div class="card"><label>Cập nhật hiện trạng</label><select id="st"><option value="">Giữ nguyên trạng thái</option>${opts.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
  <label>Ghi chú</label><textarea id="gc"></textarea><label>Ảnh (chụp tại chỗ)</label><input id="anh" type="file" accept="image/*" capture="environment">
  <label>Hoặc đính kèm file Word / Excel (tối đa 10 MB)</label><input id="tep" type="file" accept=".doc,.docx,.xls,.xlsx">
  <button class="full" id="gui">📷 Gửi cập nhật</button><p class="mut">Vị trí GPS chỉ lấy tại lúc bấm Gửi.</p></div>`:''}
  <div class="timeline">${(cn||[]).map(c=>`<div class="it"><b>${esc(ten(c.nguoi_id))}</b> <span class="mut">${fmt(c.gio_bam)}</span> ${c.trang_thai?tag(c.trang_thai):''}<div>${esc(c.ghi_chu||'')}</div>${urls[c.id]?`<img src="${urls[c.id]}">`:''}${c.file_path?`<div><a href="${furls[c.id]||'#'}" download>${bieuTuongTep(c.file_ten)} ${esc(c.file_ten||'Tệp đính kèm')}</a> · <a href="#" data-xp="${esc(c.file_path)}" data-xt="${esc(c.file_ten||'')}">👁 Xem</a></div>`:''}${c.co_vi_tri?bando(c):`<div class="mut" style="color:#b45309">⚠ Không có vị trí${c.vi_tri_loi?': '+esc(c.vi_tri_loi):''}</div>`}</div>`).join('')||'<p class="mut">Chưa có cập nhật.</p>'}</div>`;
  if(me.la_quan_tri){$('#nd').insertAdjacentHTML('beforeend','<button class="full dng" id="xoa" style="margin-top:10px">🗑 Xóa việc này (quản trị)</button>');$('#xoa').onclick=()=>xoaMuc('viec',id,'Xóa vĩnh viễn việc này cùng lịch sử cập nhật?',ve)}
  $('#lui').onclick=ve;
  if(laNhan||laGiao)bangVB(v,laGiao);
  document.querySelectorAll('[data-xp]').forEach(a=>a.onclick=e=>{e.preventDefault();xemTep(a.dataset.xp,a.dataset.xt,id)});
  if($('#gui'))$('#gui').onclick=()=>guiCapNhat(id);
}
const nen=f=>new Promise(res=>{if(!f)return res(null);const i=new Image();i.onload=()=>{const k=Math.min(1,1600/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(b=>res(b),'image/jpeg',.8)};i.onerror=()=>res(null);i.src=URL.createObjectURL(f)});
const viTri=()=>new Promise(res=>{if(!navigator.geolocation)return res({vi_tri_loi:'Máy không hỗ trợ định vị'});
  const lay=(cao,tiep)=>navigator.geolocation.getCurrentPosition(p=>res({vi_do:p.coords.latitude,kinh_do:p.coords.longitude,do_chinh_xac:Math.round(p.coords.accuracy)}),e=>e.code!==1&&tiep?tiep():res({vi_tri_loi:e.code===1?'Chưa cho phép định vị (vào Cài đặt, bật Vị trí cho trình duyệt hoặc app)':e.code===3?'Hết thời gian chờ GPS':'Không xác định được vị trí'}),{enableHighAccuracy:cao,timeout:10000,maximumAge:0});
  lay(true,()=>lay(false,null))});
async function guiCapNhat(id){
  const b=$('#gui');
  const tep=$('#tep').files[0]||null,lt=kiemTep(tep);if(lt)return toast(lt);
  b.disabled=true;
  const gio=new Date().toISOString(), gps=await viTri(), anh=await nen($('#anh').files[0]);
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
  ${r&&!r.da_doc_luc?'<button class="full" id="doc">✅ Đã đọc, đã hiểu</button>':r?`<div class="mut">Bạn đã đọc lúc ${fmt(r.da_doc_luc)}</div>`:''}</div><div id="th"></div>`;
  if(me.la_quan_tri){$('#nd').insertAdjacentHTML('beforeend','<button class="full dng" id="xoa" style="margin-top:10px">🗑 Xóa thông báo này (quản trị)</button>');$('#xoa').onclick=()=>xoaMuc('thong_bao',id,'Xóa vĩnh viễn thông báo này, người nhận sẽ không còn thấy?',dsTB)}
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
    $('#ph').disabled=true;
    const {error}=await sb.rpc('phat_thong_bao',{p_tieu_de:$('#tt').value,p_noi_dung:$('#nd2').value,p_khan:$('#kh').checked,p_nhac_gio:$('#kh').checked?2:24,p_toan_vien:toan,p_khoa:ids});
    $('#ph').disabled=false;if(error)return $('#loi').textContent=error.message;
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
function ganNutPush(){const b=$('#bpush');if(b)b.onclick=async()=>{b.disabled=true;try{await batPush();toast('Đã bật thông báo');ve()}catch(e){toast(e.message||'Không bật được');b.disabled=false}}}
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
async function taiKhoan(){
  TC=!!(await sb.rpc('xem_tai_chinh')).data;
  const st=await pushTrangThai();
  $('#nd').innerHTML=`<div class="card"><h3>${esc(me.ho_ten)}</h3><div class="mut">${esc(me.chuc_vu||'')}<br>${esc(me.so_dien_thoai)}</div></div>
  <div class="card"><h3>Thông báo trên máy này</h3><div class="mut">${{bat:'Đang bật',tat:'Chưa bật',chan:'Đang bị chặn',ios:'Cần thêm app vào Màn hình chính',khong:'Máy không hỗ trợ'}[st]}</div>${st==='tat'?'<button class="full" id="bp">🔔 Bật thông báo</button>':st==='bat'?'<button class="sec full" id="tp">🔕 Tắt thông báo trên máy này</button>':''}</div>
  ${(me.vai_tro==='tchc'||me.vai_tro==='bgd'||me.la_quan_tri)?'<div class="card" id="cpb"><h3>Ai chưa bật thông báo</h3><div class="mut">Đang tải…</div></div>':''}
  ${TC?'<button class="full" id="kh">📊 Kế hoạch – sử dụng chi phí</button>':''}
  <button class="sec full" id="ra">🚪 Đăng xuất</button>`;
  if($('#bp'))$('#bp').onclick=async()=>{try{await batPush();toast('Đã bật thông báo');taiKhoan()}catch(e){toast(e.message||'Không bật được')}};
  if($('#tp'))$('#tp').onclick=async()=>{await tatPush();toast('Đã tắt');taiKhoan()};
  if($('#cpb'))sb.rpc('ds_chua_bat_push').then(({data,error})=>{const el=$('#cpb');if(!el)return;if(error)return el.innerHTML='<h3>Ai chưa bật thông báo</h3><div class="mut">Không xem được</div>';
    const dn=(data||[]).filter(x=>x.da_dang_nhap),ch=(data||[]).filter(x=>!x.da_dang_nhap);
    el.innerHTML='<h3>Ai chưa bật thông báo</h3><div class="mut">'+(dn.length?'<b>Đã đăng nhập nhưng chưa bật ('+dn.length+'):</b><br>'+dn.map(x=>esc(x.ho_ten)+(x.khoa?' · '+esc(x.khoa):'')).join('<br>')+'<br><br>':'')+'<b>Chưa đăng nhập lần nào:</b> '+ch.length+' người</div>'});
  if($('#kh'))$('#kh').onclick=()=>window.KH.ve();
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
