begin;

create index if not exists sporting_director_messages_expiry_idx
  on public.sporting_director_messages (sent_at)
  where is_important = false;

create or replace function public.get_current_dashboard_assistant_summary()
returns table (
  game_date date,
  minimum_form integer,
  untreated_injury_count integer,
  low_form_count integer,
  completed_scouting_count integer,
  zero_training_count integer,
  senior_session_count integer,
  senior_completed_count integer,
  senior_skipped_count integer,
  senior_progress_count integer,
  junior_rider_count integer,
  junior_session_count integer,
  junior_progress_count integer,
  auction_count integer,
  daily_auction_count integer,
  director_auction_count integer,
  next_auction_close_at timestamptz,
  pending_selection_count integer,
  pending_direct_offer_count integer,
  contract_renewal_count integer,
  youth_alert_count integer,
  watched_auction_closing_count integer,
  staff_market_count integer,
  preparation_reminder_count integer,
  journal_items jsonb
)
language sql
stable
security definer
set search_path = ''
set statement_timeout = '3000ms'
as $$
  with current_context as (
    select
      director.id as sporting_director_id,
      team.id as team_id,
      team_season.id as team_season_id,
      season.id as season_id,
      season.game_year,
      season.current_day_number,
      season_day.id as season_day_id,
      season_day.calendar_date
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.teams as team
      on team.id = assignment.team_id
     and team.status = 'active'
    join public.seasons as season
      on season.status = 'active'
    join public.team_seasons as team_season
      on team_season.team_id = team.id
     and team_season.season_id = season.id
     and team_season.status = 'active'
    join public.season_days as season_day
      on season_day.season_id = season.id
     and season_day.day_number = season.current_day_number
    where director.auth_user_id = auth.uid()
      and director.status = 'active'
    limit 1
  ),
  active_contracts as materialized (
    select contract.rider_id
    from public.rider_contracts as contract
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
    join public.seasons as end_season
      on end_season.id = contract.end_season_id
    join current_context as context
      on context.team_id = contract.team_id
    where contract.status = 'active'
      and start_season.game_year <= context.game_year
      and end_season.game_year >= context.game_year
  ),
  effective_training_setting as (
    select coalesce((
      select setting.minimum_form
      from public.team_training_setting_versions as setting
      where setting.team_id = context.team_id
        and setting.season_id = context.season_id
        and setting.effective_from_day_number <= context.current_day_number
      order by setting.effective_from_day_number desc, setting.created_at desc
      limit 1
    ), 50)::integer as minimum_form
    from current_context as context
  ),
  latest_training_plans as (
    select distinct on (plan.rider_id)
      plan.rider_id,
      plan.intensity
    from public.rider_training_plan_versions as plan
    join active_contracts as contract
      on contract.rider_id = plan.rider_id
    join current_context as context
      on context.team_id = plan.team_id
     and context.season_id = plan.season_id
    where plan.effective_from_day_number <= context.current_day_number
    order by
      plan.rider_id,
      plan.effective_from_day_number desc,
      plan.created_at desc
  ),
  medical_alerts as (
    select count(*)::integer as untreated_injury_count
    from public.rider_injuries as injury
    join active_contracts as contract
      on contract.rider_id = injury.rider_id
    where injury.status = 'active'
      and injury.expected_recovery_at > now()
      and injury.protocol_code is null
  ),
  form_alerts as (
    select count(*)::integer as low_form_count
    from current_context as context
    cross join effective_training_setting as setting
    join active_contracts as contract on true
    join public.rider_condition_states as condition
      on condition.rider_id = contract.rider_id
     and condition.season_day_id = context.season_day_id
    where condition.form < setting.minimum_form
  ),
  training_alerts as (
    select count(*)::integer as zero_training_count
    from active_contracts as contract
    left join latest_training_plans as plan
      on plan.rider_id = contract.rider_id
    where coalesce(plan.intensity, 0) = 0
  ),
  scouting_alerts as (
    select count(*)::integer as completed_scouting_count
    from public.youth_scouting_missions as mission
    join current_context as context
      on context.team_id = mission.team_id
     and context.season_id = mission.season_id
    where mission.status = 'completed'
      and mission.report_ready_at is not null
      and mission.report_viewed_at is null
  ),
  selection_alerts as (
    select count(*)::integer as pending_selection_count
    from public.international_championship_rider_selections as selection
    join current_context as context
      on context.sporting_director_id = selection.sporting_director_id
    where selection.response_status = 'pending'
      and selection.is_selected = true
  ),
  direct_offer_alerts as (
    select count(*)::integer as pending_direct_offer_count
    from public.direct_transfer_offers as offer
    join current_context as context
      on context.team_id = offer.seller_team_id
     and context.season_id = offer.season_id
    where offer.status = 'pending'
  ),
  contract_alerts as (
    select count(*)::integer as contract_renewal_count
    from active_contracts as active_contract
    join current_context as context on true
    where context.current_day_number >= 21
      and not exists (
        select 1
        from public.rider_contracts as future_contract
        join public.seasons as future_start
          on future_start.id = future_contract.start_season_id
        join public.seasons as future_end
          on future_end.id = future_contract.end_season_id
        where future_contract.rider_id = active_contract.rider_id
          and future_contract.status in ('active', 'planned')
          and future_start.game_year <= context.game_year + 1
          and future_end.game_year >= context.game_year + 1
      )
  ),
  youth_alerts as (
    select count(*)::integer as youth_alert_count
    from public.youth_development_notifications as notification
    join current_context as context
      on context.team_id = notification.team_id
    where notification.read_at is null
  ),
  senior_training as (
    select
      count(session.id)::integer as session_count,
      count(session.id) filter (where session.status = 'completed')::integer
        as completed_count,
      count(session.id) filter (where session.status <> 'completed')::integer
        as skipped_count,
      coalesce(sum((
        select count(*)
        from jsonb_each(session.rating_changes) as rating_change(key, value)
        where jsonb_typeof(rating_change.value) = 'number'
          and (rating_change.value #>> '{}')::numeric > 0
      )), 0)::integer as progress_count
    from current_context as context
    left join public.rider_training_sessions as session
      on session.team_id = context.team_id
     and session.season_id = context.season_id
     and session.season_day_id = context.season_day_id
  ),
  junior_training as (
    select
      count(distinct academy_rider.id)::integer as rider_count,
      count(distinct session.id)::integer as session_count,
      coalesce(sum((
        select count(*)
        from jsonb_each(session.rating_changes) as rating_change(key, value)
        where jsonb_typeof(rating_change.value) = 'number'
          and (rating_change.value #>> '{}')::numeric > 0
      )), 0)::integer as progress_count
    from current_context as context
    left join public.youth_academy_riders as academy_rider
      on academy_rider.team_id = context.team_id
     and academy_rider.status = 'active'
    left join public.youth_academy_training_sessions as session
      on session.academy_rider_id = academy_rider.id
     and session.season_id = context.season_id
     and session.season_day_id = context.season_day_id
  ),
  auction_summary as (
    select
      count(listing.id)::integer as auction_count,
      count(listing.id) filter (where listing.listing_type = 'daily')::integer
        as daily_auction_count,
      count(listing.id) filter (where listing.listing_type = 'director')::integer
        as director_auction_count,
      min(listing.closes_at) as next_auction_close_at
    from current_context as context
    left join public.transfer_market_listings as listing
      on listing.season_id = context.season_id
     and listing.status = 'open'
     and listing.opens_at <= now()
     and listing.closes_at > now()
  ),
  watched_auctions as (
    select count(distinct listing.id)::integer
      as watched_auction_closing_count
    from public.transfer_market_listings as listing
    join current_context as context
      on context.season_id = listing.season_id
    join public.transfer_market_bids as bid
      on bid.listing_id = listing.id
     and bid.team_id = context.team_id
    where listing.status = 'open'
      and listing.opens_at <= now()
      and listing.closes_at > now()
      and listing.closes_at <= now() + interval '2 hours'
  ),
  staff_market as (
    select count(listing.id)::integer as staff_market_count
    from current_context as context
    left join public.staff_market_batches as batch
      on batch.market_date = context.calendar_date
    left join public.staff_market_listings as listing
      on listing.batch_id = batch.id
     and listing.status = 'available'
  ),
  preparation_reminders as (
    select count(distinct registration.race_edition_id)::integer
      as preparation_reminder_count
    from current_context as context
    join public.race_registrations as registration
      on registration.team_season_id = context.team_season_id
     and registration.status = 'accepted'
    join public.stages as stage
      on stage.race_edition_id = registration.race_edition_id
     and stage.status not in ('completed', 'cancelled')
    join public.season_days as stage_day
      on stage_day.id = stage.season_day_id
     and stage_day.day_number between context.current_day_number
       and least(28, context.current_day_number + 1)
    where case
      when stage.stage_type in (
        'individual_time_trial', 'team_time_trial', 'prologue'
      ) then not exists (
        select 1
        from public.race_time_trial_rider_plans as time_trial_plan
        where time_trial_plan.race_registration_id = registration.id
          and time_trial_plan.stage_id = stage.id
      )
      else not exists (
        select 1
        from public.race_stage_strategies as strategy
        where strategy.race_registration_id = registration.id
          and strategy.stage_id = stage.id
      )
    end
  ),
  journal as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', recent_message.id,
          'type', recent_message.message_type,
          'title', recent_message.subject,
          'detail', recent_message.preview,
          'href', recent_message.resolved_href,
          'important', recent_message.is_important,
          'sentAt', recent_message.sent_at,
          'read', recent_message.read_at is not null
        ) order by recent_message.sent_at desc
      ),
      '[]'::jsonb
    ) as items
    from current_context as context
    left join lateral (
      select
        message.id,
        message.message_type,
        message.subject,
        message.preview,
        coalesce(
          message.action_href,
          message.action_links -> 0 ->> 'href',
          '/jeu/messagerie?message=' || message.id::text
        ) as resolved_href,
        message.is_important,
        message.sent_at,
        message.read_at
      from public.sporting_director_messages as message
      where message.sporting_director_id = context.sporting_director_id
        and message.archived_at is null
        and message.sent_at >= now() - interval '30 days'
      order by message.sent_at desc
      limit 12
    ) as recent_message on true
    where recent_message.id is not null
  )
  select
    context.calendar_date,
    setting.minimum_form,
    medical.untreated_injury_count,
    form_alert.low_form_count,
    scouting.completed_scouting_count,
    training_alert.zero_training_count,
    senior.session_count,
    senior.completed_count,
    senior.skipped_count,
    senior.progress_count,
    junior.rider_count,
    junior.session_count,
    junior.progress_count,
    auctions.auction_count,
    auctions.daily_auction_count,
    auctions.director_auction_count,
    auctions.next_auction_close_at,
    selections.pending_selection_count,
    offers.pending_direct_offer_count,
    contracts.contract_renewal_count,
    youth.youth_alert_count,
    watched.watched_auction_closing_count,
    staff_market.staff_market_count,
    preparations.preparation_reminder_count,
    journal.items
  from current_context as context
  cross join effective_training_setting as setting
  cross join medical_alerts as medical
  cross join form_alerts as form_alert
  cross join scouting_alerts as scouting
  cross join selection_alerts as selections
  cross join direct_offer_alerts as offers
  cross join contract_alerts as contracts
  cross join youth_alerts as youth
  cross join training_alerts as training_alert
  cross join senior_training as senior
  cross join junior_training as junior
  cross join auction_summary as auctions
  cross join watched_auctions as watched
  cross join staff_market
  cross join preparation_reminders as preparations
  cross join journal;
