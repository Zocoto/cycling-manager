begin;

alter table public.sporting_director_messages
  drop constraint if exists sporting_director_messages_type_allowed;

alter table public.sporting_director_messages
  add constraint sporting_director_messages_type_allowed check (
    message_type in (
      'race_result',
      'national_championship_selection',
      'national_championship_result',
      'international_selection',
      'roster_alert',
      'wildcard',
      'academy',
      'infrastructure',
      'trophy',
      'system'
    )
  );

create table public.sporting_director_trophy_notifications (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  team_season_id uuid references public.team_seasons(id) on delete set null,
  trophy_kind text not null,
  trophy_key text not null,
  trophy_title text not null,
  source_reference text not null,
  awarded_at timestamptz not null default now(),
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sporting_director_trophy_notifications_kind_allowed check (
    trophy_kind in (
      'grand_tour',
      'monument',
      'world_championship',
      'continental_championship',
      'uci_team',
      'uci_rider',
      'special',
      'achievement',
      'medical',
      'sponsor',
      'attendance',
      'referral'
    )
  ),
  constraint sporting_director_trophy_notifications_text_present check (
    btrim(trophy_key) <> ''
    and btrim(trophy_title) <> ''
    and btrim(source_reference) <> ''
  ),
  constraint sporting_director_trophy_notifications_source_unique
    unique (sporting_director_id, source_reference)
);

create index sporting_director_trophy_notifications_unread_idx
  on public.sporting_director_trophy_notifications (
    sporting_director_id,
    awarded_at desc
  )
  where seen_at is null;

alter table public.sporting_director_trophy_notifications
  enable row level security;

create policy sporting_director_trophy_notifications_select_own
  on public.sporting_director_trophy_notifications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sporting_directors as director
      where director.id = sporting_director_id
        and director.auth_user_id = (select auth.uid())
    )
  );

grant select on public.sporting_director_trophy_notifications
  to authenticated;
grant all privileges on public.sporting_director_trophy_notifications
  to service_role;

create or replace function private.create_trophy_notification(
  p_sporting_director_id uuid,
  p_trophy_kind text,
  p_trophy_key text,
  p_trophy_title text,
  p_source_reference text,
  p_awarded_at timestamptz default now(),
  p_season_id uuid default null,
  p_team_season_id uuid default null,
  p_detail text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification_id uuid;
begin
  if not exists (
    select 1
    from public.sporting_directors as director
    where director.id = p_sporting_director_id
      and director.auth_user_id is not null
      and director.status = 'active'
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = director.id
      )
  ) then
    return null;
  end if;

  insert into public.sporting_director_trophy_notifications (
    sporting_director_id,
    season_id,
    team_season_id,
    trophy_kind,
    trophy_key,
    trophy_title,
    source_reference,
    awarded_at
  )
  values (
    p_sporting_director_id,
    p_season_id,
    p_team_season_id,
    p_trophy_kind,
    p_trophy_key,
    p_trophy_title,
    p_source_reference,
    coalesce(p_awarded_at, now())
  )
  on conflict (sporting_director_id, source_reference) do nothing
  returning id into v_notification_id;

  if v_notification_id is null then
    return null;
  end if;

  insert into public.sporting_director_messages (
    sporting_director_id,
    season_id,
    team_season_id,
    message_type,
    sender_name,
    subject,
    preview,
    body,
    action_href,
    action_label,
    source_reference,
    is_important,
    sent_at
  )
  values (
    p_sporting_director_id,
    p_season_id,
    p_team_season_id,
    'trophy',
    'Comité des distinctions',
    'Nouveau trophée · ' || p_trophy_title,
    'Votre palmarès s’enrichit d’un nouveau trophée.',
    'Félicitations ! Le trophée « ' || p_trophy_title || ' » rejoint votre palmarès.'
      || case
        when nullif(btrim(coalesce(p_detail, '')), '') is null then ''
        else E'\n\n' || btrim(p_detail)
      end
      || E'\n\nRetrouvez cette distinction dans votre galerie de trophées.',
    '/jeu/objectifs?onglet=trophees',
    'Voir mon trophée',
    'trophy:' || p_source_reference,
    true,
    coalesce(p_awarded_at, now())
  )
  on conflict (sporting_director_id, source_reference) do nothing;

  return v_notification_id;
end;
$$;

