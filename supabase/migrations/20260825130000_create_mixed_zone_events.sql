begin;

alter table public.post_race_interviews
  add column if not exists event_choice_id text,
  add column if not exists event_outcome jsonb,
  add column if not exists event_resolved_at timestamptz;

alter table public.post_race_interviews
  drop constraint if exists post_race_interviews_event_outcome_object;
alter table public.post_race_interviews
  add constraint post_race_interviews_event_outcome_object
  check (event_outcome is null or jsonb_typeof(event_outcome) = 'object');

alter table public.reward_events
  drop constraint if exists reward_events_source_type_allowed;
alter table public.reward_events
  add constraint reward_events_source_type_allowed check (
    source_type in (
      'race_result', 'stage_result', 'mountain_prime',
      'intermediate_sprint', 'secondary_classification',
      'game_objective', 'sponsor_objective', 'division_bonus',
      'special_ability', 'staff_daily', 'mixed_zone_event'
    )
  );

alter table public.reward_events
  drop constraint if exists reward_events_values_non_negative;
alter table public.reward_events
  add constraint reward_events_values_valid check (
    reputation_points between -50 and 1000
    and experience_points >= 0
    and cash_prize >= 0
    and uci_points >= 0
  );

create or replace function public.submit_post_race_interview_with_event(
  p_auth_user_id uuid,
  p_interview_id uuid,
  p_answers jsonb,
  p_closing_note text,
  p_event_choice_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_event jsonb;
  v_choice jsonb;
  v_outcome jsonb;
  v_resolution jsonb;
  v_answer_objects jsonb := '[]'::jsonb;
  v_question jsonb;
  v_answer text;
  v_choice_label text;
  v_expected_answer_count integer;
  v_total_weight integer := 0;
  v_cumulative_weight integer := 0;
  v_roll numeric := 0;
  v_index integer;
  v_reputation_delta integer := 0;
  v_applied_reputation_delta integer := 0;
  v_cash_delta integer := 0;
  v_popularity_delta integer := 0;
  v_inventory_item_key text;
  v_inventory_item_id uuid;
  v_rider_id uuid;
  v_new_reputation integer;
  v_now timestamptz := now();
begin
  if p_auth_user_id is null or p_interview_id is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;
  if jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Les réponses de l’interview sont invalides.';
  end if;
  if char_length(coalesce(btrim(p_closing_note), '')) > 500 then
    raise exception 'Le dernier mot ne peut pas dépasser 500 caractères.';
  end if;

  select
    interview.status as interview_status,
    interview.question_set,
    interview.context as interview_context,
    interview.event_choice_id,
    director.id as director_id,
    director.reputation_points,
    interview.team_id,
    interview.season_id,
    team_season.id as team_season_id,
    team_season.cash_balance,
    season_day.id as season_day_id,
    season_day.day_number,
    season_day.calendar_date
  into v_context
  from public.post_race_interviews as interview
  join public.sporting_directors as director
    on director.id = interview.sporting_director_id
  join public.team_seasons as team_season
    on team_season.team_id = interview.team_id
   and team_season.season_id = interview.season_id
  join public.stages as stage on stage.id = interview.stage_id
  join public.season_days as season_day on season_day.id = stage.season_day_id
  where interview.id = p_interview_id
    and director.auth_user_id = p_auth_user_id
    and director.status = 'active'
  for update of interview, director, team_season;

  if v_context is null then
    raise exception using errcode = '42501', message = 'Cette interview ne vous appartient pas ou n’existe plus.';
  end if;
  if v_context.interview_status = 'submitted' then
    return jsonb_build_object('interviewId', p_interview_id, 'alreadySubmitted', true);
  end if;
  if v_context.interview_status <> 'pending'
    or v_context.calendar_date < (v_now at time zone 'Europe/Paris')::date
    or (
      v_context.calendar_date = (v_now at time zone 'Europe/Paris')::date
      and (v_now at time zone 'Europe/Paris')::time >= time '20:00'
    ) then
    raise exception 'La zone mixte est fermée : l’interview est disponible uniquement le jour de la course, avant 20 h.';
  end if;
  if jsonb_typeof(v_context.question_set) <> 'array'
    or jsonb_array_length(v_context.question_set) <> 3 then
    raise exception 'Les questions de cette interview sont invalides.';
  end if;

  v_event := v_context.interview_context -> 'zoneMixteEvent';
  v_expected_answer_count := case
    when jsonb_typeof(v_event) = 'object' then 2
    else 3
  end;
  if jsonb_array_length(p_answers) <> v_expected_answer_count then
    raise exception 'Toutes les réponses de l’interview sont attendues.';
  end if;

  for v_index in 0..v_expected_answer_count - 1 loop
    v_question := v_context.question_set -> v_index;
    v_answer := btrim(p_answers ->> v_index);
    if v_answer is null or char_length(v_answer) < 2 or char_length(v_answer) > 600 then
      raise exception 'Chaque réponse doit contenir entre 2 et 600 caractères.';
    end if;
    v_answer_objects := v_answer_objects || jsonb_build_array(jsonb_build_object(
      'questionId', v_question ->> 'id',
      'question', v_question ->> 'text',
      'answer', v_answer
    ));
  end loop;

  if jsonb_typeof(v_event) = 'object' then
    if p_event_choice_id is null or btrim(p_event_choice_id) = '' then
      raise exception 'Choisissez une réaction ou décidez de ne pas réagir.';
    end if;

    if p_event_choice_id = 'skip' then
      v_choice_label := 'Ne pas réagir';
      v_outcome := jsonb_build_object(
        'weight', 100,
        'summary', 'Le DS a choisi de ne pas réagir. Aucun effet.'
      );
    else
      select candidate.value
      into v_choice
      from jsonb_array_elements(v_event -> 'choices') as candidate(value)
      where candidate.value ->> 'id' = p_event_choice_id
      limit 1;
      if v_choice is null then
        raise exception 'Cette réaction n’est pas proposée pour cet événement.';
      end if;
      v_choice_label := v_choice ->> 'label';
      select coalesce(sum((candidate.value ->> 'weight')::integer), 0)
      into v_total_weight
      from jsonb_array_elements(v_choice -> 'outcomes') as candidate(value);
      if v_total_weight <= 0 then
        raise exception 'Les conséquences de cet événement sont invalides.';
      end if;
      v_roll := random() * v_total_weight;
      for v_outcome in
        select candidate.value
        from jsonb_array_elements(v_choice -> 'outcomes') as candidate(value)
      loop
        v_cumulative_weight := v_cumulative_weight
          + coalesce((v_outcome ->> 'weight')::integer, 0);
        exit when v_roll < v_cumulative_weight;
      end loop;
    end if;

    v_reputation_delta := coalesce((v_outcome ->> 'reputationDelta')::integer, 0);
    v_cash_delta := coalesce((v_outcome ->> 'cashDelta')::integer, 0);
    v_popularity_delta := coalesce((v_outcome ->> 'riderPopularityDelta')::integer, 0);
    v_inventory_item_key := nullif(v_outcome ->> 'inventoryItemKey', '');
    if v_reputation_delta not between -4 and 4
      or v_cash_delta not between -6000 and 5000
      or v_popularity_delta not between -3 and 5 then
      raise exception 'Les conséquences de cet événement dépassent le barème autorisé.';
    end if;
    if v_inventory_item_key is not null
      and v_inventory_item_key <> 'acceleration-focus' then
      raise exception 'Cet objet ne fait pas partie des récompenses légères autorisées.';
    end if;

    if v_cash_delta < 0 and v_context.cash_balance < abs(v_cash_delta) then
      raise exception 'La trésorerie de l’équipe est insuffisante pour cette réaction.';
    end if;
    if v_cash_delta <> 0 then
      update public.team_seasons
      set cash_balance = cash_balance + v_cash_delta
      where id = v_context.team_season_id;
      insert into public.team_finance_transactions (
        team_season_id, season_day_id, day_number, amount, category,
        status, description, source_reference, posted_at
      ) values (
        v_context.team_season_id,
        v_context.season_day_id,
        v_context.day_number,
        v_cash_delta,
        'other',
        'posted',
        'Zone mixte — ' || (v_event ->> 'title'),
        'mixed-zone:' || p_interview_id::text,
        v_now
      );
    end if;

    if v_reputation_delta <> 0 then
      v_new_reputation := least(
        1000,
        greatest(0, v_context.reputation_points + v_reputation_delta)
      );
      v_applied_reputation_delta := v_new_reputation - v_context.reputation_points;
      update public.sporting_directors
      set reputation_points = v_new_reputation
      where id = v_context.director_id;
      insert into public.reward_events (
        source_reference, source_type, sporting_director_id,
        team_season_id, rider_id, reputation_points,
        experience_points, cash_prize, uci_points, description
      ) values (
        'mixed-zone:' || p_interview_id::text,
        'mixed_zone_event',
        v_context.director_id,
        v_context.team_season_id,
        nullif(v_context.interview_context ->> 'riderId', '')::uuid,
        v_applied_reputation_delta,
        0,
        0,
        0,
        'Zone mixte — ' || (v_event ->> 'title')
      );
    end if;

    v_rider_id := nullif(v_context.interview_context ->> 'riderId', '')::uuid;
    if v_popularity_delta <> 0 and v_rider_id is not null then
      insert into public.rider_popularity_profiles (
        rider_id, popularity_points, updated_at
      ) values (
        v_rider_id, greatest(0, v_popularity_delta), v_now
      )
      on conflict (rider_id) do update
      set
        popularity_points = greatest(
          0,
          public.rider_popularity_profiles.popularity_points + v_popularity_delta
        ),
        updated_at = v_now;
    end if;

    if v_inventory_item_key is not null then
      select item.id
      into v_inventory_item_id
      from public.inventory_catalog_items as item
      where item.item_key = v_inventory_item_key
        and item.rarity in ('common', 'uncommon')
        and item.status = 'active'
      limit 1;
      if v_inventory_item_id is null then
        raise exception 'La récompense légère de cet événement est indisponible.';
      end if;
      insert into public.team_item_inventory (
        team_season_id, inventory_item_id, quantity,
        acquisition_source, acquired_at, updated_at
      ) values (
        v_context.team_season_id,
        v_inventory_item_id,
        1,
        'zone_mixte',
        v_now,
        v_now
      )
      on conflict (team_season_id, inventory_item_id) do update
      set
        quantity = public.team_item_inventory.quantity + 1,
        acquisition_source = excluded.acquisition_source,
        acquired_at = excluded.acquired_at,
        updated_at = excluded.updated_at;
    end if;

    v_question := v_context.question_set -> 2;
    v_answer_objects := v_answer_objects || jsonb_build_array(jsonb_build_object(
      'questionId', v_question ->> 'id',
      'question', v_question ->> 'text',
      'answer', 'Décision : ' || v_choice_label || '. ' || (v_outcome ->> 'summary')
    ));
    v_resolution := jsonb_build_object(
      'choiceId', p_event_choice_id,
      'choiceLabel', v_choice_label,
      'outcome', v_outcome
    );
  elsif p_event_choice_id is not null then
    raise exception 'Cette interview ne contient pas d’événement à résoudre.';
  end if;

  update public.post_race_interviews
  set
    answers = v_answer_objects,
    closing_note = nullif(btrim(p_closing_note), ''),
    status = 'submitted',
    submitted_at = v_now,
    updated_at = v_now,
    event_choice_id = case when jsonb_typeof(v_event) = 'object' then p_event_choice_id else null end,
    event_outcome = v_resolution,
    event_resolved_at = case when jsonb_typeof(v_event) = 'object' then v_now else null end
  where id = p_interview_id;

  return jsonb_build_object('interviewId', p_interview_id, 'alreadySubmitted', false);
end;
$$;

revoke all on function public.submit_post_race_interview_with_event(
  uuid, uuid, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.submit_post_race_interview_with_event(
  uuid, uuid, jsonb, text, text
) to service_role;

comment on function public.submit_post_race_interview_with_event(
  uuid, uuid, jsonb, text, text
) is
  'Valide une interview et applique atomiquement les conséquences bornées de son éventuel événement de zone mixte.';

-- L’évaluation intermédiaire reste nécessaire pour faire progresser les
-- objectifs, mais aucune pénalité de réputation ne doit être encaissée avant
-- la clôture de la saison.
do $migration$
declare
  v_definition text;
  v_lower_definition text;
  v_branch_start integer;
  v_branch_end_relative integer;
  v_branch_length integer;
  v_branch text;
  v_patched_definition text;
  v_new text := $new$
  if not p_finalize then
    declare
      v_live_director_id uuid;
      v_temporary_penalty integer := 0;
    begin
      perform public.evaluate_sponsor_objectives_for_contract_legacy_20260813(
        p_contract_id,
        false
      );

      select assignment.sporting_director_id
      into v_live_director_id
      from public.team_sponsor_contracts as live_contract
      join public.team_manager_assignments as assignment
        on assignment.team_id = live_contract.team_id
       and assignment.role = 'general_manager'
       and assignment.status = 'active'
      where live_contract.id = p_contract_id
      limit 1;

      select coalesce(sum(progress.reputation_penalty), 0)::integer
      into v_temporary_penalty
      from public.objective_progress as progress
      where progress.team_sponsor_contract_id = p_contract_id;

      if v_live_director_id is not null and v_temporary_penalty > 0 then
        update public.sporting_directors
        set reputation_points = least(1000, reputation_points + v_temporary_penalty)
        where id = v_live_director_id;
      end if;

      update public.objective_progress
      set
        reputation_penalty = 0,
        details = details - 'reputationPenalty',
        updated_at = now()
      where team_sponsor_contract_id = p_contract_id
        and reputation_penalty <> 0;
    end;
    return;
  end if;
$new$;
begin
  select pg_get_functiondef(
    'public.evaluate_sponsor_objectives_for_contract(uuid, boolean)'::regprocedure
  ) into v_definition;
  if position('v_temporary_penalty integer := 0;' in v_definition) > 0 then
    return;
  end if;

  -- pg_get_functiondef normalise les espaces et la casse selon la version de
  -- PostgreSQL. On remplace uniquement la première branche `not p_finalize`
  -- après avoir vérifié qu'elle appelle bien le moteur historique attendu.
  v_lower_definition := lower(v_definition);
  v_branch_start := position('if not p_finalize then' in v_lower_definition);
  if v_branch_start = 0 then
    raise exception 'La fonction d’évaluation sponsor a changé : correction de clôture interrompue.';
  end if;

  v_branch_end_relative := position(
    'end if;' in substring(v_lower_definition from v_branch_start)
  );
  if v_branch_end_relative = 0 then
    raise exception 'Branche intermédiaire sponsor invalide : correction de clôture interrompue.';
  end if;

  v_branch_length := v_branch_end_relative + char_length('end if;') - 1;
  v_branch := substring(v_lower_definition from v_branch_start for v_branch_length);
  if position(
    'evaluate_sponsor_objectives_for_contract_legacy_20260813' in v_branch
  ) = 0 or position('false' in v_branch) = 0 then
    raise exception 'Moteur sponsor intermédiaire inattendu : correction de clôture interrompue.';
  end if;

  v_patched_definition := overlay(
    v_definition placing v_new from v_branch_start for v_branch_length
  );
  execute v_patched_definition;
end;
$migration$;

-- Répare immédiatement les pénalités temporaires encore portées par les
-- contrats actifs, sans toucher à une pénalité agrégée déjà clôturée.
with temporary_refunds as (
  select
    assignment.sporting_director_id,
    sum(progress.reputation_penalty)::integer as points
  from public.objective_progress as progress
  join public.team_sponsor_contracts as contract
    on contract.id = progress.team_sponsor_contract_id
   and contract.status = 'active'
  join public.team_manager_assignments as assignment
    on assignment.team_id = contract.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  where progress.reputation_penalty > 0
  group by assignment.sporting_director_id
)
update public.sporting_directors as director
set reputation_points = least(1000, director.reputation_points + refund.points)
from temporary_refunds as refund
where director.id = refund.sporting_director_id;

update public.objective_progress as progress
set
  reputation_penalty = 0,
  details = details - 'reputationPenalty',
  updated_at = now()
from public.team_sponsor_contracts as contract
where contract.id = progress.team_sponsor_contract_id
  and contract.status = 'active'
  and progress.reputation_penalty <> 0;

comment on function public.evaluate_sponsor_objectives_for_contract(uuid, boolean) is
  'Met à jour les objectifs en cours sans pénalité temporaire ; le barème agrégé de 10 points par objectif manquant sous 50 % ne s’applique qu’à la clôture de saison.';

notify pgrst, 'reload schema';

commit;
