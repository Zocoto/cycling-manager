begin;

create table public.post_race_news_events (
  id text primary key,
  race_edition_id uuid not null
    references public.race_editions(id) on delete cascade,
  stage_id uuid not null
    references public.stages(id) on delete cascade,
  event_kind text not null,
  title text not null,
  detail text not null,
  featured_rider_id uuid references public.riders(id) on delete set null,
  featured_team_id uuid references public.teams(id) on delete set null,
  happened_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_race_news_events_id_not_empty check (btrim(id) <> ''),
  constraint post_race_news_events_kind_allowed check (
    event_kind in ('breakaway', 'incident', 'classification')
  ),
  constraint post_race_news_events_title_not_empty check (btrim(title) <> ''),
  constraint post_race_news_events_detail_not_empty check (btrim(detail) <> '')
);

create index post_race_news_events_happened_at_idx
  on public.post_race_news_events (happened_at desc);

create index post_race_news_events_stage_idx
  on public.post_race_news_events (stage_id);

alter table public.post_race_news_events enable row level security;

create policy post_race_news_events_read_public
on public.post_race_news_events
for select
to anon, authenticated
using (true);

grant select on table public.post_race_news_events to anon, authenticated;
grant all privileges on table public.post_race_news_events to service_role;

comment on table public.post_race_news_events is
  'Resumes des faits marquants publies dans En direct du peloton uniquement apres homologation des resultats.';

commit;
