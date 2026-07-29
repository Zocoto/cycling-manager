begin;

-- Une ligne reste conservée pour audit lorsque l’ancien moteur l’a créée
-- rétroactivement, mais elle ne doit plus apparaître ni compter comme séance.
alter table public.rider_training_sessions
  add column if not exists is_contract_eligible boolean
    not null default true;

update public.rider_training_sessions as session
set is_contract_eligible = exists (
  select 1
  from public.rider_contracts as contract
  join public.seasons as session_season
    on session_season.id = session.season_id
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
  join public.season_days as day
    on day.id = session.season_day_id
   and day.season_id = session.season_id
  where contract.rider_id = session.rider_id
    and contract.team_id = session.team_id
    and contract.status in ('active', 'completed', 'terminated')
    and session_season.game_year between
      start_season.game_year and end_season.game_year
    and coalesce(contract.signed_at, contract.created_at) <=
      (
        (day.calendar_date::timestamp + time '08:00')
        at time zone 'Europe/Paris'
      )
);

create or replace function public.is_rider_contract_training_eligible(
  p_contract_id uuid,
  p_season_day_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rider_contracts as contract
    join public.season_days as day
      on day.id = p_season_day_id
    join public.seasons as session_season
      on session_season.id = day.season_id
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
    join public.seasons as end_season
      on end_season.id = contract.end_season_id
    where contract.id = p_contract_id
      and session_season.game_year between
        start_season.game_year and end_season.game_year
      and coalesce(contract.signed_at, contract.created_at) <=
        (
          (day.calendar_date::timestamp + time '08:00')
          at time zone 'Europe/Paris'
        )
  );
$$;

-- La fonction d’entraînement a été enrichie par plusieurs migrations de
-- gameplay. On insère le garde-fou dans sa définition effective afin de
-- conserver tous les bonus de staff et capacités spéciales déjà installés.
do $migration$
declare
  v_definition text;
  v_marker constant text := 'where rider.status = ''active''';
  v_marker_count integer;
begin
  select pg_get_functiondef(
    'public.settle_due_training_sessions()'::regprocedure
  )
  into v_definition;

  v_marker_count := (
    length(v_definition)
    - length(replace(v_definition, v_marker, ''))
  ) / length(v_marker);

  if v_marker_count <> 1 then
    raise exception
      'Filtre des coureurs entraînés inattendu (% marqueurs).',
      v_marker_count;
  end if;

  v_definition := replace(
    v_definition,
    v_marker,
    v_marker || E'\n        and public.is_rider_contract_training_eligible(contract.id, v_day.id)'
  );

  execute v_definition;
end;
$migration$;

-- Les deux usages d’une séance terminée dans les objectifs sont le compteur
-- d’entraînements et la forme économisée par le kiné.
do $migration$
declare
  v_definition text;
  v_marker constant text := 'where session.status = ''completed''';
  v_marker_count integer;
begin
  select pg_get_functiondef(
    'public.calculate_expanded_game_objective_progress(text,uuid)'::regprocedure
  )
  into v_definition;

  v_marker_count := (
    length(v_definition)
    - length(replace(v_definition, v_marker, ''))
  ) / length(v_marker);

  if v_marker_count <> 2 then
    raise exception
      'Compteurs d’entraînement des objectifs inattendus (% marqueurs).',
      v_marker_count;
  end if;

  v_definition := replace(
    v_definition,
    v_marker,
    v_marker || E'\n        and session.is_contract_eligible'
  );

  execute v_definition;
end;
$migration$;

revoke all on function public.is_rider_contract_training_eligible(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.is_rider_contract_training_eligible(uuid, uuid)
  to service_role;

comment on column public.rider_training_sessions.is_contract_eligible is
  'Vrai uniquement si le coureur était sous contrat avec l’équipe au passage de 8 h de cette journée.';

comment on function public.is_rider_contract_training_eligible(uuid, uuid) is
  'Empêche une signature en cours de saison de créer des séances rétroactives avant son heure effective.';

notify pgrst, 'reload schema';

commit;