begin;

-- Expose la dernière forme connue des coureurs convoqués sans ajouter de
-- lecture séquentielle à la page : cet appel est lancé en parallèle des
-- convocations et de leurs conflits WildCard.
create or replace function public.get_international_selection_forms_for_auth_user(
  p_auth_user_id uuid
)
returns table (
  candidate_id uuid,
  current_form smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    candidate.id as candidate_id,
    coalesce(latest_condition.form, 75)::smallint as current_form
  from public.sporting_directors as director
  join public.international_championship_rider_selections as candidate
    on candidate.sporting_director_id = director.id
  join public.international_championship_nation_selections as selection
    on selection.id = candidate.nation_selection_id
  join public.race_editions as edition
    on edition.id = selection.race_edition_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  left join lateral (
    select condition.form
    from public.rider_condition_states as condition
    join public.season_days as condition_day
      on condition_day.id = condition.season_day_id
     and condition_day.season_id = edition.season_id
    where condition.rider_id = candidate.rider_id
      and condition_day.day_number <= coalesce(season.current_day_number, 1)
    order by condition_day.day_number desc, condition.updated_at desc
    limit 1
  ) as latest_condition on true
  where director.auth_user_id = p_auth_user_id
    and director.status = 'active'
    and (
      candidate.is_selected
      or candidate.selected_at is not null
      or candidate.response_status in ('confirmed', 'automatic', 'declined')
    );
$$;

revoke all
on function public.get_international_selection_forms_for_auth_user(uuid)
from public, anon, authenticated;

grant execute
on function public.get_international_selection_forms_for_auth_user(uuid)
to service_role;

-- Toutes les décisions d'un écran sont prévalidées puis appliquées dans la
-- même transaction. La fonction unitaire reste la source de vérité pour les
-- conflits, la disponibilité et les effets de bord (courses, WildCards,
-- stages et remboursements).
create or replace function public.respond_to_international_selections_with_conflict_ack(
  p_decisions jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_decision jsonb;
  v_candidate_id uuid;
  v_decision_count integer;
  v_eligible_count integer;
  v_acknowledged_conflicts text[];
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('international-championship-selections', 0)
  );

  if p_decisions is null or jsonb_typeof(p_decisions) <> 'array' then
    raise exception 'Le lot de décisions est invalide.';
  end if;

  v_decision_count := jsonb_array_length(p_decisions);

  if v_decision_count < 1 or v_decision_count > 100 then
    raise exception 'Le lot doit contenir entre 1 et 100 décisions.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_decisions) as decision(value)
    where jsonb_typeof(decision.value) <> 'object'
      or coalesce(decision.value ->> 'candidateId', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or jsonb_typeof(decision.value -> 'accept') <> 'boolean'
      or jsonb_typeof(decision.value -> 'acknowledgedConflicts') <> 'array'
      or jsonb_array_length(decision.value -> 'acknowledgedConflicts') > 40
      or exists (
        select 1
        from jsonb_array_elements(
          decision.value -> 'acknowledgedConflicts'
        ) as conflict(value)
        where jsonb_typeof(conflict.value) <> 'string'
          or length(conflict.value #>> '{}') < 1
          or length(conflict.value #>> '{}') > 300
      )
  ) then
    raise exception 'Une décision du lot est invalide.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_decisions) as decision(value)
    group by decision.value ->> 'candidateId'
    having count(*) > 1
  ) then
    raise exception 'Une convocation ne peut apparaître qu’une fois dans le lot.';
  end if;

  select count(distinct candidate.id)::integer
  into v_eligible_count
  from jsonb_array_elements(p_decisions) as decision(value)
  join public.international_championship_rider_selections as candidate
    on candidate.id = (decision.value ->> 'candidateId')::uuid
   and candidate.response_status = 'pending'
   and candidate.is_selected = true
  join public.sporting_directors as director
    on director.id = candidate.sporting_director_id
   and director.auth_user_id = auth.uid()
   and director.status = 'active';

  if v_eligible_count <> v_decision_count then
    raise exception using
      errcode = '42501',
      message = 'Une convocation a changé ou ne vous appartient pas. Rechargez la page avant de confirmer le lot.';
  end if;

  for v_decision in
    select decision.value
    from jsonb_array_elements(p_decisions) as decision(value)
    order by decision.value ->> 'candidateId'
  loop
    v_candidate_id := (v_decision ->> 'candidateId')::uuid;

    select coalesce(
      array_agg(conflict.value order by conflict.ordinality),
      array[]::text[]
    )
    into v_acknowledged_conflicts
    from jsonb_array_elements_text(
      v_decision -> 'acknowledgedConflicts'
    ) with ordinality as conflict(value, ordinality);

    perform public.respond_to_international_selection_with_conflict_ack(
      v_candidate_id,
      (v_decision ->> 'accept')::boolean,
      v_acknowledged_conflicts
    );
  end loop;

  return v_decision_count;
end;
$$;

revoke all
on function public.respond_to_international_selections_with_conflict_ack(jsonb)
from public, anon;

grant execute
on function public.respond_to_international_selections_with_conflict_ack(jsonb)
to authenticated;

comment on function public.respond_to_international_selections_with_conflict_ack(jsonb)
is 'Valide atomiquement un lot de réponses DS en réutilisant les contrôles de conflits frais de chaque convocation.';

notify pgrst, 'reload schema';

commit;
