begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

alter table public.national_federation_hosting_awards
  add column economics_version smallint not null default 1 check (economics_version in (1, 2));

create table private.federation_hosting_result_publications (
  award_id uuid not null references public.national_federation_hosting_awards(id) on delete cascade,
  edition_id uuid not null,
  is_junior boolean not null,
  completed_at timestamptz not null default clock_timestamp(),
  primary key (award_id, edition_id, is_junior),
  unique (is_junior, edition_id)
);

create table private.federation_hosting_result_readers (
  award_id uuid not null references public.national_federation_hosting_awards(id) on delete cascade,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  first_viewed_at timestamptz not null,
  primary key (award_id, sporting_director_id)
);

alter table private.federation_hosting_result_publications enable row level security;
alter table private.federation_hosting_result_readers enable row level security;
revoke all on private.federation_hosting_result_publications, private.federation_hosting_result_readers
  from public, anon, authenticated, service_role;

-- Runs once per official completed edition. Replaying a race must never open a new window.
create function private.record_federation_hosting_result_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_junior boolean := tg_table_name = 'development_race_editions';
begin
  insert into private.federation_hosting_result_publications (award_id, edition_id, is_junior)
  select award.id, new.id, v_is_junior
  from public.seasons season
  join public.national_federation_hosting_decisions decision
    on decision.target_game_year = season.game_year
    and decision.decision = 'hosted'
    and decision.country_id = new.host_country_id
  join public.national_federation_hosting_awards award
    on award.id = decision.award_id and award.status = 'scheduled' and award.economics_version = 2
  where season.id = new.season_id and season.game_year >= 6
    and exists (
      select 1 from private.get_federation_hosting_editions(season.id, award.event_type, award.continent_code) edition
      where edition.edition_id = new.id and edition.is_junior = v_is_junior
    )
  on conflict (is_junior, edition_id) do nothing;
  return new;
end;
$$;

revoke all on function private.record_federation_hosting_result_publication()
  from public, anon, authenticated, service_role;

create trigger track_federation_hosting_pro_result_publication
  after update of status on public.race_editions
  for each row when (new.status = 'completed' and old.status is distinct from 'completed'
    and new.host_country_id is not null and not new.is_neutral_host)
  execute function private.record_federation_hosting_result_publication();

create trigger track_federation_hosting_junior_result_publication
  after update of status on public.development_race_editions
  for each row when (new.status = 'completed' and old.status is distinct from 'completed'
    and new.host_country_id is not null and not new.is_neutral_host)
  execute function private.record_federation_hosting_result_publication();

create function private.get_federation_hosting_revenue_window(p_award_id uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(publication.completed_at) filter (where edition.edition_status = 'completed') + interval '72 hours'
  from public.national_federation_hosting_awards award
  join public.seasons season on season.game_year = award.target_game_year
  cross join lateral private.get_federation_hosting_editions(season.id, award.event_type, award.continent_code) edition
  left join private.federation_hosting_result_publications publication
    on publication.award_id = award.id and publication.edition_id = edition.edition_id
    and publication.is_junior = edition.is_junior
  where award.id = p_award_id and award.target_game_year >= 6 and award.economics_version = 2
  group by award.scheduled_edition_count
  having count(*) = award.scheduled_edition_count
    and bool_and(edition.edition_status in ('completed', 'cancelled'))
    and bool_and(edition.edition_status <> 'completed' or publication.completed_at is not null);
$$;

create function private.get_federation_hosting_unique_readers(p_award_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from private.federation_hosting_result_readers reader
  where reader.award_id = p_award_id;
$$;

revoke all on function private.get_federation_hosting_revenue_window(uuid),
  private.get_federation_hosting_unique_readers(uuid) from public, anon, authenticated, service_role;

create function public.record_current_federation_hosting_result_view(p_edition_id uuid, p_is_junior boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '3s'
set lock_timeout = '500ms'
as $$
declare
  v_award_id uuid;
  v_director_id uuid;
  v_window_ends_at timestamptz;
  v_viewed_at timestamptz;
begin
  if (select auth.jwt() ->> 'is_anonymous') = 'true' then return false; end if;

  select publication.award_id into v_award_id
  from private.federation_hosting_result_publications publication
  join public.national_federation_hosting_awards award on award.id = publication.award_id and award.status = 'scheduled'
    and award.economics_version = 2
  where publication.edition_id = p_edition_id and publication.is_junior = p_is_junior;
  if not found then return false; end if;

  select director.id into v_director_id
  from public.sporting_directors director
  where director.auth_user_id = (select auth.uid()) and director.status = 'active'
    and not exists (select 1 from public.alpha_bot_managers bot where bot.sporting_director_id = director.id);
  if not found then return false; end if;

  if exists (
    select 1 from private.federation_hosting_result_readers reader
    where reader.award_id = v_award_id and reader.sporting_director_id = v_director_id
  ) then return true; end if;

  v_window_ends_at := private.get_federation_hosting_revenue_window(v_award_id);
  if v_window_ends_at is null or clock_timestamp() >= v_window_ends_at then return false; end if;

  if p_is_junior then
    if not exists (
      select 1
      from public.development_race_editions edition
      join public.development_race_results result on result.race_edition_id = edition.id
      where edition.id = p_edition_id and edition.status = 'completed' and result.result_scope = 'general'
    ) then return false; end if;
  elsif not exists (
    select 1
    from public.race_editions edition
    join public.race_results result on result.race_edition_id = edition.id
    where edition.id = p_edition_id and edition.status = 'completed' and result.status = 'classified'
  ) then return false;
  end if;

  -- Settlement locks the award before counting. Keep an in-flight read at the deadline consistent with it.
  perform 1 from public.national_federation_hosting_awards award
  where award.id = v_award_id and award.status = 'scheduled' for key share;
  if not found then return false; end if;
  v_viewed_at := clock_timestamp();
  if v_viewed_at < v_window_ends_at - interval '72 hours' or v_viewed_at >= v_window_ends_at then return false; end if;

  insert into private.federation_hosting_result_readers (award_id, sporting_director_id, first_viewed_at)
  values (v_award_id, v_director_id, v_viewed_at)
  on conflict (award_id, sporting_director_id) do nothing;
  return true;
end;
$$;

revoke all on function public.record_current_federation_hosting_result_view(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.record_current_federation_hosting_result_view(uuid, boolean) to authenticated;

commit;
