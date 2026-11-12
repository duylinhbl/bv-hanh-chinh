-- Báo cáo công tác tuần tự động (Edge Function bao-cao-tuan)
create table if not exists public.bc_tuan_log (
  id bigint generated always as identity primary key,
  luc timestamptz not null default now(),
  tu date not null,            -- thứ 2 của tuần báo cáo
  nguon text,                  -- cron | quan tri
  ok boolean not null,
  dry boolean not null default false,
  so_viec int,
  loi text
);
alter table public.bc_tuan_log enable row level security;
revoke all on public.bc_tuan_log from anon, authenticated;   -- chỉ Edge Function (service role) đọc/ghi
create index if not exists bc_tuan_log_tu on public.bc_tuan_log(tu) where ok and not dry;

-- 15:00 giờ VN thứ 5 = 08:00 UTC thứ 5; thử lại 15:30 nếu lần đầu lỗi (hàm tự bỏ qua nếu tuần này đã gửi xong)
select cron.unschedule(jobname) from cron.job where jobname in ('bao-cao-tuan','bao-cao-tuan-thu-lai');
select cron.schedule('bao-cao-tuan', '0 8 * * 4', $$select net.http_post(url:='https://fndqxqwgnvrkuzogashv.supabase.co/functions/v1/bao-cao-tuan', headers:=jsonb_build_object('Content-Type','application/json','x-push-key',(select v from public.bi_mat where k='push_key')), body:='{}'::jsonb, timeout_milliseconds:=120000)$$);
select cron.schedule('bao-cao-tuan-thu-lai', '30 8 * * 4', $$select net.http_post(url:='https://fndqxqwgnvrkuzogashv.supabase.co/functions/v1/bao-cao-tuan', headers:=jsonb_build_object('Content-Type','application/json','x-push-key',(select v from public.bi_mat where k='push_key')), body:='{}'::jsonb, timeout_milliseconds:=120000)$$);
