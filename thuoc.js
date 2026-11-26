// Tra cứu thuốc bệnh viện: thông tin cơ bản + các mã ICD-10 BHYT thanh toán được.
//
// Nguồn dữ liệu:
//  - dm_thuoc : danh mục thuốc BV (báo cáo DUC034 của khoa Dược) — KHÔNG sinh ra từ AI.
//  - thuoc_icd: mã ICD-10 gắn cho từng thuốc. Mỗi dòng ghi rõ AI gắn, NGÀY nào, đã duyệt chưa.
//               App không tự suy ra mã: gắn sai mã là hoặc bác sĩ kê sai chỉ định, hoặc BHXH xuất toán.
//  - icd10    : danh mục mã bệnh chuẩn, người gắn CHỌN từ đây chứ không gõ tay.
(()=>{
const A=()=>window.BVAPP,$=s=>document.querySelector(s);
const esc=s=>A().esc(s);
const kd=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();
const GH=50;
const tien=n=>n==null?'':Number(n).toLocaleString('vi-VN')+' đ';
const ngay=s=>{const d=new Date(s);return isNaN(d)?'':d.toLocaleDateString('vi-VN')};

let st={q:'',nhom:''}, tong=null, quyen=null, dangXem=null;

const DAC_BIET={'THUỐC GÂY NGHIỆN':'Thuốc gây nghiện — kê đơn và quản lý theo quy chế riêng',
                'THUỐC HƯỚNG THẦN':'Thuốc hướng thần — kê đơn và quản lý theo quy chế riêng'};

async function ve(){
  const n=$('#nd'); n.innerHTML='<p class="mut">Đang tải…</p>';
  if(quyen===null){
    const {data}=await A().sb.rpc('duoc_gan_icd');
    quyen=!!data;
  }
  if(tong===null){
    const {count,error}=await A().sb.from('dm_thuoc').select('id',{count:'exact',head:true});
    if(error)return n.innerHTML='<p class="mut">Lỗi: '+esc(error.message)+'</p>';
    tong=count||0;
  }
  n.innerHTML=`<div class="card"><h3>💊 Tra cứu thuốc bệnh viện</h3>
    <label for="tq">Tên thuốc, hoạt chất hoặc mã ATC <small class="mut">(gõ không dấu cũng ra)</small></label>
    <input id="tq" placeholder="vd: amlodipin, morphin, C09AA" value="${esc(st.q)}" autocomplete="off">
    <label for="tnhom">Nhóm</label>
    <select id="tnhom">
      <option value="">Tất cả nhóm</option>
      <option value="THUỐC TÂN DƯỢC">Thuốc tân dược</option>
      <option value="THUỐC GÂY NGHIỆN">Thuốc gây nghiện</option>
      <option value="THUỐC HƯỚNG THẦN">Thuốc hướng thần</option>
    </select>
    <button class="full" id="tgo">Tra cứu</button>
    <p class="mut" style="margin-top:8px">Danh mục thuốc bệnh viện: <b>${tong}</b> thuốc.</p>
  </div><div id="tkq"></div>`;
  $('#tnhom').value=st.nhom;
  const go=()=>{st.q=$('#tq').value;st.nhom=$('#tnhom').value;chay()};
  $('#tgo').onclick=go;
  $('#tq').onkeydown=e=>{if(e.key==='Enter')go()};
  $('#tnhom').onchange=go;
  if(st.q||st.nhom)chay(); else chay();
}

async function chay(){
  const o=$('#tkq'); if(!o)return; o.innerHTML='<p class="mut">Đang tra…</p>';
  let q=A().sb.from('dm_thuoc').select('*').eq('hoat_dong',true).order('ten').limit(GH);
  const k=kd(st.q); if(k)q=q.ilike('kd','%'+k+'%');
  if(st.nhom)q=q.eq('nhom',st.nhom);
  const {data,error}=await q; if(!$('#tkq'))return;
  if(error)return o.innerHTML='<p class="mut">Lỗi: '+esc(error.message)+'</p>';
  if(!data.length)return o.innerHTML='<p class="mut">Không có thuốc nào khớp. Thử gõ hoạt chất thay vì tên biệt dược.</p>';
  o.innerHTML=`<p class="mut">${data.length>=GH?'Hiện '+GH+' thuốc đầu, gõ thêm cho gọn.':data.length+' thuốc.'}</p>`
    +data.map(dong).join('');
  o.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>chiTiet(el.dataset.id));
}

const dong=r=>`<div class="card v" data-id="${r.id}">
  <h3>${esc(r.ten)}</h3>
  <div class="row">${r.hoat_chat?`<span class="tag">${esc(r.hoat_chat)}</span>`:''}${r.ham_luong?`<span class="tag bq">${esc(r.ham_luong)}</span>`:''}${DAC_BIET[r.nhom]?'<span class="tag red">'+esc(r.nhom.replace('THUỐC ',''))+'</span>':''}</div>
  ${r.atc_nhom?`<div class="mut" style="margin-top:6px">${esc(r.atc_nhom)}</div>`:''}
</div>`;

async function chiTiet(id){
  dangXem=id;
  const n=$('#nd'); n.innerHTML='<p class="mut">Đang mở…</p>';
  const [{data:t,error:e1},{data:ds,error:e2}]=await Promise.all([
    A().sb.from('dm_thuoc').select('*').eq('id',id).maybeSingle(),
    A().sb.from('thuoc_icd').select('id,ma_icd,chi_dinh,nguon,gan_luc,duyet,nguoi_gan(ho_ten),nguoi_duyet(ho_ten)').eq('thuoc_id',id).order('ma_icd'),
  ]);
  if(e1||!t)return n.innerHTML='<p class="mut">Không mở được thuốc này.</p>'+nutVe();
  const ma=(ds||[]).map(x=>x.ma_icd);
  let ten={};
  if(ma.length){
    const {data:ic}=await A().sb.from('icd10').select('ma,ten').in('ma',ma);
    (ic||[]).forEach(x=>ten[x.ma]=x.ten);
  }
  n.innerHTML=`${nutVe()}
  <div class="card">
    <h2 style="margin:0">${esc(t.ten)}</h2>
    <div class="row" style="margin-top:8px">
      ${t.hoat_chat?`<span class="tag">${esc(t.hoat_chat)}</span>`:''}
      ${t.ham_luong?`<span class="tag bq">${esc(t.ham_luong)}</span>`:''}
      ${t.dvt?`<span class="tag">${esc(t.dvt)}</span>`:''}
    </div>
    ${DAC_BIET[t.nhom]?`<p class="xacnhan" style="margin-top:10px">⚠ ${esc(DAC_BIET[t.nhom])}</p>`:''}
    <dl class="dl" style="margin-top:10px">
      ${t.atc_nhom?`<div><dt class="dl-n">Nhóm dược lý (ATC)</dt><dd>${esc(t.atc_nhom)}</dd></div>`:''}
      ${t.ma_atc?`<div><dt class="dl-n">Mã ATC</dt><dd>${esc(t.ma_atc)}</dd></div>`:''}
      ${t.ma_byt?`<div><dt class="dl-n">Mã báo cáo BYT</dt><dd>${esc(t.ma_byt)}</dd></div>`:''}
      <div><dt class="dl-n">Mã nội viện</dt><dd>${esc(t.ma_bc)}</dd></div>
      ${t.don_gia!=null?`<div><dt class="dl-n">Đơn giá</dt><dd>${esc(tien(t.don_gia))}${t.don_gia_min!=null&&Number(t.don_gia_min)!==Number(t.don_gia)?' <span class="mut">(thấp nhất '+esc(tien(t.don_gia_min))+')</span>':''}</dd></div>`:''}
    </dl>
  </div>

  <div class="card">
    <h3>Mã thanh toán bảo hiểm ICD-10</h3>
    ${bangIcd(ds||[],ten)}
    <p class="mut" style="margin-top:10px">Danh sách này do khoa Dược / phòng KHTH của bệnh viện gắn, dùng để <b>tham khảo khi kê đơn và thanh toán BHYT</b>. Không thay thế chỉ định của bác sĩ điều trị.</p>
    ${quyen?`<button class="sec" id="tgan" style="margin-top:6px">Gắn mã ICD-10</button>`:''}
  </div>
  <div id="tform"></div>`;
  $('#tve').onclick=()=>{dangXem=null;ve()};
  if($('#tgan'))$('#tgan').onclick=()=>formGan(t);
  if(quyen)n.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>goMa(b.dataset.go));
}

