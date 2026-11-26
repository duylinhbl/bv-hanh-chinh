// Tra cứu tờ hướng dẫn sử dụng thuốc.
// App chỉ giữ DANH MỤC (tên, hoạt chất, hàm lượng, id tệp); nội dung PDF vẫn nằm trên Drive của khoa Dược,
// bấm xem là mở thẳng tệp gốc — nên không bao giờ có hai phiên bản lệch nhau.
(()=>{
const A=()=>window.BVAPP,$=s=>document.querySelector(s);
const esc=s=>A().esc(s);
const kd=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();
const GH=60;
let st={q:'',chi_bv:false}, tong=null;

const dsUrl=id=>'https://drive.google.com/file/d/'+id+'/view';

async function ve(){
  const n=$('#nd'); n.innerHTML='Đang tải…';
  if(tong===null){
    const {count,error}=await A().sb.from('thuoc').select('drive_id',{count:'exact',head:true});
    if(error)return n.innerHTML='<p class="mut">Lỗi: '+esc(error.message)+'</p>';
    tong=count||0;
  }
  if(!tong) return n.innerHTML=`<div class="card"><h3>💊 Tra cứu tờ hướng dẫn sử dụng thuốc</h3>
    <p class="mut">Danh mục chưa được nạp. Khoa Dược chia sẻ thư mục kho cho tài khoản chạy script,
    quản trị vào đây bấm <b>Làm mới danh mục</b> là xong.</p>${nutLamMoi()}</div>`;

  n.innerHTML=`<div class="card"><h3>💊 Tra cứu tờ hướng dẫn sử dụng thuốc</h3>
    <label>Tên thuốc hoặc hoạt chất <small class="mut">(gõ không dấu cũng ra)</small>
      <input id="tq" placeholder="vd: amlodipin, kacerin, kim tien thao" value="${esc(st.q)}"></label>
    <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="tbv" ${st.chi_bv?'checked':''}> Chỉ thuốc bệnh viện đang dùng</label>
    <button class="full" id="tgo">Tra cứu</button>
    <p class="mut" style="margin-top:8px">Danh mục có <b>${tong}</b> tờ hướng dẫn. Nội dung do khoa Dược quản lý, bấm xem là mở tệp gốc trên Drive.</p>
    ${A().me.la_quan_tri?nutLamMoi():''}</div><div id="tkq"></div>`;
  const go=()=>{st.q=$('#tq').value;st.chi_bv=$('#tbv').checked;chay()};
  $('#tgo').onclick=go; $('#tq').onkeydown=e=>{if(e.key==='Enter')go()};
  if($('#tlm'))$('#tlm').onclick=lamMoi;
  if(st.q)chay();
}
const nutLamMoi=()=>A().me.la_quan_tri?'<button class="sec" id="tlm" style="margin-top:8px">🔄 Làm mới danh mục từ Drive</button>':'';

async function chay(){
  const o=$('#tkq'); if(!o)return; o.innerHTML='<p class="mut">Đang tra…</p>';
  let q=A().sb.from('thuoc').select('*').order('ten').limit(GH);
  const k=kd(st.q); if(k)q=q.ilike('kd','%'+k+'%');
  if(st.chi_bv)q=q.eq('bv_dung',true);
  const {data,error}=await q; if(!$('#tkq'))return;
  if(error)return o.innerHTML='<p class="mut">Lỗi: '+esc(error.message)+'</p>';
  if(!data.length)return o.innerHTML='<p class="mut">Không tìm thấy thuốc nào khớp. Thử gõ hoạt chất thay vì tên biệt dược.</p>';
  o.innerHTML=`<p class="mut">${data.length>=GH?'Hiện '+GH+' kết quả đầu, gõ thêm cho gọn.':data.length+' kết quả.'}</p>`
    +data.map(the).join('');
  o.querySelectorAll('[data-bv]').forEach(b=>b.onclick=()=>danhDau(b.dataset.bv,b.dataset.co!=='1'));
}
const the=r=>`<div class="card"><h3>${esc(r.ten)}</h3>
  <div class="row">${r.hoat_chat?`<span class="tag">${esc(r.hoat_chat)}</span>`:''}${r.ham_luong?`<span class="tag bq">${esc(r.ham_luong)}</span>`:''}${r.bv_dung?'<span class="tag grn">BV đang dùng</span>':''}</div>
  <div class="row" style="margin-top:8px;gap:8px">
    <a class="nut" href="${dsUrl(r.drive_id)}" target="_blank" rel="noopener">📄 Xem tờ hướng dẫn</a>
    ${(A().me.la_quan_tri||A().me.vai_tro==='bgd')?`<button class="sec" data-bv="${r.drive_id}" data-co="${r.bv_dung?1:0}">${r.bv_dung?'Bỏ đánh dấu':'Đánh dấu BV dùng'}</button>`:''}
  </div>
  <div class="mut" style="margin-top:6px">${esc(r.ten_tep)}</div></div>`;

async function danhDau(id,bat){
  const {error}=await A().sb.from('thuoc').update({bv_dung:!!bat}).eq('drive_id',id);
  if(error)return A().toast('Lỗi: '+error.message);
  A().toast(bat?'Đã đánh dấu BV đang dùng':'Đã bỏ đánh dấu'); chay();
}

async function lamMoi(){
  const b=A().ban($('#tlm'));
  try{
    const {data,error}=await A().sb.functions.invoke('thuoc-dong-bo',{body:{}});
    if(error)throw error;
    if(!data.ok)throw new Error(data.loi||'Không quét được');
    A().toast(`Đã cập nhật ${data.da_ghi} tờ hướng dẫn`+(data.da_xoa?`, gỡ ${data.da_xoa} tệp không còn`:''));
    tong=null; ve();
  }catch(e){
    A().ban(b,false);
    A().toast('Lỗi: '+(e.message||e));
  }
}

window.TRATHUOC={ve};
})();
