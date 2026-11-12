-- Row level security already blocks these; trimming the default grants is a second layer.
-- Progress: a viewer reads, creates and updates their own row. Reports: a viewer only files them.
revoke all on public.progress from anon;
revoke all on public.reports from anon;
revoke delete, truncate, references, trigger on public.progress from authenticated;
revoke select, update, delete, truncate, references, trigger on public.reports from authenticated;
