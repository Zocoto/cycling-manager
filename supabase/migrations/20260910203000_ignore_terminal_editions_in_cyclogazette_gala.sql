begin;

create or replace function public.prepare_cyclogazette_season_gala(
  p_season_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season record;
  v_pending_stages integer := 0;
  v_pending_editions integer := 0;
  v_award_count integer := 0;
begin
  select id, game_year, status, current_day_number
  into v_season
  from public.seasons
  where id = p_season_id;

  if not found
    or v_season.game_year <> 2
    or v_season.status <> 'active'
    or v_season.current_day_number <> 28 then
    return jsonb_build_object(
      'ready', false,
      'reason', 'not-season-two-final-day',
      'pendingStages', 0,
      'pendingEditions', 0,
      'awardCount', 0
    );
  end if;

  select count(*)::integer
  into v_pending_stages
  from public.stages as stage
  join public.race_editions as edition on edition.id = stage.race_edition_id
  where edition.season_id = p_season_id
    and edition.status not in ('completed', 'cancelled')
    and stage.status not in ('completed', 'cancelled');

  select count(*)::integer
  into v_pending_editions
  from public.race_editions as edition
  where edition.season_id = p_season_id
    and edition.status not in ('completed', 'cancelled');

  if v_pending_stages > 0 or v_pending_editions > 0 then
    return jsonb_build_object(
      'ready', false,
      'reason', 'races-still-pending',
      'pendingStages', v_pending_stages,
      'pendingEditions', v_pending_editions,
      'awardCount', 0
    );
  end if;

  perform private.create_season_awards_for_season(p_season_id);

  select count(*)::integer
  into v_award_count
  from public.season_awards
  where season_id = p_season_id;

  return jsonb_build_object(
    'ready', v_award_count = 5,
    'reason', case when v_award_count = 5 then 'ready' else 'awards-incomplete' end,
    'pendingStages', 0,
    'pendingEditions', 0,
    'awardCount', v_award_count
  );
end;
$$;

revoke all on function public.prepare_cyclogazette_season_gala(uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_cyclogazette_season_gala(uuid)
  to service_role;

comment on function public.prepare_cyclogazette_season_gala(uuid) is
  'Fige les cinq awards J28 après la clôture des éditions, sans bloquer sur un ancien statut d’étape incohérent sous une édition déjà terminale.';

notify pgrst, 'reload schema';

commit;