const nutVe=()=>'<button class="sec" id="tve" style="margin-bottom:10px">← Về danh sách</button>';

function bangIcd(ds,ten){
  if(!ds.length) return '<p class="mut">Chưa gắn mã nào. '+(/* nhắc đúng người */'Khoa Dược hoặc phòng KHTH gắn mã ở nút bên dưới.')+'</p>';
  return `<table class="tb"><thead><tr><th style="width:5.5em">Mã ICD-10</th><th>Chỉ định</th>${quyen?'<th></th>':''}</tr></thead>
  <tbody class="tb-than">${ds.map(x=>`<tr>
    <td><b>${esc(x.ma_icd)}</b>${x.duyet?' <span class="tag grn">đã duyệt</span>':''}</td>
    <td>${esc(x.chi_dinh||ten[x.ma_icd]||'')}
      <div class="mut" style="font-size:.86em;margin-top:2px">${esc(x.nguon)}${x.nguoi_gan&&x.nguoi_gan.ho_ten?' · '+esc(x.nguoi_gan.ho_ten):''} · ${esc(ngay(x.gan_luc))}</div></td>
    ${quyen?`<td><button class="sec nho" data-go="${x.id}" aria-label="Gỡ mã ${esc(x.ma_icd)}">Gỡ</button></td>`:''}
  </tr>`).join('')}</tbody></table>`;
}

