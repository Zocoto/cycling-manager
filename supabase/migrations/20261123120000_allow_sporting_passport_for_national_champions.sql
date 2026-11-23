begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- The passport keeps the existing ownership, item lock and country-change transaction.
do $passport_champions$
declare
  v_definition text;
  v_guard constant text := replace($guard$    if exists (select 1 from public.rider_national_championship_titles where rider_id = p_rider_id and championship_type in ('road','time_trial')) then raise exception 'Un ancien champion national ne peut pas changer de nationalité sportive.'; end if;
$guard$, chr(13), '');
  v_target_guard constant text := replace($target$          and not exists (
            select 1
            from public.rider_national_championship_titles as title
            where title.rider_id = rider.id
              and title.championship_type in ('road', 'time_trial')
          )$target$, chr(13), '');
begin
  v_definition := replace(pg_get_functiondef(
    'public.redeem_current_daily_reward_without_high_performance_cap(uuid,uuid,text,text,uuid)'::regprocedure
  ), chr(13), '');
  if strpos(v_definition, 'elsif v_reward.effect_kind = ''naturalization'' then') = 0
    or strpos(v_definition, 'for update of inventory;') = 0
    or length(v_definition) - length(replace(v_definition, v_guard, '')) <> length(v_guard)
  then
    raise exception 'Unexpected sporting passport redemption definition.';
  end if;
  execute replace(v_definition, v_guard, '');

  v_definition := replace(pg_get_functiondef(
    'public.get_current_team_item_target_values()'::regprocedure
  ), chr(13), '');
  if strpos(v_definition, '''canNaturalizeWithPassport''') = 0
    or length(v_definition) - length(replace(v_definition, v_target_guard, '')) <> length(v_target_guard)
  then
    raise exception 'Unexpected sporting passport eligibility definition.';
  end if;
  execute replace(v_definition, v_target_guard, '');
end;
$passport_champions$;

update public.daily_reward_catalog
set description = 'Naturalise immédiatement un coureur vers la nationalité de l’équipe, y compris un ancien ou actuel champion national.',
    effect_summary = 'Naturalisation immédiate · champions nationaux inclus'
where reward_key = 'automatic-naturalization'
  and effect_kind = 'naturalization';

notify pgrst, 'reload schema';
commit;

