begin;

-- ============================================================
-- MORAL CONTEXTUEL : PRESTIGE, RANG UCI ET ATTENTES
-- ============================================================

create or replace function public.get_contextual_result_morale_delta(
  p_category_code text,
  p_uci_rank integer,
  p_finish_rank integer,
  p_result_status text,
  p_scope text
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_prestige integer;
  v_tier integer;
  v_rank integer := coalesce(p_finish_rank, 32767);
  v_classified boolean := lower(coalesce(p_result_status, '')) in (
    'finished', 'classified'
  );
  v_win_delta numeric := 0;
  v_bad_threshold integer;
  v_negative_delta numeric := 0;
begin
  if p_scope not in ('stage', 'one_day', 'gc') then
    return 0;
  end if;

  v_prestige := case lower(coalesce(p_category_code, ''))
    when 'elite' then 5
    when 'world' then 4
    when 'continental' then 3
    when 'national' then 2
    when 'regional' then 1
    when 'local' then 0
    else 2
  end;

  v_tier := case
    when p_uci_rank between 1 and 10 then 5
    when p_uci_rank between 11 and 25 then 4
    when p_uci_rank between 26 and 50 then 3
    when p_uci_rank between 51 and 100 then 2
    when p_uci_rank between 101 and 200 then 1
    else 0
  end;

  if v_classified then
    v_win_delta := case v_tier
      when 5 then case v_prestige
        when 5 then 5 when 4 then 3 when 3 then 1 else 0 end
      when 4 then case v_prestige
        when 5 then 5 when 4 then 4 when 3 then 2 when 2 then 1 else 0 end
      when 3 then case v_prestige
        when 5 then 5 when 4 then 4 when 3 then 3 when 2 then 2
        when 1 then 1 else 0 end
      when 2 then case v_prestige
        when 5 then 5 when 4 then 4 when 3 then 4 when 2 then 3
        when 1 then 2 else 1 end
      when 1 then case v_prestige
        when 5 then 5 when 4 then 5 when 3 then 4 when 2 then 4
        when 1 then 3 else 2 end
      else case v_prestige
        when 5 then 5 when 4 then 5 when 3 then 5 when 2 then 4
        when 1 then 4 else 3 end
    end;

    if p_scope = 'stage' then
      v_win_delta := round(v_win_delta * 1.2) / 2;
    end if;

    if v_rank = 1 then
      return v_win_delta;
    end if;

    if v_rank between 2 and 3 then
      if p_scope = 'stage' then
        return case
          when v_win_delta >= 2.5 then v_win_delta - 1.5
          when v_win_delta >= 1.5 then 0.5
          else 0
        end;
      end if;
      return case
        when v_win_delta >= 4 then v_win_delta - 2
        when v_win_delta >= 2 then 1
        else 0
      end;
    end if;

    if v_rank between 4 and 5 then
      if v_prestige >= v_tier then
        return case when p_scope = 'stage' then 0.5 else 1 end;
      end if;
      if v_tier <= 3 and v_prestige = v_tier - 1 then
        return 0.5;
      end if;
    end if;

    if v_rank between 6 and 10 then
      if v_prestige >= v_tier + 1 then
        return case when p_scope = 'stage' then 0.5 else 1 end;
      end if;
      if v_tier <= 1 and v_prestige >= v_tier then
        return 0.5;
      end if;
    end if;

    if v_rank between 11 and 20
       and p_scope <> 'stage'
       and v_tier = 0
       and v_prestige >= 1 then
      return 0.5;
    end if;
  end if;

  -- Une étape isolée d'un tour ne sanctionne jamais : la déception se mesure
  -- au terme de l'épreuve afin de ne pas empiler les malus jour après jour.
  if p_scope = 'stage' then
    return 0;
  end if;

  if v_tier = 5 then
    v_bad_threshold := case v_prestige
      when 5 then 30 when 4 then 20 when 3 then 15 when 2 then 10
      when 1 then 5 else 3 end;
    v_negative_delta := case v_prestige
      when 5 then -2 when 4 then -3 when 3 then -3 else -4 end;
  elsif v_tier = 4 then
    v_bad_threshold := case v_prestige
      when 5 then 45 when 4 then 30 when 3 then 20 when 2 then 15
      when 1 then 10 else 5 end;
    v_negative_delta := case v_prestige
      when 5 then -1 when 4 then -2 else -3 end;
  elsif v_tier = 3 and v_prestige <= 4 then
    v_bad_threshold := case v_prestige
      when 4 then 50 when 3 then 30 when 2 then 25 when 1 then 15 else 10 end;
    v_negative_delta := case when v_prestige = 4 then -1 else -2 end;
  elsif v_tier = 2 and v_prestige <= 3 then
    v_bad_threshold := case v_prestige
      when 3 then 60 when 2 then 40 when 1 then 25 else 15 end;
    v_negative_delta := case when v_prestige = 0 then -2 else -1 end;
  end if;

  if v_bad_threshold is not null
     and (not v_classified or v_rank > v_bad_threshold) then
    return v_negative_delta;
  end if;

  return 0;
end;
$$;

create or replace function public.get_teammate_win_morale_delta(
  p_category_code text,
  p_uci_rank integer,
  p_scope text
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_prestige integer;
begin
  v_prestige := case lower(coalesce(p_category_code, ''))
    when 'elite' then 5 when 'world' then 4 when 'continental' then 3
    when 'national' then 2 when 'regional' then 1 when 'local' then 0
    else 2
  end;

  if p_scope = 'stage' then
    if coalesce(p_uci_rank, 10000) > 100 then return 0.5; end if;
    if coalesce(p_uci_rank, 10000) > 50 and v_prestige >= 3 then return 0.5; end if;
    return 0;
  end if;

  if coalesce(p_uci_rank, 10000) > 200 then
    return case when v_prestige >= 4 then 1.5 else 1 end;
  end if;
  if p_uci_rank > 100 then
    return case when v_prestige >= 3 then 1.5 else 1 end;
  end if;
  if p_uci_rank > 50 then
    return case when v_prestige >= 3 then 1 else 0.5 end;
  end if;
  if p_uci_rank > 25 and v_prestige >= 4 then return 0.5; end if;
  return 0;
end;
$$;

create or replace function public.get_favorite_race_morale_delta(
  p_category_code text,
  p_uci_rank integer,
  p_result_status text
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_prestige integer;
  v_tier integer;
begin
  if lower(coalesce(p_result_status, '')) <> 'classified' then return 0; end if;
  v_prestige := case lower(coalesce(p_category_code, ''))
    when 'elite' then 5 when 'world' then 4 when 'continental' then 3
    when 'national' then 2 when 'regional' then 1 when 'local' then 0
    else 2
  end;
  v_tier := case
    when p_uci_rank between 1 and 10 then 5
    when p_uci_rank between 11 and 25 then 4
    when p_uci_rank between 26 and 50 then 3
    when p_uci_rank between 51 and 100 then 2
    when p_uci_rank between 101 and 200 then 1
    else 0
  end;
  return case when v_prestige >= v_tier then 1 else 0 end;
end;
$$;

comment on function public.get_contextual_result_morale_delta(
  text, integer, integer, text, text
) is
  'Calibre le moral selon le résultat, le prestige, le rang UCI et les attentes.';

create or replace function public.apply_stage_result_morale()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_stage_count integer;
  v_scope text;
  v_delta numeric;
  v_description text;
  v_teammate record;
  v_teammate_delta numeric;
begin
  select
    roster.rider_id,
    roster.race_registration_id,
    stage.season_day_id,
    stage.race_edition_id,
    stage.name as stage_name,
    edition.season_id,
    edition.display_name as race_name,
    category.code as category_code,
    category.name as category_name,
    summary.uci_rank,
    btrim(concat_ws(' ', rider.first_name, rider.last_name)) as rider_name
  into v_context
  from public.race_rosters as roster
  join public.riders as rider on rider.id = roster.rider_id
  join public.stages as stage on stage.id = new.stage_id
  join public.race_editions as edition on edition.id = stage.race_edition_id
  join public.race_categories as category on category.id = edition.race_category_id
  left join public.rider_season_summaries as summary
    on summary.rider_id = roster.rider_id
   and summary.season_id = edition.season_id
  where roster.id = new.race_roster_id;

  if v_context.rider_id is null or v_context.season_day_id is null then
    return new;
  end if;

  select count(*)::integer
  into v_stage_count
  from public.stages as stage
  where stage.race_edition_id = v_context.race_edition_id;
  v_scope := case when v_stage_count = 1 then 'one_day' else 'stage' end;

  v_delta := public.get_contextual_result_morale_delta(
    v_context.category_code,
    v_context.uci_rank,
    new.rank,
    new.status,
    v_scope
  );

  if v_delta <> 0 then
    v_description := case
      when v_delta < 0 and new.status <> 'finished'
        then 'Abandon décevant alors qu’il faisait partie des favoris — '
      when v_delta < 0
        then 'Résultat en dessous des attentes d’un favori — '
      when new.rank = 1 and coalesce(v_context.uci_rank, 10000) > 100
        then 'Victoire inattendue et pleine de confiance — '
      when new.rank = 1 and v_context.category_code = 'elite'
        then 'Victoire de prestige — '
      when new.rank = 1
        then 'Victoire à la hauteur du défi — '
      when new.rank between 2 and 3
        then 'Podium remarquable — '
      else 'Place d’honneur encourageante — '
    end || coalesce(
      case when v_scope = 'stage' then v_context.stage_name else v_context.race_name end,
      'course'
    );

    perform public.apply_rider_morale_event(
      v_context.rider_id,
      v_context.season_day_id,
      'stage_result',
      new.id::text,
      v_delta,
      v_description,
      jsonb_build_object(
        'stageResultId', new.id,
        'rank', new.rank,
        'status', new.status,
        'categoryCode', v_context.category_code,
        'categoryName', v_context.category_name,
        'uciRank', v_context.uci_rank,
        'scope', v_scope,
        'expectationModel', 'category-uci-v1'
      )
    );
  end if;

  if new.status = 'finished' and new.rank = 1 then
    for v_teammate in
      select
        teammate.rider_id,
        teammate_summary.uci_rank
      from public.race_rosters as teammate
      left join public.rider_season_summaries as teammate_summary
        on teammate_summary.rider_id = teammate.rider_id
       and teammate_summary.season_id = v_context.season_id
      where teammate.race_registration_id = v_context.race_registration_id
        and teammate.rider_id <> v_context.rider_id
        and teammate.status not in ('withdrawn', 'did_not_start')
    loop
      v_teammate_delta := public.get_teammate_win_morale_delta(
        v_context.category_code,
        v_teammate.uci_rank,
        v_scope
      );
      if v_teammate_delta <> 0 then
        perform public.apply_rider_morale_event(
          v_teammate.rider_id,
          v_context.season_day_id,
          'stage_result',
          'team-win:' || new.stage_id::text,
          v_teammate_delta,
          'La victoire de ' || coalesce(v_context.rider_name, 'son coéquipier')
            || ' renforce la confiance du collectif — '
            || coalesce(v_context.stage_name, v_context.race_name, 'course'),
          jsonb_build_object(
            'stageResultId', new.id,
            'winnerRiderId', v_context.rider_id,
            'teamVictory', true,
            'categoryCode', v_context.category_code,
            'uciRank', v_teammate.uci_rank,
            'scope', v_scope,
            'expectationModel', 'category-uci-v1'
          )
        );
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists stage_results_apply_morale on public.stage_results;
create trigger stage_results_apply_morale
after insert on public.stage_results
for each row execute function public.apply_stage_result_morale();

create or replace function public.apply_race_result_morale()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_stage_count integer;
  v_delta numeric;
  v_favorite_delta numeric;
  v_description text;
  v_teammate record;
  v_teammate_delta numeric;
begin
  select
    roster.rider_id,
    roster.race_registration_id,
    edition.race_id,
    edition.season_id,
    edition.display_name,
    category.code as category_code,
    category.name as category_name,
    summary.uci_rank,
    last_stage.season_day_id,
    btrim(concat_ws(' ', rider.first_name, rider.last_name)) as rider_name
  into v_context
  from public.race_rosters as roster
  join public.riders as rider on rider.id = roster.rider_id
  join public.race_editions as edition on edition.id = new.race_edition_id
  join public.race_categories as category on category.id = edition.race_category_id
  left join public.rider_season_summaries as summary
    on summary.rider_id = roster.rider_id
   and summary.season_id = edition.season_id
  left join lateral (
    select stage.season_day_id
    from public.stages as stage
    where stage.race_edition_id = edition.id
    order by stage.stage_number desc
    limit 1
  ) as last_stage on true
  where roster.id = new.race_roster_id;

  if v_context.rider_id is null or v_context.season_day_id is null then
    return new;
  end if;

  select count(*)::integer
  into v_stage_count
  from public.stages as stage
  where stage.race_edition_id = new.race_edition_id;

  if v_stage_count > 1 then
    v_delta := public.get_contextual_result_morale_delta(
      v_context.category_code,
      v_context.uci_rank,
      new.final_rank,
      new.status,
      'gc'
    );

    if v_delta <> 0 then
      v_description := case
        when v_delta < 0 and new.status <> 'classified'
          then 'Tour inachevé malgré un statut de favori — '
        when v_delta < 0
          then 'Classement général en dessous des attentes — '
        when new.final_rank = 1 and coalesce(v_context.uci_rank, 10000) > 100
          then 'Victoire générale inattendue — '
        when new.final_rank = 1 and v_context.category_code = 'elite'
          then 'Victoire de prestige au classement général — '
        when new.final_rank = 1
          then 'Victoire au classement général — '
        when new.final_rank between 2 and 3
          then 'Podium au classement général — '
        else 'Place d’honneur au classement général — '
      end || coalesce(v_context.display_name, 'course par étapes');

      perform public.apply_rider_morale_event(
        v_context.rider_id,
        v_context.season_day_id,
        'race_result',
        new.id::text,
        v_delta,
        v_description,
        jsonb_build_object(
          'raceResultId', new.id,
          'rank', new.final_rank,
          'status', new.status,
          'categoryCode', v_context.category_code,
          'categoryName', v_context.category_name,
          'uciRank', v_context.uci_rank,
          'scope', 'gc',
          'expectationModel', 'category-uci-v1'
        )
      );
    end if;

    if new.status = 'classified' and new.final_rank = 1 then
      for v_teammate in
        select
          teammate.rider_id,
          teammate_summary.uci_rank
        from public.race_rosters as teammate
        left join public.rider_season_summaries as teammate_summary
          on teammate_summary.rider_id = teammate.rider_id
         and teammate_summary.season_id = v_context.season_id
        where teammate.race_registration_id = v_context.race_registration_id
          and teammate.rider_id <> v_context.rider_id
          and teammate.status not in ('withdrawn', 'did_not_start')
      loop
        v_teammate_delta := public.get_teammate_win_morale_delta(
          v_context.category_code,
          v_teammate.uci_rank,
          'gc'
        );
        if v_teammate_delta <> 0 then
          perform public.apply_rider_morale_event(
            v_teammate.rider_id,
            v_context.season_day_id,
            'race_result',
            'team-gc-win:' || new.race_edition_id::text,
            v_teammate_delta,
            'La victoire finale de ' || coalesce(v_context.rider_name, 'son coéquipier')
              || ' récompense le travail du collectif — '
              || coalesce(v_context.display_name, 'course par étapes'),
            jsonb_build_object(
              'raceResultId', new.id,
              'winnerRiderId', v_context.rider_id,
              'teamVictory', true,
              'categoryCode', v_context.category_code,
              'uciRank', v_teammate.uci_rank,
              'scope', 'gc',
              'expectationModel', 'category-uci-v1'
            )
          );
        end if;
      end loop;
    end if;
  end if;

  if exists (
    select 1
    from public.rider_favorite_races as favorite
    where favorite.season_id = v_context.season_id
      and favorite.rider_id = v_context.rider_id
      and favorite.race_id = v_context.race_id
  ) then
    v_favorite_delta := public.get_favorite_race_morale_delta(
      v_context.category_code,
      v_context.uci_rank,
      new.status
    );
    if v_favorite_delta <> 0 then
      perform public.apply_rider_morale_event(
        v_context.rider_id,
        v_context.season_day_id,
        'favorite_race',
        new.race_edition_id::text,
        v_favorite_delta,
        'Course préférée disputée à un niveau stimulant — '
          || coalesce(v_context.display_name, 'course'),
        jsonb_build_object(
          'raceEditionId', new.race_edition_id,
          'categoryCode', v_context.category_code,
          'uciRank', v_context.uci_rank,
          'expectationModel', 'category-uci-v1'
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists race_results_apply_morale on public.race_results;
create trigger race_results_apply_morale
after insert on public.race_results
for each row execute function public.apply_race_result_morale();

-- Assertions exécutées pendant la migration : elles documentent les cas
-- structurants et bloquent le déploiement si la matrice régresse.
do $$
begin
  if public.get_contextual_result_morale_delta(
    'national', 1, 1, 'finished', 'one_day'
  ) <> 0 then
    raise exception 'Moral invalide : le numero 1 UCI ne doit rien gagner sur une victoire nationale.';
  end if;
  if public.get_contextual_result_morale_delta(
    'elite', 1, 1, 'finished', 'one_day'
  ) <= 0 then
    raise exception 'Moral invalide : une victoire Elite doit compter pour le numero 1 UCI.';
  end if;
  if public.get_contextual_result_morale_delta(
    'national', 350, 10, 'finished', 'one_day'
  ) <= 0 then
    raise exception 'Moral invalide : une place d honneur nationale doit encourager un outsider.';
  end if;
  if public.get_contextual_result_morale_delta(
    'national', 1, 45, 'finished', 'one_day'
  ) >= 0 then
    raise exception 'Moral invalide : un favori tres decevant doit perdre du moral.';
  end if;
  if public.get_contextual_result_morale_delta(
    'elite', 180, 80, 'finished', 'one_day'
  ) <> 0 then
    raise exception 'Moral invalide : un outsider ne doit pas etre sanctionne comme un favori.';
  end if;
  if public.get_teammate_win_morale_delta('national', 350, 'one_day') <= 0 then
    raise exception 'Moral invalide : un coureur modeste doit profiter de la victoire d un coequipier.';
  end if;
  if public.get_teammate_win_morale_delta('national', 5, 'one_day') <> 0 then
    raise exception 'Moral invalide : un leader mondial ne doit pas farmer les victoires de ses coequipiers.';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
