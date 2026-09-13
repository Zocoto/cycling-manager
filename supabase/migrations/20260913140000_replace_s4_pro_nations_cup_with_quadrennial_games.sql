begin;

-- S4 (and every fourth season) hosts the professional Quadrennial Games in
-- place of the professional Nations Cup. The junior Nations Cup remains part
-- of the same season and keeps its own candidacy.
alter table public.national_federation_hosting_candidacies
  drop constraint national_federation_hosting_event_allowed;
alter table public.national_federation_hosting_candidacies
  add constraint national_federation_hosting_event_allowed check (
    event_type in (
      'world_championship_pro', 'continental_championship_pro',
      'nations_cup_pro', 'quadrennial_games_pro',
      'world_championship_junior',
      'continental_championship_junior', 'nations_cup_junior'
    )
  );

alter table public.national_federation_hosting_awards
  drop constraint national_federation_hosting_awards_event_allowed;
alter table public.national_federation_hosting_awards
  add constraint national_federation_hosting_awards_event_allowed check (
    event_type in (
      'world_championship_pro', 'continental_championship_pro',
      'nations_cup_pro', 'quadrennial_games_pro',
      'world_championship_junior',
      'continental_championship_junior', 'nations_cup_junior'
    )
  );

-- Preserve already submitted S4 candidacies while correcting their identity.
update public.national_federation_hosting_candidacies
set event_type = 'quadrennial_games_pro',
    event_key = 'quadrennial_games_pro',
    updated_at = now()
where target_game_year % 4 = 0
  and event_type = 'nations_cup_pro';

update public.national_federation_hosting_awards
set event_type = 'quadrennial_games_pro',
    event_key = 'quadrennial_games_pro'
where target_game_year % 4 = 0
  and event_type = 'nations_cup_pro';

alter table public.national_federation_hosting_candidacies
  add constraint national_federation_hosting_candidacy_cycle_valid check (
    (event_type = 'quadrennial_games_pro' and target_game_year % 4 = 0)
    or (event_type = 'nations_cup_pro' and target_game_year % 4 <> 0)
    or event_type not in ('quadrennial_games_pro', 'nations_cup_pro')
  );

alter table public.national_federation_hosting_awards
  add constraint national_federation_hosting_award_cycle_valid check (
    (event_type = 'quadrennial_games_pro' and target_game_year % 4 = 0)
    or (event_type = 'nations_cup_pro' and target_game_year % 4 <> 0)
    or event_type not in ('quadrennial_games_pro', 'nations_cup_pro')
  );

-- Keep the current race-office rules while adding the seasonal guard and the
-- dedicated Quadrennial Games economics/label to candidacy submission.
do $migration$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.submit_national_federation_hosting_candidacy(text,text)'::regprocedure
  ) into v_definition;

  v_patched := replace(
    v_definition,
    $old$  case p_event_type
    when 'world_championship_pro' then$old$,
    $new$  if (v_season.game_year + 1) % 4 = 0
     and p_event_type = 'nations_cup_pro' then
    raise exception 'La Nations Cup professionnelle est remplacée par les Jeux quadriennaux en Saison %.',
      v_season.game_year + 1;
  end if;
  if (v_season.game_year + 1) % 4 <> 0
     and p_event_type = 'quadrennial_games_pro' then
    raise exception 'Les Jeux quadriennaux ne peuvent être organisés qu’en saison quadriennale.';
  end if;

  case p_event_type
    when 'world_championship_pro' then$new$
  );
  v_patched := replace(
    v_patched,
    $old$    when 'nations_cup_pro' then
      v_event_key := 'nations_cup_pro';
      v_hosting_cost := 2400000; v_base_attendance := 180000;
      v_revenue_per_attendee := 17; v_prestige_gain := 45;$old$,
    $new$    when 'nations_cup_pro' then
      v_event_key := 'nations_cup_pro';
      v_hosting_cost := 2400000; v_base_attendance := 180000;
      v_revenue_per_attendee := 17; v_prestige_gain := 45;
    when 'quadrennial_games_pro' then
      v_event_key := 'quadrennial_games_pro';
      v_hosting_cost := 2400000; v_base_attendance := 180000;
      v_revenue_per_attendee := 17; v_prestige_gain := 45;$new$
  );
  v_patched := replace(
    v_patched,
    $old$      when 'nations_cup_pro' then 'Nations Cup professionnelle'$old$,
    $new$      when 'nations_cup_pro' then 'Nations Cup professionnelle'
      when 'quadrennial_games_pro' then 'Jeux quadriennaux professionnels'$new$
  );

  if v_patched = v_definition
    or position('quadrennial_games_pro' in v_patched) = 0
    or position('v_season.game_year + 1) % 4' in v_patched) = 0 then
    raise exception 'La règle saisonnière JQ/NC n’a pas pu être raccordée aux candidatures.';
  end if;
  execute v_patched;
end;
$migration$;

-- The five existing professional programme races are reused for S4. Their
-- routes can evolve independently later, but the awarded JQ host must already
-- control the generated editions and their selection weather.
do $migration$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.ensure_professional_nations_cup(uuid)'::regprocedure
  ) into v_definition;
  v_patched := replace(
    v_definition,
    $old$    and award.event_type = 'nations_cup_pro'$old$,
    $new$    and award.event_type = case
      when v_season.game_year % 4 = 0 then 'quadrennial_games_pro'
      else 'nations_cup_pro'
    end$new$
  );
  if v_patched = v_definition
    or position('quadrennial_games_pro' in v_patched) = 0 then
    raise exception 'L’hôte des Jeux quadriennaux n’a pas pu être raccordé au programme professionnel.';
  end if;
  execute v_patched;
end;
$migration$;

create or replace function public.apply_professional_nations_cup_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type in ('nations_cup_pro', 'quadrennial_games_pro')
     and new.status in ('scheduled', 'settled') then
    update public.race_editions as edition
    set host_country_id = new.country_id
    from public.races as race, public.seasons as season
    where race.id = edition.race_id
      and race.competition_type = 'nations_cup'
      and season.id = edition.season_id
      and season.game_year = new.target_game_year;
  end if;
  return new;
end;
$$;

revoke all on function public.apply_professional_nations_cup_host()
  from public, anon, authenticated;

-- Hosting returns use the same attendance model for the professional JQ as
-- the professional Nations Cup they replace.
do $migration$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.settle_due_national_federation_hosting_returns()'::regprocedure
  ) into v_definition;
  v_patched := replace(
    v_definition,
    $old$    elsif v_award.event_type = 'nations_cup_pro' then$old$,
    $new$    elsif v_award.event_type in (
      'nations_cup_pro', 'quadrennial_games_pro'
    ) then$new$
  );
  v_patched := replace(
    v_patched,
    $old$        when 'nations_cup_pro' then 180000$old$,
    $new$        when 'nations_cup_pro' then 180000
        when 'quadrennial_games_pro' then 180000$new$
  );
  v_patched := replace(
    v_patched,
    $old$      when 'nations_cup_pro' then 17$old$,
    $new$      when 'nations_cup_pro' then 17
      when 'quadrennial_games_pro' then 17$new$
  );
  if v_patched = v_definition
    or position('quadrennial_games_pro' in v_patched) = 0
    or position('when ''quadrennial_games_pro'' then 180000' in v_patched) = 0
    or position('when ''quadrennial_games_pro'' then 17' in v_patched) = 0 then
    raise exception 'Les recettes des Jeux quadriennaux n’ont pas pu être raccordées.';
  end if;
  execute v_patched;
end;
$migration$;

commit;
