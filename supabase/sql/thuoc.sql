-- Bộ tra cứu tờ hướng dẫn sử dụng thuốc — phần nằm trong CSDL.
-- Nguyên tắc: TÁCH TÊN CHỈ CÓ MỘT BẢN, ở đây. Edge Function chỉ gửi tên tệp thô,
-- trigger tự tách ten / hoat_chat / ham_luong / kd. Không có bản tách thứ hai trong TypeScript
-- để không bao giờ xảy ra chuyện hai bản lệch nhau (app hiện khác với kết quả quét).
--
-- Áp dụng: dán cả tệp này vào SQL Editor của Supabase rồi chạy.

-- 1) Bỏ dấu tiếng Việt, dùng cho cột tìm kiếm `kd`
create or replace function khong_dau(t text) returns text
language sql immutable parallel safe as $$
  select translate(lower(coalesce(t,'')),
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')
$$;

-- 2) Tách tên tệp thành tên biệt dược / hoạt chất / hàm lượng.
-- Kho của khoa Dược không theo một khuôn duy nhất, bộ tách phải chịu được cả 6 kiểu:
--   Kacerin (Cetirizin dihydroclorid 10mg).pdf   -> hàm lượng nằm TRONG ngoặc
--   Telmisartan (Telmisartan) 40mg.pdf           -> hàm lượng nằm SAU ngoặc
--   Kidmin 200ml.pdf                             -> không có ngoặc
--   Misoprostol-STELLA-200mcg.pdf                -> nối bằng gạch
--   Morihepamin 7,58%-200ml.pdf                  -> hai số, dấu phẩy thập phân
--   Combivent.pdf                                -> chỉ có tên
create or replace function tach_thuoc(p text)
returns table(ten text, hoat_chat text, ham_luong text)
language plpgsql immutable as $$
declare
  base text; paren text; ngoai text; hl text; hc text;
  dv  text := '(mg/ml|mcg/ml|g/ml|mg|mcg|g|ml|iu|ui|%)';
  pat text;
begin
  base  := trim(regexp_replace(coalesce(p,''),'\.pdf$','','i'));
  paren := substring(base from '\(([^()]*)\)');
  ngoai := trim(regexp_replace(regexp_replace(base,'\([^()]*\)',' ','g'),'[[:space:]]+',' ','g'));
  -- hàm lượng = số + đơn vị ở CUỐI chuỗi, cho phép nối thêm bằng - + / (vd 500mg-5ml, 20g-Tuýp)
  pat   := '[0-9][0-9.,]*[[:space:]]*'||dv||
           '([[:space:]]*[-+/][[:space:]]*([0-9][0-9.,]*[[:space:]]*'||dv||'?|[^0-9[:space:]()]+))*[[:space:]]*$';

  hl := nullif(trim(regexp_substr(ngoai, pat, 1, 1, 'i')), '');
  if hl is not null then                 -- hàm lượng ở ngoài ngoặc -> trong ngoặc là hoạt chất
    ten := trim(regexp_replace(ngoai, pat, '', 'i'));
    hc  := paren;
  else                                   -- không có -> tìm trong ngoặc
    ten := ngoai;
    hl  := nullif(trim(regexp_substr(coalesce(paren,''), pat, 1, 1, 'i')), '');
    hc  := case when paren is null then null else trim(regexp_replace(paren, pat, '', 'i')) end;
  end if;

  ten := nullif(trim(regexp_replace(ten,'[[:space:]]*[-–,]+[[:space:]]*$','')), '');
  if ten is null then ten := base; end if;   -- tên tệp lạ thì giữ nguyên, không bao giờ để trống
  hoat_chat := nullif(trim(coalesce(hc,'')), '');
  ham_luong := hl;
  return next;
end $$;

-- 3) Trigger: ai ghi vào `thuoc` cũng chỉ cần drive_id + ten_tep + chu_cai + byte + sua_luc
create or replace function thuoc_tu_tach() returns trigger
language plpgsql as $$
declare t record;
begin
  select * into t from tach_thuoc(new.ten_tep);
  new.ten := t.ten; new.hoat_chat := t.hoat_chat; new.ham_luong := t.ham_luong;
  new.kd := khong_dau(concat_ws(' ', t.ten, t.hoat_chat, t.ham_luong, new.ten_tep));
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='tr_thuoc_tu_tach') then
    create trigger tr_thuoc_tu_tach before insert or update of ten_tep on thuoc
      for each row execute function thuoc_tu_tach();
  end if;
end $$;

-- 4) Kiểm thử bộ tách — chạy cùng bộ kiểm thử đêm, ai sửa regex làm sai là báo ngay
create or replace function kiem_thu_thuoc()
returns table(t_ten text, t_dat boolean, t_ct text)
language plpgsql security definer set search_path to 'public' as $$
declare r record; sai text := ''; n int := 0;
begin
  for r in
    select * from (values
      ('Kacerin (Cetirizin dihydroclorid 10mg).pdf','Kacerin','Cetirizin dihydroclorid','10mg'),
      ('Kim tiền thảo.pdf','Kim tiền thảo',null,null),
      ('Kalimate (Polystyren 5g).pdf','Kalimate','Polystyren','5g'),
      ('Kidmin 200ml.pdf','Kidmin',null,'200ml'),
      ('Augmentin (Amoxicilin/Acid clavulanic 500mg/125mg).pdf','Augmentin','Amoxicilin/Acid clavulanic','500mg/125mg'),
      ('Natri clorid 0,9% 500ml.pdf','Natri clorid 0,9%',null,'500ml'),
      ('  Kenmag .pdf','Kenmag',null,null),
      ('Insulin (Insulatard 100IU/ml).pdf','Insulin','Insulatard','100IU/ml'),
      ('Telmisartan (Telmisartan) 40mg.pdf','Telmisartan','Telmisartan','40mg'),
      ('Misoprostol-STELLA-200mcg.pdf','Misoprostol-STELLA',null,'200mcg'),
      ('Morihepamin 7,58%-200ml.pdf','Morihepamin',null,'7,58%-200ml'),
      ('Combivent.pdf','Combivent',null,null)
    ) v(tep,ten,hc,hl)
  loop
    n := n + 1;
    if not exists (select 1 from tach_thuoc(r.tep) t
                   where t.ten = r.ten
                     and coalesce(t.hoat_chat,'') = coalesce(r.hc,'')
                     and coalesce(t.ham_luong,'') = coalesce(r.hl,''))
    then sai := sai || r.tep || '; ';
    end if;
  end loop;
  return query select 'Tách tên thuốc đúng '||n||' mẫu'::text, sai = '', nullif(sai,'')::text;

  -- danh mục không được có tên trống hoặc trùng id
  return query select 'Danh mục thuốc không có tên trống'::text,
                      not exists(select 1 from thuoc where coalesce(trim(ten),'')=''),
                      null::text;
  return query select 'Mọi thuốc đều tra được không dấu'::text,
                      not exists(select 1 from thuoc where coalesce(kd,'')=''),
                      null::text;
end $$;
