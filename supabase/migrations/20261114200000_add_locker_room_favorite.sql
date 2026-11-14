begin;
set local application_name = 'locker-room-favorite-install';
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

do $extend_catalog$
declare
  v_constraint text;
begin
  select pg_get_expr(conbin, conrelid) into v_constraint
  from pg_constraint
  where conrelid = 'public.special_ability_catalog'::regclass
    and conname = 'special_ability_catalog_code_allowed' and contype = 'c';

  if v_constraint is null or strpos(v_constraint, '''etapovore''') = 0 then
    raise exception 'Unexpected special ability catalogue constraint.';
  end if;
  alter table public.special_ability_catalog drop constraint special_ability_catalog_code_allowed;
  execute format(
    'alter table public.special_ability_catalog add constraint special_ability_catalog_code_allowed check ((%s) or code = ''locker_room_favorite'')',
    v_constraint
  );
end;
$extend_catalog$;

insert into public.special_ability_catalog (
  code, name, effect_description, icon_key, medallion_tone
) values (
  'locker_room_favorite',
  'Coqueluche du vestiaire',
  'À l’arrivée d’une classique ou d’un tour, donne +1 point de moral aux coéquipiers qui ont pris le départ avec lui sur au moins une étape. Le bonus est limité à 1 point par course, même avec plusieurs porteurs.',
  'team_spirit',
  'sunrise'
);

insert into public.inventory_catalog_items (
  item_key, name, category, rarity, description, effect_summary, effect_payload, icon_key, is_consumable
)
select
  'medallion-locker-room-favorite', 'Médaillon Coqueluche du vestiaire', 'special_ability', 'epic',
  'Un médaillon aux couleurs chaudes gravé de trois coéquipiers.',
  effect_description, '{"abilityCode":"locker_room_favorite"}'::jsonb, 'medallion', true
from public.special_ability_catalog where code = 'locker_room_favorite';

do $extend_morale$
declare
  v_constraint text;
  v_definition text;
  v_anchor constant text := '''manual_adjustment''';
begin
  select pg_get_expr(conbin, conrelid) into v_constraint
  from pg_constraint
  where conrelid = 'public.rider_morale_events'::regclass
    and conname = 'rider_morale_events_source_allowed' and contype = 'c';

  v_definition := pg_get_functiondef(
    'public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)'::regprocedure
  );

  if v_constraint is null or strpos(v_constraint, v_anchor) = 0
    or length(v_definition) - length(replace(v_definition, v_anchor, '')) <> length(v_anchor) then
    raise exception 'Unexpected rider morale source definition.';
  end if;
  execute replace(v_definition, v_anchor, v_anchor || ', ''locker_room_favorite''');
  alter table public.rider_morale_events drop constraint rider_morale_events_source_allowed;
  -- This extends the existing check without scanning the morale ledger.
  execute format(
    'alter table public.rider_morale_events add constraint rider_morale_events_source_allowed check ((%s) or source_type = ''locker_room_favorite'') not valid',
    v_constraint
  );
end;
$extend_morale$;

create function private.apply_locker_room_favorite_after_race_completion()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_season_day_id uuid;
  v_teammate record;
begin
  select day.id into v_season_day_id
  from public.races as race
  cross join public.seasons as season
  join public.season_days as day on day.season_id = season.id
    and day.day_number = season.current_day_number
  where race.id = new.race_id
    and race.competition_type = 'standard'
    and race.slug <> 'criterium-de-la-decouverte'
    and season.id = new.season_id
    and season.status = 'active';
  if not found then return new; end if;

  if not exists (
    select 1 from public.stages as stage where stage.race_edition_id = new.id
  ) or exists (
    select 1 from public.stages as stage
    where stage.race_edition_id = new.id
      and (stage.status <> 'completed' or stage.departure_at > now())
  ) then
    return new;
  end if;

  for v_teammate in
    select teammate.rider_id, min(holder.rider_id::text) as sample_holder_id
    from public.race_registrations as registration
    join public.race_rosters as holder
      on holder.race_registration_id = registration.id
    join public.rider_special_abilities as ability
      on ability.rider_id = holder.rider_id and ability.ability_code = 'locker_room_favorite'
    join public.stage_results as holder_result
      on holder_result.race_roster_id = holder.id and holder_result.status <> 'did_not_start'
    join public.stages as stage
      on stage.id = holder_result.stage_id and stage.race_edition_id = registration.race_edition_id
      and ability.unlocked_at <= stage.departure_at
    join public.race_rosters as teammate
      on teammate.race_registration_id = registration.id and teammate.rider_id <> holder.rider_id
    join public.stage_results as teammate_result
      on teammate_result.stage_id = stage.id and teammate_result.race_roster_id = teammate.id
      and teammate_result.status <> 'did_not_start'
    where registration.race_edition_id = new.id
      and registration.status = 'accepted'
      and registration.team_season_id is not null
    group by teammate.rider_id
    order by teammate.rider_id
  loop
    perform public.apply_rider_morale_event(
      v_teammate.rider_id,
      v_season_day_id,
      'locker_room_favorite',
      new.id::text,
      1,
      'Coqueluche du vestiaire — ' || new.display_name,
      jsonb_build_object('raceEditionId', new.id, 'teammateRiderId', v_teammate.sample_holder_id)
    );
  end loop;
  return new;
end;
$$;

revoke all on function private.apply_locker_room_favorite_after_race_completion()
  from public, anon, authenticated, service_role;

create trigger apply_locker_room_favorite_after_race_completion
after update of status on public.race_editions
for each row when (old.status is distinct from new.status and new.status = 'completed')
execute function private.apply_locker_room_favorite_after_race_completion();

commit;