$$;

revoke all on function public.get_current_dashboard_assistant_summary()
  from public, anon;
grant execute on function public.get_current_dashboard_assistant_summary()
  to authenticated, service_role;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé opérationnel compact du Bureau : une seule lecture bornée pour les alertes, entraînements et enchères du DS connecté.';

create or replace function public.delete_current_director_message(
  p_message_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.sporting_director_messages as message
  using public.sporting_directors as director
  where message.id = p_message_id
    and director.id = message.sporting_director_id
    and director.auth_user_id = auth.uid();

  return found;
end;
$$;

create or replace function public.delete_current_director_messages(
  p_scope text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_scope not in ('read', 'older_than_7_days', 'all') then
    raise exception 'Mode de nettoyage invalide.';
  end if;

  delete from public.sporting_director_messages as message
  using public.sporting_directors as director
  where director.id = message.sporting_director_id
    and director.auth_user_id = auth.uid()
    and case p_scope
      when 'read' then message.read_at is not null
      when 'older_than_7_days' then message.sent_at < now() - interval '7 days'
      else true
    end;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.purge_expired_director_messages()
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_deleted integer;
begin
  delete from public.sporting_director_messages as message
  where message.is_important = false
    and message.sent_at < now() - interval '30 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.delete_current_director_message(uuid)
  from public, anon;
revoke all on function public.delete_current_director_messages(text)
  from public, anon;
revoke all on function public.purge_expired_director_messages()
  from public, anon, authenticated;
grant execute on function public.delete_current_director_message(uuid)
  to authenticated, service_role;
grant execute on function public.delete_current_director_messages(text)
  to authenticated, service_role;
grant execute on function public.purge_expired_director_messages()
  to service_role;

create or replace function private.create_team_operational_message(
  p_team_id uuid,
  p_message_type text,
  p_sender_name text,
  p_subject text,
  p_preview text,
  p_body text,
  p_action_href text,
  p_action_label text,
  p_source_reference text,
  p_is_important boolean default false,
  p_sent_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
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
  select
    director.id,
    season.id,
    team_season.id,
    p_message_type,
    p_sender_name,
    p_subject,
    left(p_preview, 220),
    p_body,
    p_action_href,
    p_action_label,
    p_source_reference,
    p_is_important,
    coalesce(p_sent_at, now())
  from public.team_manager_assignments as assignment
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where assignment.team_id = p_team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  on conflict (sporting_director_id, source_reference) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function private.create_team_operational_message(
  uuid, text, text, text, text, text, text, text, text, boolean, timestamptz
) from public, anon, authenticated;
grant execute on function private.create_team_operational_message(
  uuid, text, text, text, text, text, text, text, text, boolean, timestamptz
) to service_role;

create or replace function private.notify_completed_equipment_rnd_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_name text;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  select item.name into v_item_name
  from public.equipment_catalog_items as item
  where item.id = new.prototype_equipment_item_id;

  perform private.create_team_operational_message(
    new.team_id,
    'system',
    'Laboratoire R&D',
    'Recherche R&D terminée',
    coalesce(v_item_name, 'Votre nouveau prototype') || ' est disponible.',
    coalesce(v_item_name, 'Votre prototype') || ' a été finalisé avec un résultat de '
      || case when new.rating_delta > 0 then '+' else '' end
      || coalesce(new.rating_delta, 0)::text || ' en '
      || coalesce(new.rating_key, 'caractéristique inconnue') || '.',
    '/jeu/materiel/laboratoire',
    'Voir le prototype',
    'dashboard-rnd-completed:' || new.id::text,
    true,
    coalesce(new.completed_at, now())
  );

  return new;
end;
$$;

drop trigger if exists notify_completed_equipment_rnd_project
  on public.equipment_rnd_projects;
create trigger notify_completed_equipment_rnd_project
after update of status on public.equipment_rnd_projects
for each row execute function private.notify_completed_equipment_rnd_project();

create or replace function private.notify_completed_staff_academy_training()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_name text;
  v_talent_name text;
  v_result text;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  select member.first_name || ' ' || member.last_name
  into v_staff_name
  from public.staff_members as member
  where member.id = new.staff_member_id;

  if new.awarded_talent_code is not null then
    select talent.display_name into v_talent_name
    from public.staff_talent_catalog as talent
    where talent.code = new.awarded_talent_code;
  end if;

  v_result := case
    when new.improvement_type = 'level'
      then 'atteint le niveau ' || (new.previous_level + 1)::text
    else 'débloque le talent « ' || coalesce(v_talent_name, new.awarded_talent_code) || ' »'
  end;

  perform private.create_team_operational_message(
    new.team_id,
    'academy',
    'Académie des métiers',
    'Formation du staff terminée',
    coalesce(v_staff_name, 'Un membre du staff') || ' ' || v_result || '.',
    coalesce(v_staff_name, 'Un membre du staff') || ' a terminé sa formation et ' || v_result || '.',
    '/jeu/infrastructures',
    'Voir l’Académie',
    'dashboard-staff-training-completed:' || new.id::text,
    false,
    coalesce(new.completed_at, now())
  );

  return new;
end;
$$;

drop trigger if exists notify_completed_staff_academy_training
  on public.staff_academy_trainings;
create trigger notify_completed_staff_academy_training
after update of status on public.staff_academy_trainings
for each row execute function private.notify_completed_staff_academy_training();

create or replace function private.notify_recovered_rider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_rider_name text;
begin
  if new.status <> 'recovered' or old.status = 'recovered' then
    return new;
  end if;

  select contract.team_id
  into v_team_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.status = 'active'
  limit 1;

  if v_team_id is null then return new; end if;

  select rider.first_name || ' ' || rider.last_name
  into v_rider_name
  from public.riders as rider
  where rider.id = new.rider_id;

  perform private.create_team_operational_message(
    v_team_id,
    'system',
    'Centre médical',
    'Coureur rétabli',
    coalesce(v_rider_name, 'Votre coureur') || ' est de nouveau disponible.',
    coalesce(v_rider_name, 'Votre coureur') || ' a terminé sa convalescence et peut reprendre la compétition.',
    '/jeu/centre-de-soin?onglet=blessures',
    'Voir le centre médical',
    'dashboard-rider-recovered:' || new.id::text,
    false,
    coalesce(new.recovered_at, now())
  );

  return new;
end;
$$;

drop trigger if exists notify_recovered_rider on public.rider_injuries;
create trigger notify_recovered_rider
after update of status on public.rider_injuries
for each row execute function private.notify_recovered_rider();

create or replace function private.notify_posted_sponsor_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  if new.category <> 'sponsor'
     or new.status <> 'posted'
     or old.status = 'posted' then
    return new;
  end if;

  select team_season.team_id
  into v_team_id
  from public.team_seasons as team_season
  where team_season.id = new.team_season_id;

  if v_team_id is null then return new; end if;

  perform private.create_team_operational_message(
    v_team_id,
    'system',
    'Direction financière',
    'Versement sponsor reçu',
    new.description || ' : ' || round(new.amount)::bigint::text || ' € crédités.',
    new.description || ' a été comptabilisé. Votre trésorerie a été créditée de '
      || round(new.amount)::bigint::text || ' €.',
    '/jeu/finances',
    'Voir les finances',
    'dashboard-sponsor-payment:' || new.id::text,
    false,
    coalesce(new.posted_at, now())
  );

  return new;
end;
$$;

drop trigger if exists notify_posted_sponsor_payment
  on public.team_finance_transactions;
create trigger notify_posted_sponsor_payment
after update of status on public.team_finance_transactions
for each row execute function private.notify_posted_sponsor_payment();

revoke all on function private.notify_completed_equipment_rnd_project()
  from public, anon, authenticated;
revoke all on function private.notify_completed_staff_academy_training()
  from public, anon, authenticated;
revoke all on function private.notify_recovered_rider()
  from public, anon, authenticated;
revoke all on function private.notify_posted_sponsor_payment()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
