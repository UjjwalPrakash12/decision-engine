alter table public.profiles
add column if not exists data_source_preference text
check (data_source_preference in ('supabase', 'csv', 'sample'));
