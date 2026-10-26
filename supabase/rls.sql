-- =============================================================
-- Dapur Parto — kunci database: hanya user yang sudah login
-- Jalankan SETELAH versi app/web dengan login sudah online.
-- Supabase Dashboard → SQL Editor → paste → Run
-- =============================================================

do $$
declare t text;
begin
  foreach t in array array['products','addons','channels','orders','stock_log','sugar_levels','shop_info']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "staff_full_access" on public.%I', t);
    execute format(
      'create policy "staff_full_access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Cek hasil: semua tabel harus rowsecurity = true
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('products','addons','channels','orders','stock_log','sugar_levels','shop_info');
