-- Une inscription DevTeam peut rester techniquement "registered" alors que
-- l'édition est déjà terminée (notamment sur les championnats juniors gérés
-- par une fédération). Elle ne doit pas empêcher une promotion immédiate.
--
-- On conserve en revanche le verrou pendant une course réellement en cours :
-- un tour reste bloquant jusqu'à son classement général final, et une course
-- d'un jour jusqu'à la publication de son résultat général.

begin;

do $migration$
declare
  v_definition text;
  v_previous_guard constant text := $previous_guard$
  if v_development_team_id is not null and exists (
    select 1
    from public.development_race_registration_riders as selected
    join public.development_race_registrations as registration
      on registration.id = selected.registration_id
    join public.development_race_editions as edition
      on edition.id = registration.race_edition_id
    where registration.development_team_id = v_development_team_id
      and registration.status = 'registered'
      and selected.academy_rider_id = v_academy.id
      and edition.start_day_number <= v_context.current_day_number
  ) then
    raise exception 'Ce junior dispute actuellement une épreuve de Development Team. Attendez la publication des résultats.';
  end if;
$previous_guard$;
  v_current_guard constant text := $current_guard$
  if v_development_team_id is not null and exists (
    select 1
    from public.development_race_registration_riders as selected
    join public.development_race_registrations as registration
      on registration.id = selected.registration_id
    join public.development_race_editions as edition
      on edition.id = registration.race_edition_id
    where registration.development_team_id = v_development_team_id
      and registration.status = 'registered'
      and selected.academy_rider_id = v_academy.id
      and edition.status = 'planned'
      and edition.start_day_number <= v_context.current_day_number
      and (
        (
          edition.race_format = 'stage_race'
          and edition.end_day_number > v_context.current_day_number
        )
        or not exists (
          select 1
          from public.development_race_results as result
          where result.race_edition_id = edition.id
            and result.academy_rider_id = v_academy.id
            and result.result_scope = 'general'
        )
      )
  ) then
    raise exception 'Ce junior dispute actuellement une épreuve de Development Team. Attendez la publication des résultats.';
  end if;
$current_guard$;
begin
  select pg_get_functiondef(
    'public.redeem_instant_youth_promotion_reward(uuid,uuid)'::regprocedure
  )
  into v_definition;

  if v_definition is null then
    raise exception 'La fonction de promotion immédiate est introuvable.';
  end if;

  -- Les migrations historiques ont été poussées depuis Windows et PostgreSQL
  -- en conserve parfois les CRLF dans prosrc. Normaliser avant la comparaison
  -- évite de remplacer la fonction sur une correspondance approximative.
  v_definition := replace(v_definition, E'\r\n', E'\n');

  -- Rend la migration idempotente lors des restaurations et répétitions locales.
  if strpos(v_definition, v_current_guard) > 0 then
    return;
  end if;

  if strpos(v_definition, v_previous_guard) = 0 then
    raise exception
      'Le verrou DevTeam attendu n''a pas été trouvé dans la fonction de promotion immédiate.';
  end if;

  execute replace(v_definition, v_previous_guard, v_current_guard);
end;
$migration$;

comment on function public.redeem_instant_youth_promotion_reward(uuid, uuid) is
  'Promeut atomiquement un junior avec un Contrat Espoir, conserve ses résultats déjà publiés et le retire de la DevTeam ainsi que de toutes ses inscriptions futures.';

notify pgrst, 'reload schema';

commit;
