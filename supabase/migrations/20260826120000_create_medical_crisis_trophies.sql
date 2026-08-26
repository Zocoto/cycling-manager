begin;

create or replace function private.evaluate_medical_crisis_trophies_for_team(
  p_team_id uuid
)
returns smallint
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_context record;
  v_injured_riders integer := 0;
  v_award record;
  v_trophy_id uuid;
  v_reward_id uuid;
  v_source_reference text;
  v_awarded smallint := 0;
begin
  if p_team_id is null then
    return 0;
  end if;

  select
    director.id as sporting_director_id,
    team_season.id as team_season_id,
    season.current_day_number,
    season_day.id as season_day_id
  into v_context
  from public.team_manager_assignments as assignment
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
   and director.auth_user_id is not null
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
   and team_season.status = 'active'
  left join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = season.current_day_number
  where assignment.team_id = p_team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  order by assignment.created_at desc
  limit 1;

  if v_context is null then
    return 0;
  end if;

  select count(distinct contract.rider_id)::integer
  into v_injured_riders
  from public.rider_contracts as contract
  join public.rider_injuries as injury
    on injury.rider_id = contract.rider_id
   and injury.status = 'active'
   and injury.expected_recovery_at > now()
  where contract.team_id = p_team_id
    and contract.status = 'active';

  for v_award in
    select *
    from (
      values
        (
          'ambulancier'::text,
          5::integer,
          25000::numeric,
          'Trophée Ambulancier — 5 coureurs blessés simultanément'::text
        ),
        (
          'medecin_urgentiste'::text,
          10::integer,
          75000::numeric,
          'Trophée Médecin urgentiste — 10 coureurs blessés simultanément'::text
        )
    ) as award(trophy_key, injury_threshold, cash_reward, description)
    order by award.injury_threshold
  loop
    if v_injured_riders < v_award.injury_threshold then
      continue;
    end if;

    v_trophy_id := null;
    insert into public.sporting_director_trophies (
      sporting_director_id,
      trophy_key,
      available_at,
      claimed_at
    )
    values (
      v_context.sporting_director_id,
      v_award.trophy_key,
      now(),
      now()
    )
    on conflict (sporting_director_id, trophy_key) do nothing
    returning id into v_trophy_id;

    if v_trophy_id is null then
      continue;
    end if;

    v_source_reference :=
      'medical-trophy:' ||
      v_context.sporting_director_id::text ||
      ':' ||
      v_award.trophy_key;
    v_reward_id := null;

    insert into public.reward_events (
      source_reference,
      source_type,
      sporting_director_id,
      team_season_id,
      cash_prize,
      description
    )
    values (
      v_source_reference,
      'game_objective',
      v_context.sporting_director_id,
      v_context.team_season_id,
      v_award.cash_reward,
      v_award.description
    )
    on conflict (source_reference) do nothing
    returning id into v_reward_id;

    if v_reward_id is not null then
      update public.team_seasons
      set cash_balance = cash_balance + v_award.cash_reward
      where id = v_context.team_season_id;

      insert into public.team_finance_transactions (
        team_season_id,
        season_day_id,
        day_number,
        amount,
        category,
        status,
        description,
        source_reference,
        posted_at
      )
      values (
        v_context.team_season_id,
        v_context.season_day_id,
        greatest(1, least(28, coalesce(v_context.current_day_number, 1))),
        v_award.cash_reward,
        'other',
        'posted',
        v_award.description,
        'reward:' || v_source_reference,
        now()
      )
      on conflict (team_season_id, source_reference) do nothing;
    end if;

    v_awarded := v_awarded + 1;
  end loop;

  return v_awarded;
end;
$$;

create or replace function private.evaluate_medical_crisis_trophies_after_injury()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_team_id uuid;
begin
  if new.status <> 'active' or new.expected_recovery_at <= now() then
    return new;
  end if;

  select contract.team_id
  into v_team_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.status = 'active'
  limit 1;

  if v_team_id is null then
    return new;
  end if;

  begin
    perform private.evaluate_medical_crisis_trophies_for_team(v_team_id);
  exception
    when others then
      raise warning
        'Évaluation des trophées médicaux impossible pour la blessure % : %',
        new.id,
        sqlerrm;
  end;

  return new;
end;
$$;

create trigger evaluate_medical_crisis_trophies_after_injury
after insert on public.rider_injuries
for each row
execute function private.evaluate_medical_crisis_trophies_after_injury();

create or replace function private.validate_medical_avatar_outfits()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_outfit_key text;
  v_required_trophy_key text;
  v_reward_name text;
begin
  if new.avatar_key is null
     or new.avatar_key not like 'director_custom_v1:%' then
    return new;
  end if;

  v_outfit_key := split_part(
    substring(
      new.avatar_key
      from char_length('director_custom_v1:') + 1
    ),
    '.',
    14
  );

  if v_outfit_key = 'nurse-cap' then
    v_required_trophy_key := 'ambulancier';
    v_reward_name := 'Le trophée Ambulancier';
  elsif v_outfit_key = 'emergency-doctor' then
    v_required_trophy_key := 'medecin_urgentiste';
    v_reward_name := 'Le trophée Médecin urgentiste';
  else
    return new;
  end if;

  if not exists (
    select 1
    from public.sporting_director_trophies as trophy
    where trophy.sporting_director_id = new.id
      and trophy.trophy_key = v_required_trophy_key
      and trophy.claimed_at is not null
  ) then
    raise exception
      '% est requis pour porter cette tenue médicale.',
      v_reward_name;
  end if;

  return new;
end;
$$;

create trigger validate_medical_avatar_outfits_before_write
before insert or update of avatar_key
on public.sporting_directors
for each row
execute function private.validate_medical_avatar_outfits();

-- Récompense les crises médicales déjà en cours au moment du déploiement.
do $$
declare
  v_team record;
begin
  for v_team in
    select distinct contract.team_id
    from public.rider_contracts as contract
    join public.rider_injuries as injury
      on injury.rider_id = contract.rider_id
     and injury.status = 'active'
     and injury.expected_recovery_at > now()
    where contract.status = 'active'
  loop
    perform private.evaluate_medical_crisis_trophies_for_team(v_team.team_id);
  end loop;
end;
$$;

revoke all on function private.evaluate_medical_crisis_trophies_for_team(uuid)
  from public, anon, authenticated;
revoke all on function private.evaluate_medical_crisis_trophies_after_injury()
  from public, anon, authenticated;
revoke all on function private.validate_medical_avatar_outfits()
  from public, anon, authenticated;

comment on function private.evaluate_medical_crisis_trophies_for_team(uuid) is
  'Attribue une seule fois les trophées Ambulancier et Médecin urgentiste, leurs gains financiers et leurs droits de skins selon le nombre de coureurs simultanément blessés.';

notify pgrst, 'reload schema';

commit;
