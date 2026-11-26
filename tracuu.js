// Menu TRA CỨU — đầu mối cho các danh mục tra cứu chuyên môn của bệnh viện.
//
// Bốn nhánh:
//   1. ICD-10              — mã bệnh chuẩn (màn tra cứu nằm ngay trong tệp này)
//   2. Thuốc & BHYT        — thuoc.js
//   3. Phác đồ điều trị    — chờ phòng KHTH cung cấp
//   4. Quy trình & DMKT    — chờ phòng KHTH cung cấp
//
// Nguyên tắc chung cho cả 4 nhánh: mỗi danh mục phải nói rõ LẤY TỪ ĐÂU và NGÀY NÀO
// (bảng tra_cuu_nguon). Danh mục chuyên môn mà không ghi nguồn thì không ai dám dùng.
(()=>{
const A=()=>window.BVAPP,$=s=>document.querySelector(s);
const esc=s=>A().esc(s);
const kd=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();
const GH=60;

let nguon=null;            // {ma_dm: {ban, cap_nhat, so_dong}}
let st={q:'',bc:false};    // trạng thái màn ICD

const NHANH=[
  {ma:'icd10', ten:'ICD-10', mo:'Mã bệnh chuẩn — tra theo mã hoặc tên bệnh, gõ không dấu cũng ra',
   bieu:'M10.5 3.5h3a4 4 0 014 4v9a4 4 0 01-4 4h-3a4 4 0 01-4-4v-9a4 4 0 014-4z M6.5 12h11', mo_man:()=>veIcd()},
  {ma:'thuoc', ten:'Thuốc & BHYT', mo:'Thuốc bệnh viện đang dùng, kèm mã ICD-10 thanh toán bảo hiểm',
   bieu:'M4 12h16 M12 4v16', mo_man:()=>window.TRATHUOC.ve()},
  {ma:'phac_do', ten:'Phác đồ điều trị', mo:'Phác đồ của bệnh viện', cho:'phòng KHTH'},
  {ma:'quy_trinh_kt', ten:'Quy trình & danh mục kỹ thuật', mo:'Quy trình kỹ thuật và danh mục kỹ thuật của bệnh viện', cho:'phòng KHTH'},
];

async function tai(){
  if(nguon)return;
  const {data}=await A().sb.from('tra_cuu_nguon').select('ma_dm,ban,cap_nhat,so_dong');
  nguon={}; (data||[]).forEach(x=>nguon[x.ma_dm]=x);
}

const ngay=s=>{const d=new Date(s);return isNaN(d)?'':d.toLocaleDateString('vi-VN')};
const so=n=>Number(n||0).toLocaleString('vi-VN');

// ───────── Màn đầu mối ─────────
async function ve(){
  const n=$('#nd'); n.innerHTML='<p class="mut">Đang tải…</p>';
  await tai();
  n.innerHTML=`<div class="card"><h3>Tra cứu chuyên môn</h3>
    <p class="mut">Các danh mục dùng chung của bệnh viện. Mỗi danh mục ghi rõ nguồn và ngày cập nhật.</p></div>`
    + NHANH.map(the).join('');
  n.querySelectorAll('[data-nh]').forEach(el=>{
    const nh=NHANH.find(x=>x.ma===el.dataset.nh);
    if(nh&&nh.mo_man)el.onclick=()=>nh.mo_man();
  });
}

function the(nh){
  const g=nguon[nh.ma];
  const san=!!nh.mo_man && !!g && g.so_dong>0;
  const phu = san
    ? `<div class="mut" style="margin-top:6px">${esc(so(g.so_dong))} mục · ${esc(g.ban||'')}${g.cap_nhat?' · cập nhật '+esc(ngay(g.cap_nhat)):''}</div>`
    : `<div class="mut" style="margin-top:6px">Chưa có dữ liệu${nh.cho?` — đang chờ ${esc(nh.cho)} cung cấp`:''}.</div>`;
  return `<div class="card${san?' v':''}"${san?` data-nh="${nh.ma}"`:''}>
    <h3>${esc(nh.ten)}${san?'':' <span class="tag amb">chưa có</span>'}</h3>
    <p class="mut" style="margin:4px 0 0">${esc(nh.mo)}</p>${phu}</div>`;
}

// ───────── Màn ICD-10 ─────────
const nutVe=()=>'<button class="sec" id="tcve" style="margin-bottom:10px">← Tra cứu</button>';

async function veIcd(){
  const n=$('#nd');
  await tai();
  const g=nguon['icd10']||{};
  n.innerHTML=`${nutVe()}
  <div class="card"><h3>Tra cứu mã bệnh ICD-10</h3>
    <label for="iq">Mã bệnh hoặc tên bệnh <small class="mut">(gõ không dấu cũng ra)</small>
      <input id="iq" placeholder="vd: K59.1, tieu chay, tang huyet ap" value="${esc(st.q)}"></label>
    <label style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="ibc" ${st.bc?'checked':''}> Chỉ mã dùng được làm bệnh chính</label>
    <button class="full" id="igo">Tra cứu</button>
    <p class="mut" style="margin-top:8px">Danh mục có <b>${esc(so(g.so_dong))}</b> mã.
      Nguồn: ${esc(g.ban||'chưa ghi nguồn')}.</p>
  </div><div id="ikq"></div>`;
  $('#tcve').onclick=()=>ve();
  const go=()=>{st.q=$('#iq').value;st.bc=$('#ibc').checked;chayIcd()};
  $('#igo').onclick=go; $('#iq').onkeydown=e=>{if(e.key==='Enter')go()};
  if(st.q)chayIcd();
}

async function chayIcd(){
  const o=$('#ikq'); if(!o)return; o.innerHTML='<p class="mut">Đang tra…</p>';
  const k=kd(st.q);

  // Tra song song: danh mục đang hiệu lực + danh sách mã ĐÃ HUỶ.
  // Bác sĩ quen tay gõ mã cũ (A90 sốt xuất huyết, K35 viêm ruột thừa, I84 trĩ…) thì phải
  // báo ngay là mã đã huỷ, chứ im lặng trả "không tìm thấy" là họ tưởng gõ sai rồi gõ lại.
  let q=A().sb.from('icd10_2026')
    .select('ma,ten,ten_en,ten_nhom3,ten_chuong,huong_dan,k_chinh,k_kkhich,k_dung,tu_vong,nu,nam')
    .order('ma').limit(GH);
  if(k)q=q.ilike('kd','%'+k+'%');
  if(st.bc)q=q.eq('k_chinh',false).eq('k_dung',false);

  let h=A().sb.from('icd10_huy').select('ma,ten,nhom').order('ma').limit(20);
  if(k)h=h.or(`ma.ilike.%${k.toUpperCase()}%,ten.ilike.%${st.q.trim()}%`);

  const [{data,error},{data:huy}]=await Promise.all([q,h]);
  if(!$('#ikq'))return;
  if(error)return o.innerHTML='<p class="mut">Lỗi: '+esc(error.message)+'</p>';

  const canhBao=(huy||[]).length?`<div class="card" style="border-left:4px solid var(--red)">
    <h3 style="margin:0;color:var(--red)">⚠ ${(huy||[]).length} mã dưới đây ĐÃ HUỶ</h3>
    <p class="mut" style="margin:6px 0">Theo Thông tư 06/2026/TT-BYT (hiệu lực 01/7/2026).
      Phải chọn mã khác trong danh mục hiện hành thay thế, dùng tiếp là bị xuất toán.</p>
    ${(huy||[]).map(x=>`<div class="mut">• <b>${esc(x.ma)}</b> — ${esc(x.ten||'')}</div>`).join('')}
  </div>`:'';

  if(!data.length)return o.innerHTML=canhBao
    +'<p class="mut">Không có mã nào đang hiệu lực khớp. Thử gõ tên bệnh thay vì mã, hoặc ngược lại.</p>';
  o.innerHTML=canhBao
    +`<p class="mut">${data.length>=GH?'Hiện '+GH+' mã đầu, gõ thêm cho gọn.':data.length+' mã.'}</p>`
    +data.map(dongIcd).join('');
}

// Sáu cột quy tắc của TT 06/2026 — đây là thứ chặn xuất toán, nên hiện ngay trên thẻ
const CO=[
  ['k_chinh', 'red', 'KHÔNG được dùng làm bệnh chính'],
  ['k_dung',  'red', 'KHÔNG dùng — đã có mã 4–5 ký tự cụ thể hơn'],
  ['k_kkhich','amb', 'Không khuyến khích làm bệnh chính'],
  ['tu_vong', 'amb', 'Chỉ dùng mã hoá nguyên nhân tử vong'],
  ['nu',      'bq',  'Chỉ/chủ yếu ở nữ'],
  ['nam',     'bq',  'Chỉ/chủ yếu ở nam'],
];

const dongIcd=r=>`<div class="card">
  <h3 style="margin:0">${esc(r.ma)} — ${esc(r.ten)}</h3>
  ${r.ten_en?`<div class="mut" style="margin-top:2px">${esc(r.ten_en)}</div>`:''}
  <div class="row" style="margin-top:6px">
    ${r.ten_nhom3?`<span class="tag">${esc(r.ten_nhom3)}</span>`:''}
    ${CO.filter(([k])=>r[k]).map(([,m,t])=>`<span class="tag ${m}">${esc(t)}</span>`).join('')}
  </div>
  ${r.huong_dan?`<div class="mut" style="margin-top:6px">${esc(r.huong_dan)}</div>`:''}
  ${r.ten_chuong?`<div class="mut" style="margin-top:4px">Chương: ${esc(r.ten_chuong)}</div>`:''}
</div>`;

window.TRACUU={ve, veIcd};
})();
