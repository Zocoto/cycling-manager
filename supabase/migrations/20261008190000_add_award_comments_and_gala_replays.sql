begin;

create table public.season_award_comments (
  season_award_id uuid primary key
    references public.season_awards(id) on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete restrict,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint season_award_comments_message_valid check (
    message = btrim(message)
    and char_length(message) between 1 and 500
  )
);

alter table public.season_award_comments enable row level security;

revoke all on table public.season_award_comments
  from public, anon, authenticated;
grant all privileges on table public.season_award_comments to service_role;

create or replace function public.get_season_award_comment_context()
returns table (
  award_id uuid,
  winner_comment text,
  can_comment boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer_director as (
    select director.id
    from public.sporting_directors as director
    where director.auth_user_id = auth.uid()
      and director.status = 'active'
    limit 1
  )
  select
    award.id,
    comment.message,
    coalesce(
      award.sporting_director_id = viewer_director.id
      or exists (
        select 1
        from public.team_manager_assignments as assignment
        join public.seasons as award_season
          on award_season.id = award.season_id
        join public.seasons as start_season
          on start_season.id = assignment.start_season_id
        left join public.seasons as end_season
          on end_season.id = assignment.end_season_id
        where assignment.sporting_director_id = viewer_director.id
          and assignment.team_id = award.team_id
          and assignment.role = 'general_manager'
          and award_season.game_year >= start_season.game_year
          and (
            end_season.game_year is null
            or award_season.game_year <= end_season.game_year
          )
      ),
      false
    ) as can_comment
  from public.season_awards as award
  left join public.season_award_comments as comment
    on comment.season_award_id = award.id
  left join viewer_director on true;
$$;

create or replace function public.upsert_current_season_award_comment(
  p_award_id uuid,
  p_message text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_message text := btrim(coalesce(p_message, ''));
  v_can_comment boolean := false;
begin
  select director.id
  into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_director_id is null then
    raise exception 'Directeur Sportif authentifie introuvable.';
  end if;

  select
    award.sporting_director_id = v_director_id
    or exists (
      select 1
      from public.team_manager_assignments as assignment
      join public.seasons as award_season
        on award_season.id = award.season_id
      join public.seasons as start_season
        on start_season.id = assignment.start_season_id
      left join public.seasons as end_season
        on end_season.id = assignment.end_season_id
      where assignment.sporting_director_id = v_director_id
        and assignment.team_id = award.team_id
        and assignment.role = 'general_manager'
        and award_season.game_year >= start_season.game_year
        and (
          end_season.game_year is null
          or award_season.game_year <= end_season.game_year
        )
    )
  into v_can_comment
  from public.season_awards as award
  where award.id = p_award_id;

  if not coalesce(v_can_comment, false) then
    raise exception 'Seul le laureat de cet award peut commenter.';
  end if;

  if v_message = '' then
    delete from public.season_award_comments
    where season_award_id = p_award_id;
    return null;
  end if;

  if char_length(v_message) > 500 then
    raise exception 'Le commentaire est limite a 500 caracteres.';
  end if;

  insert into public.season_award_comments (
    season_award_id,
    sporting_director_id,
    message
  )
  values (
    p_award_id,
    v_director_id,
    v_message
  )
  on conflict (season_award_id) do update
  set
    sporting_director_id = excluded.sporting_director_id,
    message = excluded.message,
    updated_at = now();

  return v_message;
end;
$$;

revoke all on function public.get_season_award_comment_context()
  from public, anon;
revoke all on function public.upsert_current_season_award_comment(uuid, text)
  from public, anon;
grant execute on function public.get_season_award_comment_context()
  to authenticated;
grant execute on function public.upsert_current_season_award_comment(uuid, text)
  to authenticated;

create table public.pcm_gala_group_replays (
  id uuid primary key default gen_random_uuid(),
  gala_event_id uuid not null
    references public.pcm_gala_events(id) on delete cascade,
  group_number smallint not null check (group_number > 0),
  youtube_video_id text not null,
  winner_rider_id uuid not null
    references public.riders(id) on delete restrict,
  winner_team_id uuid not null
    references public.teams(id) on delete restrict,
  winner_rider_name text not null,
  winner_team_name text not null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pcm_gala_group_replays_video_id_valid check (
    youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'
  ),
  constraint pcm_gala_group_replays_winner_name_valid check (
    winner_rider_name = btrim(winner_rider_name)
    and winner_rider_name <> ''
    and winner_team_name = btrim(winner_team_name)
    and winner_team_name <> ''
  ),
  unique (gala_event_id, group_number)
);

create index pcm_gala_group_replays_published_idx
  on public.pcm_gala_group_replays (gala_event_id, published_at, group_number);

alter table public.pcm_gala_group_replays enable row level security;

create policy pcm_gala_group_replays_select_published
  on public.pcm_gala_group_replays
  for select
  to authenticated
  using (published_at <= now());

revoke all on table public.pcm_gala_group_replays
  from public, anon, authenticated;
grant select on table public.pcm_gala_group_replays to authenticated;
grant all privileges on table public.pcm_gala_group_replays to service_role;

comment on table public.season_award_comments is
  'Mot signe par le DS laureat ou le DS de l equipe laureate, un seul par award.';
comment on function public.upsert_current_season_award_comment(uuid, text) is
  'Publie, modifie ou retire le mot du laureat apres verification historique de son equipe.';
comment on table public.pcm_gala_group_replays is
  'Replays officiels du gala, publies uniquement avec le vrai vainqueur de chaque groupe.';

notify pgrst, 'reload schema';

commit;