async function formGan(t){
  const o=$('#tform');
  const {count}=await A().sb.from('icd10').select('ma',{count:'exact',head:true});
  if(!count){
    o.innerHTML=`<div class="card"><h3>Gắn mã ICD-10</h3>
      <p class="xacnhan">Chưa nạp danh mục mã ICD-10 nên chưa chọn mã được. Nạp danh mục theo TT 06/2026 rồi mới gắn — để người gắn <b>chọn</b> mã thay vì gõ tay, tránh sai mã.</p></div>`;
    o.scrollIntoView({behavior:'smooth',block:'nearest'}); return;
  }
  o.innerHTML=`<div class="card"><h3>Gắn mã ICD-10 cho ${esc(t.ten)}</h3>
    <label for="tim">Tìm mã bệnh <small class="mut">(gõ mã hoặc tên bệnh, không dấu cũng ra)</small></label>
    <input id="tim" placeholder="vd: K59 hoặc tieu chay" autocomplete="off">
    <div id="tgoi"></div>
    <label for="tcd">Chỉ định ghi trên thẻ <small class="mut">(để trống thì lấy tên bệnh)</small></label>
    <input id="tcd" placeholder="vd: Tiêu chảy chức năng" autocomplete="off">
    <div class="row" style="gap:8px;margin-top:8px"><button id="tluu" disabled>Lưu mã</button><button class="sec" id="thuy">Thôi</button></div>
    <p class="mut" style="margin-top:8px">Mã gắn ở đây ghi kèm tên anh/chị và ngày gắn. Khoa Dược duyệt lại trước khi bác sĩ dùng.</p>
  </div>`;
  let chon=null;
  const tim=$('#tim'), goi=$('#tgoi');
  let hen;
  tim.oninput=()=>{clearTimeout(hen);hen=setTimeout(async()=>{
    const v=tim.value.trim(); if(v.length<2){goi.innerHTML='';return}
    const k=kd(v);
    const {data}=await A().sb.from('icd10').select('ma,ten')
      .or(`ma.ilike.${v.toUpperCase()}%,kd.ilike.%${k}%`).order('ma').limit(12);
    goi.innerHTML=(data||[]).map(x=>`<button type="button" class="chip them" data-ma="${esc(x.ma)}" data-ten="${esc(x.ten)}">${esc(x.ma)} — ${esc(x.ten)}</button>`).join('')
      ||'<p class="mut">Không có mã nào khớp.</p>';
    goi.querySelectorAll('[data-ma]').forEach(b=>b.onclick=()=>{
      chon={ma:b.dataset.ma,ten:b.dataset.ten};
      tim.value=chon.ma+' — '+chon.ten; goi.innerHTML=''; $('#tluu').disabled=false;
    });
  },250)};
  $('#thuy').onclick=()=>{o.innerHTML=''};
  $('#tluu').onclick=async()=>{
    if(!chon)return;
    const b=A().ban($('#tluu'));
    const {error}=await A().sb.from('thuoc_icd').insert({
      thuoc_id:t.id, ma_icd:chon.ma, chi_dinh:$('#tcd').value.trim()||chon.ten,
      nguon:'khoa Dược', nguoi_gan:A().me.id});
    A().ban(b,false);
    if(error)return A().toast(/duplicate|unique/i.test(error.message)?'Mã này đã gắn rồi':'Lỗi: '+error.message);
    A().toast('Đã gắn mã '+chon.ma); o.innerHTML=''; chiTiet(t.id);
  };
}

async function goMa(id){
  const {error}=await A().sb.from('thuoc_icd').delete().eq('id',id);
  if(error)return A().toast('Lỗi: '+error.message);
  A().toast('Đã gỡ mã'); chiTiet(dangXem);
}

window.TRATHUOC={ve};
})();
