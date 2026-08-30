begin;

-- The assistant keeps its single compact RPC. Recruitment matches are folded
-- into the existing JSON payload, while form alerts use the latest condition
-- known on or before the current game day (the same rule as the medical view).
do $migration$
declare
  v_definition text;
  v_previous_form constant text := $previous$
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
$previous$;
  v_replacement_form constant text := $replacement$
  form_alerts as (
    select count(*)::integer as low_form_count
    from current_context as context
    cross join effective_training_setting as setting
    join active_contracts as contract on true
    join lateral (
      select condition.form
      from public.rider_condition_states as condition
      join public.season_days as condition_day
        on condition_day.id = condition.season_day_id
      where condition.rider_id = contract.rider_id
        and condition_day.season_id = context.season_id
        and condition_day.day_number <= context.current_day_number
      order by condition_day.day_number desc, condition.updated_at desc
      limit 1
    ) as latest_condition on true
    where latest_condition.form < setting.minimum_form
  ),
$replacement$;
  v_previous_journal constant text := $previous$
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
$previous$;
  v_replacement_journal constant text := $replacement$
  journal_source as (
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
  ),
  recruitment_matches as (
    select
      (
        select count(*)::integer
        from public.transfer_market_listings as listing
        where listing.season_id = context.season_id
          and listing.status = 'open'
          and listing.opens_at <= now()
          and listing.closes_at > now()
          and exists (
            select 1
            from public.sporting_director_messages as message
            where message.sporting_director_id = context.sporting_director_id
              and message.archived_at is null
              and message.source_reference =
                'recruitment-alert:rider:' || listing.id::text
          )
      ) as rider_recruitment_match_count,
      (
        select count(*)::integer
        from public.staff_market_listings as listing
        join public.staff_market_batches as batch
          on batch.id = listing.batch_id
        where batch.market_date = context.calendar_date
          and listing.status = 'available'
          and exists (
            select 1
            from public.sporting_director_messages as message
            where message.sporting_director_id = context.sporting_director_id
              and message.archived_at is null
              and message.source_reference =
                'recruitment-alert:staff:' || listing.id::text
          )
      ) as staff_recruitment_match_count
    from current_context as context
  ),
  journal as (
    select jsonb_build_object(
      'items', source.items,
      'riderRecruitmentMatchCount', matches.rider_recruitment_match_count,
      'staffRecruitmentMatchCount', matches.staff_recruitment_match_count
    ) as items
    from journal_source as source
    cross join recruitment_matches as matches
  )
$replacement$;
begin
  select pg_get_functiondef(
    'public.get_current_dashboard_assistant_summary()'::regprocedure
  ) into v_definition;

  if strpos(v_definition, v_previous_form) = 0 then
    raise exception
      'Le bloc de forme du résumé du Bureau est introuvable.';
  end if;

  if strpos(v_definition, v_previous_journal) = 0 then
    raise exception
      'Le bloc du journal du résumé du Bureau est introuvable.';
  end if;

  v_definition := replace(
    v_definition,
    v_previous_form,
    v_replacement_form
  );
  v_definition := replace(
    v_definition,
    v_previous_journal,
    v_replacement_journal
  );

  execute v_definition;
end;
$migration$;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé opérationnel compact du Bureau. Les correspondances de recrutement actives sont incluses sans appel supplémentaire et la forme repose sur le dernier état quotidien disponible.';

notify pgrst, 'reload schema';

commit;
