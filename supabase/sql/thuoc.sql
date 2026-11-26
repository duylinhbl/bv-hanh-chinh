-- Tra cứu thuốc bệnh viện — phần nằm trong CSDL.
--
-- Nguyên tắc: app KHÔNG tự sinh mã ICD-10 cho thuốc. Gắn sai mã thì hoặc bác sĩ kê sai chỉ định,
-- hoặc BHXH xuất toán. Mỗi mã phải do người của khoa Dược / phòng KHTH chọn từ danh mục chuẩn,
-- và lưu kèm tên người gắn + ngày gắn + trạng thái duyệt.
--
-- Áp dụng: dán cả tệp này vào SQL Editor của Supabase rồi chạy.

-- 1) Bỏ dấu tiếng Việt, dùng cho cột tìm kiếm `kd`
create or replace function khong_dau(t text) returns text
language sql immutable parallel safe as $$
  select translate(lower(coalesce(t,'')),
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')
$$;

-- 2) Danh mục thuốc bệnh viện (nguồn: báo cáo DUC034 của khoa Dược)
create table if not exists dm_thuoc(
  id          bigint generated always as identity primary key,
  ma_bc       text not null,          -- mã nội viện
  ma_atc      text,
  ma_byt      text,
  ten         text not null,
  hoat_chat   text,
  ham_luong   text,
  dvt         text,
  don_gia     numeric,
  don_gia_min numeric,
  nhom        text,                   -- TÂN DƯỢC / GÂY NGHIỆN / HƯỚNG THẦN
  atc_nhom    text,                   -- nhóm dược lý suy từ KÝ TỰ ĐẦU mã ATC (bậc 1, tra bảng cố định)
  ghi_chu     text,
  hoat_dong   boolean not null default true,
  kd          text,
  nguon       text,
  cap_nhat    timestamptz not null default now(),
  unique (ma_bc, ten, ham_luong, dvt)
);
alter table dm_thuoc enable row level security;
revoke insert, update, delete, truncate on table dm_thuoc from anon;

-- 3) Danh mục mã bệnh ICD-10 chuẩn (nạp từ TT 06/2026)
create table if not exists icd10(
  ma text primary key, ten text not null, chuong text, kd text
);
alter table icd10 enable row level security;
revoke insert, update, delete, truncate on table icd10 from anon;

-- 4) Mã ICD-10 mà một thuốc được BHYT thanh toán
create table if not exists thuoc_icd(
  id          bigint generated always as identity primary key,
  thuoc_id    bigint not null references dm_thuoc(id) on delete cascade,
  ma_icd      text not null,
  chi_dinh    text,
  nguon       text not null default 'khoa Dược',
  nguoi_gan   uuid references nguoi_dung(id),
  gan_luc     timestamptz not null default now(),
  duyet       boolean not null default false,
  nguoi_duyet uuid references nguoi_dung(id),
  duyet_luc   timestamptz,
  unique (thuoc_id, ma_icd)
);
alter table thuoc_icd enable row level security;
revoke insert, update, delete, truncate on table thuoc_icd from anon;

-- 5) Ai được gắn mã: quản trị, BGĐ, khoa Dược, phòng KHTH
create or replace function duoc_gan_icd() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select nd.la_quan_tri
                        or nd.vai_tro = 'bgd'
                        or kp.ten in ('KHOA DƯỢC','PHÒNG KHTH')
                   from nd_hien_tai() nd left join khoa_phong kp on kp.id = nd.khoa_phong_id), false)
$$;
grant execute on function duoc_gan_icd() to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='dm_thuoc' and policyname='dm_thuoc_xem') then
    create policy dm_thuoc_xem on dm_thuoc for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policies where tablename='dm_thuoc' and policyname='dm_thuoc_sua') then
    create policy dm_thuoc_sua on dm_thuoc for update to authenticated using (duoc_gan_icd()) with check (duoc_gan_icd()); end if;
  if not exists (select 1 from pg_policies where tablename='icd10' and policyname='icd10_xem') then
    create policy icd10_xem on icd10 for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policies where tablename='thuoc_icd' and policyname='thuoc_icd_xem') then
    create policy thuoc_icd_xem on thuoc_icd for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policies where tablename='thuoc_icd' and policyname='thuoc_icd_them') then
    create policy thuoc_icd_them on thuoc_icd for insert to authenticated with check (duoc_gan_icd()); end if;
  if not exists (select 1 from pg_policies where tablename='thuoc_icd' and policyname='thuoc_icd_sua') then
    create policy thuoc_icd_sua on thuoc_icd for update to authenticated using (duoc_gan_icd()) with check (duoc_gan_icd()); end if;
  if not exists (select 1 from pg_policies where tablename='thuoc_icd' and policyname='thuoc_icd_go') then
    create policy thuoc_icd_go on thuoc_icd for delete to authenticated using (duoc_gan_icd()); end if;
end $$;

-- 6) Kiểm thử, chạy cùng bộ kiểm thử đêm qua kiem_thu_va_bao()
create or replace function kiem_thu_thuoc()
returns table(t_ten text, t_dat boolean, t_ct text)
language plpgsql security definer set search_path to 'public' as $$
begin
  return query select 'T1. Mọi thuốc đều tra được không dấu'::text,
    not exists(select 1 from dm_thuoc where coalesce(kd,'')=''),
    (select string_agg(ten,'; ') from (select ten from dm_thuoc where coalesce(kd,'')='' limit 5) z);

  -- toàn vẹn: không cho tồn tại mã ICD lạ, không có trong danh mục chuẩn
  return query select 'T2. Mã ICD gắn cho thuốc đều có trong danh mục chuẩn'::text,
    not exists(select 1 from thuoc_icd x where not exists(select 1 from icd10 i where i.ma=x.ma_icd)),
    (select string_agg(distinct x.ma_icd,'; ') from thuoc_icd x
      where not exists(select 1 from icd10 i where i.ma=x.ma_icd));

  -- trách nhiệm: mã nào cũng phải truy được ai gắn
  return query select 'T3. Mã ICD nào cũng biết ai gắn'::text,
    not exists(select 1 from thuoc_icd where nguoi_gan is null),
    (select count(*)::text||' dòng không rõ người gắn' from thuoc_icd where nguoi_gan is null);

  return query select 'T4. Thuốc gây nghiện/hướng thần còn trong danh mục'::text,
    exists(select 1 from dm_thuoc where nhom in ('THUỐC GÂY NGHIỆN','THUỐC HƯỚNG THẦN')),
    (select count(*)::text||' thuốc' from dm_thuoc where nhom in ('THUỐC GÂY NGHIỆN','THUỐC HƯỚNG THẦN'));

  return query select 'T5. Danh mục thuốc không rỗng'::text,
    (select count(*) from dm_thuoc) > 0,
    (select count(*)::text||' thuốc' from dm_thuoc);
end $$;
