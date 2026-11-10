(()=>{
const A=()=>window.BVAPP, $=s=>document.querySelector(s);
const TH=['CN','Hai','Ba','Tư','Năm','Sáu','Bảy'];
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const pd=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const add=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return iso(d)};
const dm=s=>{const d=pd(s);return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')};
const days=(a,b)=>{const r=[];for(let d=a;d<=b;d=add(d,1))r.push(d);return r};
const isBS=p=>p&&/\bbs\b|bác s/i.test((p.chuc_vu||'')+' '+(p.chuyen_mon||''));
let P=[],PM={},VT=[],CAM=[],NAME={},duocXep=false,NHOM={};
const idTen=t=>(P.find(p=>p.ho_ten===t)||{}).id;

async function nap(){
  const [a,b,c,d,e]=await Promise.all([A().sb.rpc('ds_nguoi_truc'),A().sb.from('vi_tri_truc').select('*').order('id'),A().sb.from('cam_truc_chung').select('a,b'),A().sb.rpc('duoc_xep'),A().sb.from('nhom_truc').select('*').order('thu_tu')]);
  NHOM={};(e.data||[]).forEach(g=>(NHOM[g.vi_tri_id]=NHOM[g.vi_tri_id]||[]).push(g));
  P=a.data||[];PM={};P.forEach(p=>PM[p.id]=p);VT=b.data||[];CAM=c.data||[];duocXep=!!d.data;
  const last=p=>p.ho_ten.trim().split(/\s+/);const cnt={};
  P.filter(p=>!p.khong_truc).forEach(p=>{const k=last(p).slice(-1)[0];cnt[k]=(cnt[k]||0)+1});
  P.forEach(p=>{const w=last(p),k=w.slice(-1)[0];NAME[p.id]=p.ten_goi||(cnt[k]>1&&!p.khong_truc?w.slice(-2).join(' '):k)});
}
const nm=id=>{const p=PM[id];return p?(isBS(p)?'BS ':'')+NAME[id]:'?'};

// ----- kiểm tra quy tắc cho 1 ngày -----
function canhBao(m,ngay){
  const w=[],ids=[0,1].map(i=>m[`${ngay}|2|${i}`]).filter(Boolean);
  for(const [k,v] of Object.entries(m)){if(k.startsWith(ngay)&&v&&PM[v]&&PM[v].khong_truc)w.push(`${NAME[v]} không tham gia trực`)}
  if(ids.length===2){
    const [x,y]=ids;
    if(x===y)w.push('Trực viện: trùng một người');
    else{
      if(CAM.some(c=>(c.a===x&&c.b===y)||(c.a===y&&c.b===x)))w.push(`Trực viện: ${NAME[x]} và ${NAME[y]} không trực chung`);
      const kx=PM[x]?.khoa,ky=PM[y]?.khoa;
      if(kx&&kx===ky&&kx!=='KHOA KHÁM BỆNH')w.push(`Trực viện: cùng ${kx} (chỉ Khoa Khám bệnh được 2 bác sĩ)`);
    }
  }
  const ld=m[`${ngay}|1|0`],BS3=['Nguyễn Đắc Lộc','Nguyễn Hữu Danh','Tô Văn Châu'].map(idTen),CH=idTen('Tô Văn Châu');
  if(ld&&BS3.includes(ld)&&!ids.includes(ld))w.push(`${NAME[ld]} trực lãnh đạo thì cũng là bác sĩ trực viện (cột 1)`);
  if(CH&&ids.includes(CH)&&![0,1].map(i=>m[`${ngay}|4|${i}`]).includes(CH))w.push('Châu trực viện thì trực luôn Siêu âm');
  return [...new Set(w)];
}

// ----- tải / lưu kỳ -----
async function taiKy(ky){
  const {data}=await A().sb.from('lich_truc').select('ngay,vi_tri_id,thu_tu,nguoi_id').gte('ngay',ky.tu_ngay).lte('ngay',ky.den_ngay).limit(5000);
  const m={};(data||[]).forEach(r=>m[`${r.ngay}|${r.vi_tri_id}|${r.thu_tu}`]=r.nguoi_id);return m;
}
async function luu(ky,m){
  const rows=Object.entries(m).filter(([,v])=>v).map(([k,v])=>{const [ngay,vt,tt]=k.split('|');return{ngay,vi_tri_id:+vt,thu_tu:+tt,nguoi_id:v}});
  const d=await A().sb.from('lich_truc').delete().gte('ngay',ky.tu_ngay).lte('ngay',ky.den_ngay);
  if(d.error)throw d.error;
  for(let i=0;i<rows.length;i+=500){const r=await A().sb.from('lich_truc').insert(rows.slice(i,i+500));if(r.error)throw r.error}
}

// ----- màn hình chính tab Lịch trực -----
async function ve(){
  const {$:q,esc,fmt}=A();
  q('#nd').innerHTML='Đang tải…';
  try{
    await nap();
    const today=iso(new Date());
    const [mine,ks]=await Promise.all([
      A().sb.from('lich_truc').select('ngay,vi_tri_id,thu_tu').eq('nguoi_id',A().me.id).gte('ngay',today).order('ngay').limit(40),
      A().sb.from('lich_truc_ky').select('*').order('tu_ngay',{ascending:false}).limit(12)]);
    const vtn=Object.fromEntries(VT.map(v=>[v.id,v.ten]));
    q('#nd').innerHTML=`<div class="card"><h3>Ca trực sắp tới của tôi</h3>${(mine.data||[]).map(r=>`<div class="row" style="justify-content:space-between;padding:4px 0"><b>${TH[pd(r.ngay).getDay()]} ${dm(r.ngay)}</b><span>${esc(vtn[r.vi_tri_id]||'')}</span></div>`).join('')||'<p class="mut">Chưa có ca nào được công bố.</p>'}</div>
    <div class="card"><h3>Lịch trực toàn viện</h3>${(ks.data||[]).map(k=>`<div class="row" style="justify-content:space-between;padding:6px 0"><span>${dm(k.tu_ngay)} – ${dm(k.den_ngay)} ${k.trang_thai==='nhap'?'<span class="tag amb">Nháp</span>':'<span class="tag grn">Đã công bố</span>'}</span><span><button class="sec" data-xem="${k.id}">Xem</button> ${duocXep?`<button data-sua="${k.id}">Sửa</button>`:''} ${A().me.la_quan_tri?`<button class="dng" data-xoa="${k.id}">Xóa</button>`:''}</span></div>`).join('')||'<p class="mut">Chưa có kỳ lịch.</p>'}
    ${duocXep?'<button class="full" id="moiky">+ Tạo kỳ lịch mới</button>':''}</div>`;
    const kmap=Object.fromEntries((ks.data||[]).map(k=>[k.id,k]));
    document.querySelectorAll('[data-xem]').forEach(b=>b.onclick=()=>xem(kmap[b.dataset.xem]));
    document.querySelectorAll('[data-sua]').forEach(b=>b.onclick=()=>soan(kmap[b.dataset.sua]));
    document.querySelectorAll('[data-xoa]').forEach(b=>b.onclick=()=>xoaKy(kmap[b.dataset.xoa]));
    if($('#moiky'))$('#moiky').onclick=()=>kyMoi(ks.data||[]);
  }catch(e){q('#nd').innerHTML='<p class="mut">Lỗi: '+A().esc(e.message||e)+'</p>'}
}
async function xoaKy(ky){
  if(!A().me.la_quan_tri)return;
  if(!confirm(`Xóa kỳ lịch ${dm(ky.tu_ngay)} – ${dm(ky.den_ngay)} cùng toàn bộ phân công trong kỳ? Không khôi phục được.`))return;
  const a=await A().sb.from('lich_truc').delete().gte('ngay',ky.tu_ngay).lte('ngay',ky.den_ngay);
  if(a.error)return A().toast('Lỗi: '+a.error.message);
  const b=await A().sb.from('lich_truc_ky').delete().eq('id',ky.id);
  if(b.error)return A().toast('Lỗi: '+b.error.message);
  A().toast('Đã xóa kỳ lịch');ve();
}
function kyMoi(ds){
  const {$:q}=A();
  const last=ds.length?add(ds[0].den_ngay,1):iso(new Date());
  q('#nd').innerHTML=`<button class="sec" id="lui">← Quay lại</button><div class="card" style="margin-top:10px"><label>Từ ngày (thường là thứ Hai)</label><input id="tu" type="date" value="${last}"><label>Đến ngày</label><input id="den" type="date" value="${add(last,13)}"><button class="full" id="tao">Tạo kỳ lịch</button><p class="mut" id="loi"></p></div>`;
  $('#lui').onclick=ve;
  $('#tao').onclick=async()=>{const {data,error}=await A().sb.from('lich_truc_ky').insert({tu_ngay:$('#tu').value,den_ngay:$('#den').value}).select().single();if(error)return $('#loi').textContent=error.message;soan(data)}
}

// ----- soạn lịch -----
async function soan(ky){
  const {$:q,esc,toast}=A();
  let m=await taiKy(ky);
  const dsNgay=days(ky.tu_ngay,ky.den_ngay);
  let tatca=false;
  const opt=(vt,cur)=>{
    let g=P.filter(p=>!p.khong_truc);
    if(!tatca&&vt.nhom!=='cbvc'){
      const gy=vt.goi_y_khoa||[];
      if(gy.length)g=g.filter(p=>gy.includes(p.khoa));
      if(vt.nguoi_cho_phep&&vt.nguoi_cho_phep.length)g=g.filter(p=>vt.nguoi_cho_phep.includes(p.id));
      else if(vt.ma==='truc_vien')g=g.filter(isBS);
    }
    if(cur&&PM[cur]&&!g.some(p=>p.id===cur))g=[PM[cur],...g];
    const o=p=>`<option value="${p.id}" ${p.id===cur?'selected':''}>${esc(nm(p.id))} · ${esc((p.khoa||'').replace(/^(KHOA|PHÒNG) /,''))}${p.nam_sinh?' · '+p.nam_sinh:''}${p.khong_truc?' (không trực)':''}</option>`;
    return `<option value="">—</option>${g.map(o).join('')}`;
  };
  const nhomOpt=(v,n)=>{
    const cur=Array.from({length:v.so_nguoi},(_,i)=>m[`${n}|${v.id}|${i}`]||'').join(',');
    return '<option value="">— Chọn nhóm —</option>'+NHOM[v.id].map(g=>{const ds=g.thanh_vien.slice(0,v.so_nguoi);
      return `<option value="${g.id}" ${ds.join(',')===cur?'selected':''}>${g.ten} · NT ${esc(NAME[ds[0]]||'?')}: ${esc(ds.map(i=>NAME[i]||'?').join(', '))}</option>`}).join('');
  };
  const setCell=(key,id)=>{m[key]=id||null;const el=document.querySelector(`[data-k="${key}"]`);if(!el)return;
    if(id&&![...el.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;o.textContent=nm(id);el.appendChild(o)}el.value=id||''};
  const tuDong=key=>{const [n,vt]=key.split('|');
    if(vt==='1'){const v=m[key],B=['Nguyễn Đắc Lộc','Nguyễn Hữu Danh','Tô Văn Châu'].map(idTen);if(v&&B.includes(v))setCell(`${n}|2|0`,v)}
    if(vt==='1'||vt==='2'){const CH=idTen('Tô Văn Châu');if(CH&&[0,1].some(i=>m[`${n}|2|${i}`]===CH)&&![0,1].some(i=>m[`${n}|4|${i}`]===CH))setCell(`${n}|4|0`,CH)}
  };
  const dung=()=>{
    q('#nd').innerHTML=`<button class="sec" id="lui">← Quay lại</button>
    <div class="card" style="margin-top:10px"><h3>${dm(ky.tu_ngay)} – ${dm(ky.den_ngay)} ${ky.trang_thai==='nhap'?'<span class="tag amb">Nháp</span>':'<span class="tag grn">Đã công bố</span>'}</h3>
    <div class="row"><button class="sec" id="cp">Sao chép từ kỳ trước</button><button class="sec" id="in">In</button></div>
    <label style="font-weight:400;margin-top:8px"><input id="ta" type="checkbox" style="width:auto" ${tatca?'checked':''}> Hiện toàn bộ nhân sự (bỏ lọc theo khoa)</label></div>
    ${dsNgay.map(n=>{const cb=pd(n).getDay()===0||pd(n).getDay()===6;
      return `<div class="card" data-n="${n}"><h3>${TH[pd(n).getDay()]} ${dm(n)}</h3>${VT.filter(v=>v.nhom==='truc'||(cb&&v.nhom==='cbvc')).map(v=>`<label>${esc(v.ten)}</label>`+(NHOM[v.id]?`<select data-g="${n}|${v.id}" style="margin-bottom:4px">${nhomOpt(v,n)}</select>`:'')+Array.from({length:v.so_nguoi},(_,i)=>`<select data-k="${n}|${v.id}|${i}" style="margin-bottom:4px">${opt(v,m[`${n}|${v.id}|${i}`])}</select>`).join('')).join('')}<div class="cb" style="color:var(--red);font-size:14px;margin-top:6px"></div></div>`}).join('')}
    <div class="card"><button class="full" id="luu">Lưu</button>${ky.trang_thai==='nhap'?'<button class="full" id="cb">Công bố lịch</button>':''}<p class="mut" id="loi"></p></div>`;
    const wr=()=>document.querySelectorAll('[data-n]').forEach(c=>{const w=canhBao(m,c.dataset.n);c.querySelector('.cb').innerHTML=w.map(x=>'⚠ '+esc(x)).join('<br>')});
    document.querySelectorAll('[data-k]').forEach(s=>s.onchange=()=>{m[s.dataset.k]=s.value||null;tuDong(s.dataset.k);wr()});
    document.querySelectorAll('[data-g]').forEach(s=>s.onchange=()=>{const [n,vt]=s.dataset.g.split('|'),v=VT.find(x=>x.id===+vt),g=(NHOM[vt]||[]).find(x=>String(x.id)===s.value);
      for(let i=0;i<v.so_nguoi;i++)setCell(`${n}|${vt}|${i}`,g?g.thanh_vien[i]:null);wr()});wr();
    $('#lui').onclick=ve;
    $('#ta').onchange=()=>{tatca=$('#ta').checked;dung()};
    $('#in').onclick=()=>inLich(ky,m);
    $('#cp').onclick=async()=>{
      const {data}=await A().sb.from('lich_truc_ky').select('*').lt('tu_ngay',ky.tu_ngay).order('tu_ngay',{ascending:false}).limit(1);
      if(!data||!data[0])return toast('Chưa có kỳ trước');
      const src=await taiKy(data[0]),off=Math.round((pd(ky.tu_ngay)-pd(data[0].tu_ngay))/864e5);
      m={};for(const [k,v] of Object.entries(src)){const [n,vt,tt]=k.split('|'),nn=add(n,off);if(nn<=ky.den_ngay&&!(PM[v]&&PM[v].khong_truc))m[`${nn}|${vt}|${tt}`]=v}
      dung();toast('Đã chép, bồ kiểm tra lại rồi Lưu');
    };
    const sv=async()=>{$('#loi').textContent='';try{await luu(ky,m);toast('Đã lưu');return true}catch(e){$('#loi').textContent='Lỗi lưu: '+e.message;return false}};
    $('#luu').onclick=sv;
    if($('#cb'))$('#cb').onclick=async()=>{
      const co=dsNgay.filter(n=>canhBao(m,n).length).length;
      if(co&&!confirm(`Còn ${co} ngày có cảnh báo quy tắc. Vẫn công bố?`))return;
      if(!await sv())return;
      const {error}=await A().sb.from('lich_truc_ky').update({trang_thai:'cong_bo',ngay_ky:iso(new Date())}).eq('id',ky.id);
      if(error)return $('#loi').textContent=error.message;ky.trang_thai='cong_bo';toast('Đã công bố');ve();
    };
  };
  dung();
}

// ----- xem (chỉ đọc) -----
async function xem(ky){
  const m=await taiKy(ky);
  A().$('#nd').innerHTML=`<button class="sec" id="lui">← Quay lại</button><div class="card" style="margin-top:10px"><h3>${dm(ky.tu_ngay)} – ${dm(ky.den_ngay)}</h3><button class="sec" id="in">In / lưu PDF</button></div>`+
   days(ky.tu_ngay,ky.den_ngay).map(n=>`<div class="card"><h3>${TH[pd(n).getDay()]} ${dm(n)}</h3>${VT.filter(v=>v.nhom==='truc').map(v=>{const l=[0,1,2].map(i=>m[`${n}|${v.id}|${i}`]).filter(Boolean).map(nm).join(', ');return l?`<div class="row" style="justify-content:space-between"><span class="mut">${A().esc(v.ten)}</span><span>${A().esc(l)}</span></div>`:''}).join('')}</div>`).join('');
  $('#lui').onclick=ve;$('#in').onclick=()=>inLich(ky,m);
}

// ----- in đúng mẫu -----
function inLich(ky,m){
  const ds=days(ky.tu_ngay,ky.den_ngay),cols=VT.filter(v=>v.nhom==='truc');
  const cell=(n,v)=>[0,1,2].map(i=>m[`${n}|${v.id}|${i}`]).filter(Boolean).map((id,i)=>NHOM[v.id]&&i===0?`<b>${nm(id)}</b>`:nm(id)).join('<br>');
  const cb=VT.filter(v=>v.nhom==='cbvc');
  const rows=ds.map((n,i)=>(i&&i%7===0?`<tr class="sp"><td colspan="${2+cols.length}"></td></tr>`:'')+`<tr><td>${TH[pd(n).getDay()]==='CN'?'CN':TH[pd(n).getDay()]}</td><td>${dm(n)}</td>${cols.map(v=>`<td>${cell(n,v)}</td>`).join('')}</tr>`).join('');
  const cbr=ds.filter(n=>[0,6].includes(pd(n).getDay())).map(n=>`<tr><td>${TH[pd(n).getDay()]}</td><td>${dm(n)}</td>${cb.map(v=>`<td>${cell(n,v)}</td>`).join('')}</tr>`).join('');
  const w=window.open('','_blank');if(!w)return A().toast('Trình duyệt chặn cửa sổ in');
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Lịch trực ${dm(ky.tu_ngay)}-${dm(ky.den_ngay)}</title><style>
  @page{size:A4;margin:10mm}body{font:12px 'Times New Roman',serif;color:#000}table{border-collapse:collapse;width:100%}td,th{border:1px solid #000;padding:3px 4px;text-align:center;font-size:11px}.h{border:0;font-size:12px}.sp td{border:0;height:10px}h2{text-align:center;margin:10px 0}
  .t{display:flex;justify-content:space-between;text-align:center;font-weight:bold}</style>
  <div class="t"><div>CÔNG TY TNHH MTV CAO SU DẦU TIẾNG<br>BỆNH VIỆN ĐA KHOA CAO SU DẦU TIẾNG</div><div>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br>Độc lập - Tự do - Hạnh phúc</div></div>
  <h2>LỊCH TRỰC TUẦN BỆNH VIỆN TỪ NGÀY ${dm(ky.tu_ngay)}/${pd(ky.tu_ngay).getFullYear()} ĐẾN NGÀY ${dm(ky.den_ngay)}/${pd(ky.den_ngay).getFullYear()}</h2>
  <table><tr><th>Thứ</th><th>Ngày</th>${cols.map(v=>`<th>${v.ten}</th>`).join('')}</tr>${rows}</table>
  <p><b>* CBVC LÀM NGÀY:</b></p><table style="width:60%"><tr><th>Thứ</th><th>Ngày</th>${cb.map(v=>`<th>${v.ten}</th>`).join('')}</tr>${cbr}</table>
  <div class="t" style="margin-top:20px;justify-content:flex-end"><div>TP. Hồ Chí Minh, ngày ... tháng ... năm ${pd(ky.tu_ngay).getFullYear()}<br>GIÁM ĐỐC</div></div>
  <script>setTimeout(()=>print(),300)<\/script>`);w.document.close();
}
window.LICH={ve};
})();
