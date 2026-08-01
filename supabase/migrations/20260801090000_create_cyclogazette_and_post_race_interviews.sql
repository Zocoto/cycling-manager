begin;

create table public.post_race_interviews (
  id uuid primary key default gen_random_uuid(),
  race_edition_id uuid not null references public.race_editions(id) on delete cascade,
  stage_id uuid not null references public.stages(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  question_set jsonb not null,
  answers jsonb not null default '[]'::jsonb,
  closing_note text,
  context jsonb not null,
  status text not null default 'pending',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_race_interviews_one_per_team_stage unique (stage_id, team_id),
  constraint post_race_interviews_status_allowed check (status in ('pending', 'submitted')),
  constraint post_race_interviews_questions_array check (jsonb_typeof(question_set) = 'array'),
  constraint post_race_interviews_answers_array check (jsonb_typeof(answers) = 'array'),
  constraint post_race_interviews_context_object check (jsonb_typeof(context) = 'object'),
  constraint post_race_interviews_closing_note_length check (char_length(coalesce(closing_note, '')) <= 500)
);

create index post_race_interviews_director_idx
  on public.post_race_interviews (sporting_director_id, created_at desc);
create index post_race_interviews_submitted_idx
  on public.post_race_interviews (submitted_at desc)
  where status = 'submitted';

alter table public.post_race_interviews enable row level security;

create policy post_race_interviews_read_own
on public.post_race_interviews
for select
to authenticated
using (
  exists (
    select 1
    from public.sporting_directors director
    where director.id = post_race_interviews.sporting_director_id
      and director.auth_user_id = auth.uid()
  )
);

grant select on table public.post_race_interviews to authenticated;
grant all privileges on table public.post_race_interviews to service_role;

create table public.cyclogazette_editions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  season_day_id uuid not null references public.season_days(id) on delete cascade,
  issue_number integer not null check (issue_number > 0),
  title text not null default 'La Cyclogazette',
  subtitle text not null,
  issue_date date not null,
  content jsonb not null,
  published_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cyclogazette_one_issue_per_game_day unique (season_day_id),
  constraint cyclogazette_content_object check (jsonb_typeof(content) = 'object')
);

create index cyclogazette_editions_publication_idx
  on public.cyclogazette_editions (published_at desc);

alter table public.cyclogazette_editions enable row level security;

create policy cyclogazette_editions_read_authenticated
on public.cyclogazette_editions
for select
to authenticated
using (true);

grant select on table public.cyclogazette_editions to authenticated;
grant all privileges on table public.cyclogazette_editions to service_role;

comment on table public.post_race_interviews is
  'Questions contextuelles et reactions des directeurs sportifs apres chaque course.';
comment on table public.cyclogazette_editions is
  'Instantane quotidien publie a 20 h sous le titre La Cyclogazette.';

commit;
