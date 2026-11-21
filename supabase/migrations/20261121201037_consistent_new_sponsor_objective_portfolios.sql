begin;
set local application_name = 'new-sponsor-objective-portfolios-20261121';
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

-- This installation only defines future behavior. No portfolio, contract,
-- satisfaction, ambition snapshot or settlement is readjusted on installation.
create function private.sponsor_objective_requirements_overlap(a jsonb, b jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(a->>'kind'=b->>'kind' and case a->>'kind'
    when 'race_result' then a->>'raceId'=b->>'raceId'
    when 'season_wins' then a->>'winScope'=b->>'winScope' or a->>'winScope'='all' or b->>'winScope'='all'
    when 'nationality_quota' then upper(a->>'countryCode')=upper(b->>'countryCode')
    when 'uci_ranking' then coalesce(a->>'rankingScope','')=coalesce(b->>'rankingScope','')
    when 'nation_uci_ranking' then upper(a->>'countryCode')=upper(b->>'countryCode')
    when 'national_championship' then upper(a->>'countryCode')=upper(b->>'countryCode')
      and (a->>'championshipType'=b->>'championshipType' or a->>'championshipType'='any' or b->>'championshipType'='any')
    when 'homegrown_roster' then true
    when 'youth_development' then a->>'metric'=b->>'metric'
    when 'rider_recruitment' then a->>'riderId'=b->>'riderId'
    when 'infrastructure' then true else false end, false);
$$;

-- Coefficients mirror lib/game/sponsor-objective-consistency.ts. The score is
-- computed from the final requirement, never from its previous reward/slot.
create function private.sponsor_objective_difficulty_weight(d jsonb, category text default 'national', philosophy text default null)
returns double precision language plpgsql immutable set search_path = '' as $$
declare
  w double precision;
  r double precision := greatest(1,coalesce((d->>'targetRank')::double precision,1));
  expected double precision := (d->'sportingCalibration'->>'projectedRank')::double precision;
  p text := coalesce(philosophy,d->>'sportingPhilosophy','');
  aligned boolean;
begin
  w := case d->>'kind'
    when 'race_result' then 8*(1+1/sqrt(case when d->>'achievementType'='win' then 1 else r end))
      *greatest(1,coalesce((d->>'requiredCount')::double precision,1))
      *case category when 'continental' then 1.2 when 'world' then 1.4 when 'elite' then 1.6 else 1 end
    when 'season_wins' then (6+2*(d->>'minimumWinCount')::double precision)
      *case d->>'winScope' when 'all' then .9 when 'stage_race_general' then 1.15 else 1 end
    when 'nationality_quota' then 5+(d->>'minimumPercentage')::double precision/5
    when 'homegrown_roster' then 5+(d->>'minimumPercentage')::double precision/3
    when 'uci_ranking' then (5+15/sqrt(r))*case when expected>0 then greatest(.85,least(1.15,sqrt(expected/r))) else 1 end
    when 'nation_uci_ranking' then 5+12/sqrt(r)
    when 'national_championship' then (7+3*(d->>'requiredTitleCount')::double precision)
      *case d->>'championshipType' when 'any' then .9 else 1 end
    when 'youth_development' then case d->>'metric' when 'development_roster' then 4+(d->>'minimumCount')::double precision
      else 5+3*(d->>'minimumCount')::double precision end
    when 'rider_recruitment' then 5+greatest(0,(d->>'overallRating')::double precision-45)/3
    when 'infrastructure' then 5+3*(d->>'minimumCompletedCount')::double precision
  end;
  aligned := case p
    when 'national_preference' then d->>'kind' in ('nationality_quota','national_championship','nation_uci_ranking')
    when 'youth_development' then d->>'kind' in ('youth_development','homegrown_roster')
    else d->>'kind'='season_wins' and (
      (p in ('cobbled_classics','ardennes_classics') and d->>'winScope'='one_day_races')
      or (p in ('medium_stage_races','grand_tour_general') and d->>'winScope' in ('stages','stage_race_general'))
      or (p='time_trials' and d->>'winScope'='stages')
      or (p='sprints' and d->>'winScope' in ('stages','one_day_races'))) end;
  if w is null or w<=0 or w>='Infinity'::double precision then
    raise exception 'La difficulté des objectifs sponsor est invalide.';
  end if;
  return w*case when aligned then 1.15 else 1 end;
end;
$$;

create function private.sponsor_objective_complement(d jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare n text; description text; count integer; label text;
begin
  case d->>'kind'
    when 'season_wins' then
      count := (d->>'minimumWinCount')::integer;
      label := case d->>'winScope' when 'stages' then 'victoire(s) d’étapes'
        when 'one_day_races' then 'victoire(s) en classiques' else 'victoire(s) au classement général de tours' end;
      n := format('Remporter %s %s',count,label);
      description := format('Obtenir %s %s pendant la saison.',count,label);
    when 'homegrown_roster' then
      n := 'Valoriser la formation du club';
      description := format('Compter au moins %s %% de coureurs formés au club dans l’effectif professionnel.',d->>'minimumPercentage');
    when 'infrastructure' then
      n := 'Faire grandir les installations';
      description := 'Achever la construction ou l’amélioration d’au moins une infrastructure pendant la saison.';
    when 'nation_uci_ranking' then
      n := format('Porter %s dans le Top %s UCI',d->>'countryCode',d->>'targetRank');
      description := format('Placer %s parmi les %s premiers du classement UCI des nations.',d->>'countryCode',d->>'targetRank');
    when 'national_championship' then
      n := format('Décrocher un titre national %s',d->>'countryCode');
      description := format('Remporter au moins un championnat national %s (%s).',d->>'countryCode',d->>'championshipType');
    when 'youth_development' then
      n := case d->>'metric' when 'promotions' then 'Promouvoir un jeune en professionnel'
        when 'development_roster' then 'Étoffer la Dev Team'
        when 'junior_race_wins' then 'Gagner avec les juniors' else 'Valoriser un jeune formé au club' end;
      description := case d->>'metric' when 'promotions' then 'Faire signer au moins un junior dans l’effectif professionnel.'
        when 'development_roster' then 'Disposer d’au moins six coureurs dans la Dev Team.'
        when 'junior_race_wins' then 'Remporter au moins une course junior pendant la saison.'
        else 'Réaliser au moins une vente de coureur formé au club pendant la saison.' end;
    else raise exception 'Aucun engagement sponsor complémentaire n’est disponible.';
  end case;
  return jsonb_build_object('name',n,'description',description,'objective_type',d->>'kind','target_details',d);
end;
$$;

-- Pure ten-slot transformation, also exercised in an isolated PostgreSQL test.
create function private.consistent_sponsor_objective_portfolio(rows jsonb, country text, categories jsonb default '{}')
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  normalized jsonb := '[]'; selected jsonb := '[]'; result jsonb := '[]'; pool jsonb;
  row jsonb; d jsonb; common_context jsonb; replacement jsonb; entry record; retained integer[] := '{}';
  p text; scope text; scopes text[]; nation_rank integer; championship text;
  n integer := jsonb_array_length(rows);
begin
  if n<>10 then raise exception 'Le plan sponsor doit contenir dix objectifs.'; end if;
  select value->'target_details'->>'sportingPhilosophy' into p from jsonb_array_elements(rows)
    where nullif(value->'target_details'->>'sportingPhilosophy','') is not null limit 1;
  select greatest(1,coalesce((value->'target_details'->>'targetRank')::integer,10)) into nation_rank
    from jsonb_array_elements(rows) where value->'target_details'->>'kind'='nation_uci_ranking' limit 1;
  select value->'target_details'->>'championshipType' into championship
    from jsonb_array_elements(rows) where value->'target_details'->>'kind'='national_championship' limit 1;
  scopes := case when p in ('medium_stage_races','grand_tour_general') then array['stage_race_general','stages','one_day_races']
    else array['stages','one_day_races'] end;
  for row in select value from jsonb_array_elements(rows) loop
    if row->'target_details'->>'kind'='infrastructure' then
      row := row||private.sponsor_objective_complement(jsonb_build_object('kind','infrastructure','minimumCompletedCount',1));
    end if;
    normalized := normalized||jsonb_build_array(row);
  end loop;
  for entry in select value as row, ordinality::integer as position,
      private.sponsor_objective_difficulty_weight(value->'target_details',coalesce(categories->>(value->'target_details'->>'raceId'),'national'),p) as weight
    from jsonb_array_elements(normalized) with ordinality
    order by weight desc, ordinality
  loop
    if not exists(select 1 from jsonb_array_elements(selected) s
      where private.sponsor_objective_requirements_overlap(s->'target_details',entry.row->'target_details')) then
      selected := selected||jsonb_build_array(entry.row); retained := array_append(retained,entry.position);
    end if;
  end loop;
  for entry in select value as row, ordinality::integer as position from jsonb_array_elements(normalized) with ordinality loop
    row := entry.row;
    if not entry.position=any(retained) then
      pool := '[]';
      foreach scope in array scopes loop
        pool := pool||jsonb_build_array(jsonb_build_object('kind','season_wins','winScope',scope,'minimumWinCount',1));
      end loop;
      pool := pool||jsonb_build_array(
        jsonb_build_object('kind','homegrown_roster','minimumPercentage',5),
        jsonb_build_object('kind','infrastructure','minimumCompletedCount',1),
        jsonb_build_object('kind','nation_uci_ranking','countryCode',country,'targetRank',coalesce(nation_rank,10)),
        jsonb_build_object('kind','national_championship','countryCode',country,'championshipType',coalesce(championship,'any'),'requiredTitleCount',1),
        jsonb_build_object('kind','youth_development','metric','promotions','minimumCount',1),
        jsonb_build_object('kind','youth_development','metric','development_roster','minimumCount',6),
        jsonb_build_object('kind','youth_development','metric','junior_race_wins','minimumCount',1),
        jsonb_build_object('kind','youth_development','metric','homegrown_sales','minimumCount',1));
      select candidate into replacement from jsonb_array_elements(pool) candidate
        where not exists(select 1 from jsonb_array_elements(selected) s
          where private.sponsor_objective_requirements_overlap(s->'target_details',candidate)) limit 1;
      if replacement is null then raise exception 'Aucun engagement sponsor complémentaire n’est disponible.'; end if;
      row := row||private.sponsor_objective_complement(replacement);
      selected := selected||jsonb_build_array(row);
    end if;
    -- Only shared plan context follows a replacement. Do not retain the old
    -- target's race, rider/leader or counter fields under a different family.
    select coalesce(jsonb_object_agg(key,value),'{}') into common_context
      from jsonb_each(rows->(entry.position-1)->'target_details')
      where key in ('objectiveDifficulty','ambitionLevel','sportingCalibration','annualSourceObjectiveId','annualTargetGameYear');
    d := common_context||(row->'target_details')||jsonb_build_object('generationVersion',13);
    if p is not null then d := d||jsonb_build_object('sportingPhilosophy',p); end if;
    result := result||jsonb_build_array(row||jsonb_build_object('target_details',d));
  end loop;
  -- Give every goal one point, then allocate the remaining ninety by difficulty.
  with weights as (
    select value, ordinality, private.sponsor_objective_difficulty_weight(value->'target_details',
      coalesce(categories->>(value->'target_details'->>'raceId'),'national'),p) as weight
    from jsonb_array_elements(result) with ordinality
  ), portions as (
    select *,weight/sum(weight) over ()*(100-n) as exact from weights
  ), ranked as (
    select *,row_number() over(order by exact-floor(exact) desc,weight desc,ordinality) as fraction_rank,
      100-sum(1+floor(exact)) over () as remainder from portions
  ), allocated as (
    select *,1+floor(exact)::integer+case when fraction_rank<=remainder then 1 else 0 end as points from ranked
  ) select jsonb_agg(value||jsonb_build_object('satisfaction_points',points,'renewal_bonus_percent',0,
      'priority',case when points>=17 then 'mandatory' when points>=11 then 'important' when points>=6 then 'standard' else 'optional' end) order by ordinality)
    into result from allocated;
  return result;
end;
$$;

create function private.normalize_new_annual_sponsor_portfolio(p_offer_id uuid, p_target_season_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare rows jsonb; corrected jsonb; country text; categories jsonb;
begin
  if not exists(select 1 from public.seasons where id=p_target_season_id and game_year>=6) then return; end if;
  perform 1 from public.sponsor_offers where id=p_offer_id for update;
  select jsonb_agg(to_jsonb(o) order by o.display_order) into rows from public.sponsor_objectives o
    where o.sponsor_offer_id=p_offer_id and o.season_id=p_target_season_id;
  if coalesce(jsonb_array_length(rows),0)<>10 or exists(select 1 from jsonb_array_elements(rows) o
      where o->>'status'<>'draft' or not (o->>'is_provisional')::boolean
        or coalesce((o->'target_details'->>'generationVersion')::integer,0)<>13)
    or exists(select 1 from public.objective_progress p join public.sponsor_objectives o on o.id=p.sponsor_objective_id where o.sponsor_offer_id=p_offer_id) then
    raise exception 'Seul un nouveau programme annuel S6 peut être préparé.';
  end if;
  select c.iso_alpha2 into country from public.sponsor_offers offer join public.sponsors s on s.id=offer.sponsor_id
    join public.countries c on c.id=s.country_id where offer.id=p_offer_id;
  select coalesce(jsonb_object_agg(r.race_id,category.code),'{}') into categories
    from public.race_editions r join public.race_categories category on category.id=r.race_category_id
    where r.season_id=p_target_season_id and r.race_id in(select nullif(o->'target_details'->>'raceId','')::uuid from jsonb_array_elements(rows) o);
  corrected := private.consistent_sponsor_objective_portfolio(rows,country,categories);
  update public.sponsor_objectives o set
    name=x.name, description=x.description, objective_type=x.objective_type,
    satisfaction_points=x.satisfaction_points, priority=x.priority, renewal_bonus_percent=0, target_details=x.target_details
  from jsonb_to_recordset(corrected) as x(id uuid,name text,description text,objective_type text,satisfaction_points integer,priority text,target_details jsonb)
  where o.id=x.id;
end;
$$;

revoke all on function private.sponsor_objective_requirements_overlap(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.sponsor_objective_difficulty_weight(jsonb,text,text) from public,anon,authenticated,service_role;
revoke all on function private.sponsor_objective_complement(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.consistent_sponsor_objective_portfolio(jsonb,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.normalize_new_annual_sponsor_portfolio(uuid,uuid) from public,anon,authenticated,service_role;

do $patch$
declare
  definition text;
  declaration constant text := '  v_prepared integer := 0;';
  before_clone constant text := '    for v_objective in';
  before_insert constant text := '      insert into public.sponsor_objectives (';
  after_count constant text := '    -- Re-enabled/new requirements regain a positive share of the same 100-point';
begin
  definition := replace(pg_get_functiondef('public.prepare_annual_sponsor_objective_offers(uuid)'::regprocedure),chr(13),'');
  if position('private.normalize_new_annual_sponsor_portfolio' in definition)>0
    or array_length(string_to_array(definition,declaration),1)<>2
    or array_length(string_to_array(definition,before_clone),1)<>2
    or array_length(string_to_array(definition,before_insert),1)<>2
    or array_length(string_to_array(definition,after_count),1)<>2 then
    raise exception 'Unexpected annual sponsor objective preparation definition.';
  end if;
  definition := replace(definition,declaration,declaration||E'\n  v_new_future_plan boolean;');
  definition := replace(definition,before_clone,$code$
    -- Only a previously empty S6+ offer is a new portfolio. Existing proposals,
    -- accepted plans and saved ambition alternatives remain frozen.
    v_new_future_plan := v_target.game_year>=6 and not exists(
      select 1 from public.sponsor_objectives where sponsor_offer_id=v_offer_id);

    for v_objective in$code$);
  definition := replace(definition,before_insert,$code$
      if v_new_future_plan then
        v_details := v_details||jsonb_build_object('generationVersion',13,'objectiveDifficulty',
          (select objective_difficulty from public.sponsor_offers where id=v_offer_id));
      end if;
      insert into public.sponsor_objectives ($code$);
  definition := replace(definition,after_count,$code$
    if v_new_future_plan then
      perform private.normalize_new_annual_sponsor_portfolio(v_offer_id,v_target.id);
    end if;

    -- Re-enabled/new requirements regain a positive share of the same 100-point$code$);
  execute definition;
end;
$patch$;

notify pgrst, 'reload schema';
commit;
