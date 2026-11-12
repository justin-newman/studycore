-- Reading questions and checking answers needs a session (an anonymous sign-in
-- is enough). Supabase rate-limits anonymous sign-ins per IP, which slows bulk scraping.
alter policy "Questions are readable by everyone" on public.questions
  rename to "Questions are readable with a session";

alter policy "Questions are readable with a session" on public.questions
  to authenticated;

revoke select on public.questions from anon;
revoke execute on function public.check_answers(text, jsonb) from anon;
