-- Studycore schema: question bank with answer keys kept on the server,
-- per-viewer progress and question reports.
--
-- Viewers sign in anonymously (Supabase anonymous sign-ins): each browser gets
-- a private user id with no email or name. Row level security limits every
-- viewer to their own progress and reports.

-- Questions: what a learner sees before answering. Readable by everyone.
create table public.questions (
  course   text     not null,
  id       text     not null,
  version  integer  not null check (version >= 1),
  domain   text     not null,
  lesson   text,
  stem     text     not null,
  options  jsonb    not null check (jsonb_typeof(options) = 'array'),
  pick     smallint not null check (pick between 1 and 3), -- how many options to choose
  primary key (course, id)
);

-- Answer keys: never readable from the browser. Only check_answers() and the
-- service role (used by the content sync script) can read them.
create table public.question_keys (
  course       text       not null,
  id           text       not null,
  answer       smallint[] not null,
  explanation  text       not null,
  sources      text[]     not null,
  primary key (course, id),
  foreign key (course, id) references public.questions (course, id) on delete cascade
);

alter table public.questions enable row level security;
alter table public.question_keys enable row level security;

create policy "Questions are readable by everyone"
  on public.questions for select
  to anon, authenticated
  using (true);

-- No policies on question_keys, and no table privileges either.
revoke all on public.question_keys from anon, authenticated;
revoke insert, update, delete, truncate on public.questions from anon, authenticated;

-- Checks a set of answers. p_picks maps question id to the chosen option
-- indexes, for example {"q001": [0], "q037": [0, 1]}. Returns, per question,
-- whether it was right plus the answer, explanation and sources.
create function public.check_answers(p_course text, p_picks jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k.id, jsonb_build_object(
    'correct', coalesce((
      select array_agg(x::smallint order by x::smallint)
      from jsonb_array_elements_text(p_picks -> k.id) as x
    ) = (
      select array_agg(a order by a) from unnest(k.answer) as a
    ), false),
    'answer', to_jsonb(k.answer),
    'explanation', k.explanation,
    'sources', to_jsonb(k.sources)
  )), '{}'::jsonb)
  from public.question_keys as k
  where k.course = p_course
    and jsonb_typeof(p_picks) = 'object'
    and p_picks ? k.id;
$$;

revoke execute on function public.check_answers(text, jsonb) from public;
grant execute on function public.check_answers(text, jsonb) to anon, authenticated;

-- Progress: one row per viewer per course, holding the app's state object.
create table public.progress (
  viewer      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  course      text        not null,
  data        jsonb       not null check (pg_column_size(data) < 262144),
  updated_at  timestamptz not null default now(),
  primary key (viewer, course)
);

alter table public.progress enable row level security;

create policy "Viewers read their own progress"
  on public.progress for select
  to authenticated
  using ((select auth.uid()) = viewer);

create policy "Viewers create their own progress"
  on public.progress for insert
  to authenticated
  with check ((select auth.uid()) = viewer);

create policy "Viewers update their own progress"
  on public.progress for update
  to authenticated
  using ((select auth.uid()) = viewer)
  with check ((select auth.uid()) = viewer);

-- Question reports from "Report a problem". Viewers can file them but not read
-- them back; the project owner reviews them in the dashboard.
create table public.reports (
  id          bigint      generated always as identity primary key,
  viewer      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  course      text        not null,
  qid         text,
  q_version   integer,
  reason      text        not null check (reason in ('wrong-answer', 'unclear', 'off-exam', 'outdated', 'other')),
  comment     text        check (char_length(comment) <= 600),
  build       text,
  created_at  timestamptz not null default now()
);

create index reports_course_qid_idx on public.reports (course, qid);
create index reports_viewer_idx on public.reports (viewer);

alter table public.reports enable row level security;

create policy "Viewers file their own reports"
  on public.reports for insert
  to authenticated
  with check ((select auth.uid()) = viewer);