revoke all on function private.create_trophy_notification(
  uuid, text, text, text, text, timestamptz, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function private.create_trophy_notification(
  uuid, text, text, text, text, timestamptz, uuid, uuid, text
) to service_role;

create or replace function public.mark_current_trophy_notifications_seen()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour consulter vos trophées.';
  end if;

  update public.sporting_director_trophy_notifications as notification
  set seen_at = now()
  from public.sporting_directors as director
  where director.id = notification.sporting_director_id
    and director.auth_user_id = auth.uid()
    and notification.seen_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.mark_current_trophy_notifications_seen()
  from public, anon;
grant execute on function public.mark_current_trophy_notifications_seen()
  to authenticated;

create or replace function public.get_current_dashboard_fast_summary_v2()
returns table (
  sporting_director_id uuid,
  team_id uuid,
  team_season_id uuid,
  team_name text,
  rider_count integer,
  season_id uuid,
  season_name text,
  season_day_number integer,
  cash_balance numeric,
  currency text,
  team_points integer,
  team_rank integer,
  division_code text,
  inventory_total_units integer,
  inventory_available_units integer,
  race_roster_alert_count integer,
  objective_total_count integer,
  objective_ready_count integer,
  trophy_reward_count integer,
  unread_trophy_count integer,
  daily_reward_available boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    summary.sporting_director_id,
    summary.team_id,
    summary.team_season_id,
    summary.team_name,
    summary.rider_count,
    summary.season_id,
    summary.season_name,
    summary.season_day_number,
    summary.cash_balance,
    summary.currency,
    summary.team_points,
    summary.team_rank,
    summary.division_code,
    summary.inventory_total_units,
    summary.inventory_available_units,
    summary.race_roster_alert_count,
    summary.objective_total_count,
    summary.objective_ready_count,
    summary.trophy_reward_count,
    (
      select count(*)::integer
      from public.sporting_director_trophy_notifications as notification
      where notification.sporting_director_id = summary.sporting_director_id
        and notification.seen_at is null
    ),
    summary.daily_reward_available
  from public.get_current_dashboard_fast_summary() as summary;
$$;

revoke all on function public.get_current_dashboard_fast_summary_v2()
  from public, anon;
grant execute on function public.get_current_dashboard_fast_summary_v2()
  to authenticated, service_role;

create or replace function private.managed_directors_for_team_season(
  p_team_id uuid,
  p_season_id uuid
)
returns table (sporting_director_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct assignment.sporting_director_id
  from public.team_manager_assignments as assignment
  join public.seasons as trophy_season
    on trophy_season.id = p_season_id
  join public.seasons as start_season
    on start_season.id = assignment.start_season_id
  left join public.seasons as end_season
    on end_season.id = assignment.end_season_id
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.auth_user_id is not null
   and director.status = 'active'
  where assignment.team_id = p_team_id
    and assignment.role = 'general_manager'
    and assignment.status in ('active', 'completed', 'terminated')
    and trophy_season.game_year >= start_season.game_year
    and (
      end_season.game_year is null
      or trophy_season.game_year <= end_season.game_year
    )
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = assignment.sporting_director_id
    );
$$;

revoke all on function private.managed_directors_for_team_season(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.managed_directors_for_team_season(uuid, uuid)
  to service_role;

create or replace function private.notify_sporting_director_trophy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_kind text;
begin
  if new.claimed_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.claimed_at is not null then
    return new;
  end if;

  v_title := case new.trophy_key
    when 'alpha_tester' then 'Alphatesteur'
    when 'atlas_peloton' then 'Atlas du peloton'
    when 'campus_de_pointe' then 'Campus de pointe'
    when 'alchimiste_carbone' then 'Alchimiste du carbone'
    when 'triple_couronne_integrale' then 'Triple Couronne intégrale'
    when 'virage_cache' then 'Le Virage caché'
    when 'ambulancier' then 'Ambulancier'
    when 'medecin_urgentiste' then 'Médecin urgentiste'
    else initcap(replace(new.trophy_key, '_', ' '))
  end;
  v_kind := case
    when new.trophy_key in ('ambulancier', 'medecin_urgentiste') then 'medical'
    when new.trophy_key = 'alpha_tester' then 'special'
    else 'achievement'
  end;

  perform private.create_trophy_notification(
    new.sporting_director_id,
    v_kind,
    new.trophy_key,
    v_title,
    'special:' || new.id::text,
    new.claimed_at,
    null,
    null,
    'Cette distinction de carrière est désormais visible dans votre galerie.'
  );

  return new;
end;
$$;

revoke all on function private.notify_sporting_director_trophy()
  from public, anon, authenticated;

drop trigger if exists notify_sporting_director_trophy_after_award
  on public.sporting_director_trophies;
create trigger notify_sporting_director_trophy_after_award
after insert or update of claimed_at
on public.sporting_director_trophies
for each row execute function private.notify_sporting_director_trophy();

create or replace function private.notify_attendance_trophy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_name text;
begin
  select season.name
  into v_season_name
  from public.seasons as season
  where season.id = new.season_id;

  perform private.create_trophy_notification(
    new.sporting_director_id,
    'attendance',
    'assidu',
    'Assidu',
    'attendance:' || new.id::text,
    new.awarded_at,
    new.season_id,
    null,
    'Votre présence parfaite pendant ' || coalesce(v_season_name, 'la saison')
      || ' est récompensée.'
  );

  return new;
end;
$$;

revoke all on function private.notify_attendance_trophy()
  from public, anon, authenticated;

drop trigger if exists notify_attendance_trophy_after_award
  on public.sporting_director_attendance_trophies;
create trigger notify_attendance_trophy_after_award
after insert on public.sporting_director_attendance_trophies
for each row execute function private.notify_attendance_trophy();

create or replace function private.notify_sponsor_trophy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_name text;
  v_team_season_id uuid;
begin
  select season.name
  into v_season_name
  from public.seasons as season
  where season.id = new.season_id;

  select team_season.id
  into v_team_season_id
  from public.team_sponsor_contracts as contract
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
   and team_season.season_id = new.season_id
  where contract.id = new.team_sponsor_contract_id
  limit 1;

  perform private.create_trophy_notification(
    new.sporting_director_id,
    'sponsor',
    'sponsor_ambassador',
    'Ambassadeur exemplaire',
    'sponsor:' || new.id::text,
    new.awarded_at,
    new.season_id,
    v_team_season_id,
    'Votre saison à 100 % de satisfaction sponsor en '
      || coalesce(v_season_name, 'cette saison') || ' est récompensée.'
  );

  return new;
end;
$$;

revoke all on function private.notify_sponsor_trophy()
  from public, anon, authenticated;

drop trigger if exists notify_sponsor_trophy_after_award
  on public.sporting_director_sponsor_trophies;
create trigger notify_sponsor_trophy_after_award
after insert on public.sporting_director_sponsor_trophies
for each row execute function private.notify_sponsor_trophy();

create or replace function private.notify_referral_trophy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qualified_count integer;
  v_title text;
begin
  if new.status <> 'qualified' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'qualified' then
    return new;
  end if;

  select count(*)::integer
  into v_qualified_count
  from public.sporting_director_referrals as referral
  where referral.referrer_director_id = new.referrer_director_id
    and referral.status = 'qualified';

  v_title := case v_qualified_count
    when 1 then 'Entremetteur du peloton'
    when 5 then 'Le Parrain'
    when 10 then 'Parrain influent'
    when 25 then 'Don du peloton'
    else null
  end;

  if v_title is null then
    return new;
  end if;

  perform private.create_trophy_notification(
    new.referrer_director_id,
    'referral',
    'referral_' || v_qualified_count::text,
    v_title,
    'referral:' || v_qualified_count::text,
    coalesce(new.qualified_at, now()),
    null,
    null,
    v_qualified_count::text || ' filleul'
      || case when v_qualified_count > 1 then 's qualifiés' else ' qualifié' end
      || ' : un nouveau palier de parrainage rejoint votre palmarès.'
  );

  return new;
end;
$$;

revoke all on function private.notify_referral_trophy()
  from public, anon, authenticated;

drop trigger if exists notify_referral_trophy_after_qualification
  on public.sporting_director_referrals;
create trigger notify_referral_trophy_after_qualification
after insert or update of status
on public.sporting_director_referrals
for each row execute function private.notify_referral_trophy();

create or replace function private.notify_major_race_trophies(
  p_race_edition_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_winner record;
  v_director record;
  v_kind text;
  v_notification_id uuid;
  v_created integer := 0;
begin
  select
    edition.id,
    edition.season_id,
    edition.display_name,
    race.slug,
    race.is_grand_tour,
    race.is_monument,
    coalesce(race.competition_type, 'standard') as competition_type,
    season.name as season_name
  into v_context
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  join public.seasons as season on season.id = edition.season_id
  where edition.id = p_race_edition_id
    and edition.status = 'completed'
    and (
      race.is_grand_tour
      or race.is_monument
      or race.competition_type in (
        'world_championship',
        'continental_championship'
      )
    );

  if not found then
    return 0;
  end if;

  select
    result.id as result_id,
    registration.team_season_id,
    team_season.team_id,
    rider.first_name,
    rider.last_name
  into v_winner
  from public.race_results as result
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  join public.riders as rider
    on rider.id = roster.rider_id
  where result.race_edition_id = p_race_edition_id
    and result.status = 'classified'
    and result.final_rank = 1
  limit 1;

  if not found then
    return 0;
  end if;

  v_kind := case
    when v_context.competition_type = 'world_championship'
      then 'world_championship'
    when v_context.competition_type = 'continental_championship'
      then 'continental_championship'
    when v_context.is_grand_tour then 'grand_tour'
    else 'monument'
  end;

  for v_director in
    select managed.sporting_director_id
    from private.managed_directors_for_team_season(
      v_winner.team_id,
      v_context.season_id
    ) as managed
  loop
    v_notification_id := private.create_trophy_notification(
      v_director.sporting_director_id,
      v_kind,
      v_kind || ':' || v_context.slug,
      v_context.display_name,
      'race:' || v_winner.result_id::text,
      now(),
      v_context.season_id,
      v_winner.team_season_id,
      concat_ws(' ', v_winner.first_name, v_winner.last_name)
        || ' s’impose en ' || v_context.display_name
        || ' (' || v_context.season_name || ').'
    );

    if v_notification_id is not null then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;

revoke all on function private.notify_major_race_trophies(uuid)
  from public, anon, authenticated;
grant execute on function private.notify_major_race_trophies(uuid)
  to service_role;

create or replace function private.notify_major_race_after_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'classified' and new.final_rank = 1 then
    perform private.notify_major_race_trophies(new.race_edition_id);
  end if;

  return new;
end;
$$;

revoke all on function private.notify_major_race_after_result()
  from public, anon, authenticated;

drop trigger if exists notify_major_race_after_result
  on public.race_results;
create trigger notify_major_race_after_result
after insert or update of status, final_rank
on public.race_results
for each row execute function private.notify_major_race_after_result();

create or replace function private.notify_major_race_after_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from 'completed' then
    perform private.notify_major_race_trophies(new.id);
  end if;

  return new;
end;
$$;

revoke all on function private.notify_major_race_after_completion()
  from public, anon, authenticated;

drop trigger if exists notify_major_race_after_completion
  on public.race_editions;
create trigger notify_major_race_after_completion
after update of status
on public.race_editions
for each row execute function private.notify_major_race_after_completion();

create or replace function private.notify_team_uci_trophy(
  p_team_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_director record;
  v_notification_id uuid;
  v_created integer := 0;
begin
  select
    team_season.id,
    team_season.team_id,
    team_season.season_id,
    team_season.display_name,
    season.name as season_name
  into v_context
  from public.team_seasons as team_season
  join public.seasons as season
    on season.id = team_season.season_id
  where team_season.id = p_team_season_id
    and team_season.final_rank = 1
    and team_season.status = 'completed'
    and season.status = 'completed';

  if not found then
    return 0;
  end if;

  for v_director in
    select managed.sporting_director_id
    from private.managed_directors_for_team_season(
      v_context.team_id,
      v_context.season_id
    ) as managed
  loop
    v_notification_id := private.create_trophy_notification(
      v_director.sporting_director_id,
      'uci_team',
      'uci_team',
      'Coupe UCI des équipes',
      'uci-team:' || v_context.id::text,
      now(),
      v_context.season_id,
      v_context.id,
      v_context.display_name || ' termine numéro 1 mondial en '
        || v_context.season_name || '.'
    );

    if v_notification_id is not null then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;

revoke all on function private.notify_team_uci_trophy(uuid)
  from public, anon, authenticated;
grant execute on function private.notify_team_uci_trophy(uuid)
  to service_role;

create or replace function private.notify_rider_uci_trophy(
  p_summary_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_director record;
  v_notification_id uuid;
  v_created integer := 0;
begin
  select
    summary.id,
    summary.rider_id,
    summary.season_id,
    season.name as season_name,
    season.game_year,
    rider.first_name,
    rider.last_name
  into v_context
  from public.rider_season_summaries as summary
  join public.seasons as season on season.id = summary.season_id
  join public.riders as rider on rider.id = summary.rider_id
  where summary.id = p_summary_id
    and summary.uci_rank = 1
    and season.status = 'completed';

  if not found then
    return 0;
  end if;

  for v_director in
    select distinct
      managed.sporting_director_id,
      team_season.id as team_season_id
    from public.rider_contracts as contract
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
    join public.seasons as end_season
      on end_season.id = contract.end_season_id
    left join public.team_seasons as team_season
      on team_season.team_id = contract.team_id
     and team_season.season_id = v_context.season_id
    cross join lateral private.managed_directors_for_team_season(
      contract.team_id,
      v_context.season_id
    ) as managed
    where contract.rider_id = v_context.rider_id
      and contract.status in ('active', 'completed', 'terminated')
      and v_context.game_year between start_season.game_year and end_season.game_year
  loop
    v_notification_id := private.create_trophy_notification(
      v_director.sporting_director_id,
      'uci_rider',
      'uci_rider',
      'Couronne UCI individuelle',
      'uci-rider:' || v_context.id::text,
      now(),
      v_context.season_id,
      v_director.team_season_id,
      concat_ws(' ', v_context.first_name, v_context.last_name)
        || ' termine numéro 1 mondial en ' || v_context.season_name || '.'
    );

    if v_notification_id is not null then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;

revoke all on function private.notify_rider_uci_trophy(uuid)
  from public, anon, authenticated;
grant execute on function private.notify_rider_uci_trophy(uuid)
  to service_role;

create or replace function private.notify_team_uci_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.final_rank = 1 and new.status = 'completed' then
    perform private.notify_team_uci_trophy(new.id);
  end if;

  return new;
end;
$$;

revoke all on function private.notify_team_uci_after_write()
  from public, anon, authenticated;

drop trigger if exists notify_team_uci_after_write
  on public.team_seasons;
create trigger notify_team_uci_after_write
after insert or update of final_rank, status
on public.team_seasons
for each row execute function private.notify_team_uci_after_write();

create or replace function private.notify_rider_uci_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.uci_rank = 1 then
    perform private.notify_rider_uci_trophy(new.id);
  end if;

  return new;
end;
$$;

revoke all on function private.notify_rider_uci_after_write()
  from public, anon, authenticated;

drop trigger if exists notify_rider_uci_after_write
  on public.rider_season_summaries;
create trigger notify_rider_uci_after_write
after insert or update of uci_rank
on public.rider_season_summaries
for each row execute function private.notify_rider_uci_after_write();

create or replace function private.notify_uci_trophies_after_season_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_season record;
  v_summary record;
begin
  if new.status <> 'completed'
     or old.status is not distinct from 'completed' then
    return new;
  end if;

  for v_team_season in
    select team_season.id
    from public.team_seasons as team_season
    where team_season.season_id = new.id
      and team_season.status = 'completed'
      and team_season.final_rank = 1
  loop
    perform private.notify_team_uci_trophy(v_team_season.id);
  end loop;

  for v_summary in
    select summary.id
    from public.rider_season_summaries as summary
    where summary.season_id = new.id
      and summary.uci_rank = 1
  loop
    perform private.notify_rider_uci_trophy(v_summary.id);
  end loop;

  return new;
end;
$$;

revoke all on function private.notify_uci_trophies_after_season_completion()
  from public, anon, authenticated;

drop trigger if exists notify_uci_trophies_after_season_completion
  on public.seasons;
create trigger notify_uci_trophies_after_season_completion
after update of status
on public.seasons
for each row execute function private.notify_uci_trophies_after_season_completion();

comment on table public.sporting_director_trophy_notifications is
  'Journal privé et indexé des trophées nouvellement reçus, distinct des récompenses encore à récupérer.';
comment on function public.mark_current_trophy_notifications_seen() is
  'Acquitte les pastilles de trophées du DS connecté lors de l’ouverture effective de sa galerie.';
comment on function public.get_current_dashboard_fast_summary_v2() is
  'Résumé compact du bureau enrichi du compteur indexé des nouveaux trophées, sans aller-retour supplémentaire.';

notify pgrst, 'reload schema';

commit;
