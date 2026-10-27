-- Approved S5 calendar. Existing editions/stages/entries keep their identities.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

create or replace function private.s5_elite_calendar_plan()
returns table(slug text, start_day integer, first_slot text, stage_count integer,
  race_name text, short_name text, country_code text, race_format text,
  monument boolean, profiles jsonb)
language sql immutable set search_path = '' as $$
  values
    ('corsa-delle-regioni',2,'early',12,null,null,null,null,false,null::jsonb),
    ('tour-des-volcans-du-pacifique',3,'early',5,null,null,null,null,false,null::jsonb),
    ('tour-des-plaines',6,'early',5,'Tour des Plaines','TDP','HU','stage_race',false,
      '[{"profile":"sprint","distance":168},{"profile":"sprint","distance":184},{"profile":"time_trial","distance":24},{"profile":"hilly","distance":172},{"profile":"sprint","distance":196}]'::jsonb),
    ('boucle-des-provinces',9,'early',12,null,null,null,null,false,null::jsonb),
    ('ruta-de-las-sierras',17,'early',12,null,null,null,null,false,null::jsonb),
    ('aurora-borealis-tour',18,'early',6,null,null,null,null,false,null::jsonb),
    ('tour-des-hautes-vallees',21,'early',5,'Tour des Hautes Vallées','THV','CH','stage_race',false,
      '[{"profile":"hilly","distance":156},{"profile":"mountain","distance":168},{"profile":"time_trial","distance":22},{"profile":"mountain","distance":182},{"profile":"mountain","distance":164}]'::jsonb),
    ('circuit-des-salines',2,'late',1,'Circuit des Salines','CDS','TN','one_day',false,'[{"profile":"sprint","distance":198}]'::jsonb),
    ('enfer-des-dunes',8,'late',1,null,null,null,null,true,null::jsonb),
    ('gp-des-plaines-du-danube',9,'late',1,'GP des Plaines du Danube','GPD','HU','one_day',false,'[{"profile":"sprint","distance":206}]'::jsonb),
    ('cime-du-tyrol',10,'late',1,null,null,null,null,false,null::jsonb),
    ('couronne-des-ardennes',11,'late',1,null,null,null,null,true,null::jsonb),
    ('mur-de-catalogne',12,'late',1,null,null,null,null,false,null::jsonb),
    ('classique-du-caucase',13,'late',1,null,null,null,null,false,null::jsonb),
    ('desert-to-sky-classic',14,'late',1,null,null,null,null,false,null::jsonb),
    ('classique-des-hauts-cols',16,'early',1,'Classique des Hauts-Cols','CHC','SI','one_day',false,'[{"profile":"mountain","distance":214}]'::jsonb),
    ('paves-de-zelande',16,'late',1,null,null,null,null,true,null::jsonb),
    ('gp-de-la-pampa',17,'late',1,'GP de la Pampa','GPP','AR','one_day',false,'[{"profile":"sprint","distance":212}]'::jsonb),
    ('traversee-des-flandres',23,'late',1,null,null,null,null,true,null::jsonb),
    ('doyenne-des-collines',25,'early',1,'Doyenne des Collines','DDC','BE','one_day',true,'[{"profile":"hilly","distance":252}]'::jsonb),
    ('patagonia-fin-del-mundo',25,'late',1,null,null,null,null,false,null::jsonb),
    ('chrono-des-fjords',27,'early',1,null,null,null,null,false,null::jsonb),
    ('classique-des-lacs',27,'late',1,null,null,null,null,true,null::jsonb),
    ('grand-prix-du-littoral',28,'late',1,null,null,null,null,false,null::jsonb);
$$;
revoke all on function private.s5_elite_calendar_plan() from public, anon, authenticated;

-- Use the same placement rule when cloning S4 or any later season. Keep all
-- international selection rules and the historical Mur placement intact.
do $patch$
declare v_definition text; v_anchor text := '  if v_race_slug = ''mur-de-catalogne'' then';
begin
  select replace(pg_get_functiondef('public.enforce_international_elite_stage_calendar()'::regprocedure),E'\r\n',E'\n') into v_definition;
  if position('s5_elite_calendar_plan' in v_definition)=0 then
    if position(v_anchor in v_definition)=0 then raise exception 'Unexpected international calendar guard.'; end if;
    execute replace(v_definition,v_anchor,$replacement$
  if v_game_year >= 5 and v_category_code = 'elite'
    and exists(select 1 from private.s5_elite_calendar_plan() plan where plan.slug=v_race_slug) then
    select plan.start_day + case when plan.stage_count > 1 then (new.stage_number-1)/2 else 0 end,
      case when plan.stage_count > 1 then case when mod(new.stage_number-1,2)=0 then 'early' else 'late' end else plan.first_slot end
    into v_target_day_number, new.day_slot
    from private.s5_elite_calendar_plan() plan where plan.slug=v_race_slug;
  end if;
  if v_target_day_number is not null then
    null;
  elsif v_race_slug = 'mur-de-catalogne' then$replacement$);
  end if;
end;
$patch$;

-- A deferred guard must inspect the final row, rather than an intermediate
-- NEW image left by a multi-step calendar relocation.
do $patch$
declare v_definition text; v_anchor text := E'begin\n  select';
begin
  select replace(pg_get_functiondef('private.enforce_standard_race_country_spacing()'::regprocedure),E'\r\n',E'\n') into v_definition;
  if position('s5_final_stage_row' in v_definition)=0 then
    if position(v_anchor in v_definition)=0 then raise exception 'Unexpected country calendar guard.'; end if;
    execute replace(v_definition,v_anchor,$replacement$begin
  -- s5_final_stage_row: ignore superseded or deleted schedule images.
  if not exists(select 1 from public.stages current_stage where current_stage.id=new.id
    and current_stage.race_edition_id=new.race_edition_id and current_stage.season_day_id=new.season_day_id) then
    return null;
  end if;
  select$replacement$);
  end if;
end;
$patch$;

create or replace function private.apply_s5_elite_calendar(p_season_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_year integer; v_plan record; v_edition uuid; v_race uuid; v_country uuid;
  v_category uuid; v_stage uuid; v_profile record; v_conflict record; v_start integer;
begin
  select game_year into v_year from public.seasons
  where id=p_season_id and game_year>=5 and status='planned' for update;
  if not found then return; end if;
  if (select count(*) from public.season_days where season_id=p_season_id)<>28 then
    raise exception 'S5 Elite calendar requires all 28 season days.';
  end if;
  if exists(select 1 from public.stages t join public.race_editions e on e.id=t.race_edition_id
    join public.races r on r.id=e.race_id join private.s5_elite_calendar_plan() p on p.slug=r.slug
    where e.season_id=p_season_id and (t.status<>'planned' or e.status not in('planned','registration_open')
      or exists(select 1 from public.stage_results x where x.stage_id=t.id)
      or exists(select 1 from public.official_stage_simulations x where x.stage_id=t.id))) then
    raise exception 'An Elite race has already started: calendar update refused.';
  end if;
  select id into strict v_category from public.race_categories where code='elite';
  set constraints public.stages_day_slot_unique deferred;
  for v_plan in select * from private.s5_elite_calendar_plan() order by start_day,slug loop
    select id into v_race from public.races where slug=v_plan.slug;
    if v_plan.profiles is not null then
      select id into strict v_country from public.countries where iso_alpha2=v_plan.country_code;
      insert into public.races(country_id,name,short_name,race_format,status,slug,competition_type,is_monument,is_grand_tour)
      values(v_country,v_plan.race_name,v_plan.short_name,v_plan.race_format,'active',v_plan.slug,'standard',v_plan.monument,false)
      on conflict(slug) do nothing returning id into v_race;
      if v_race is null then select id into strict v_race from public.races where slug=v_plan.slug; end if;
      if not exists(select 1 from public.races r where r.id=v_race and r.country_id=v_country
        and r.race_format=v_plan.race_format and r.is_monument=v_plan.monument
        and not r.is_grand_tour and r.competition_type='standard' and r.status='active') then
        raise exception 'Conflicting existing race metadata for %.',v_plan.slug;
      end if;
      insert into public.race_editions(race_id,season_id,race_category_id,edition_number,display_name,status,minimum_reputation,registration_policy,field_limit)
      values(v_race,p_season_id,v_category,v_year,v_plan.race_name,'registration_open',0,'open',24)
      on conflict(race_id,season_id) do nothing;
    end if;
    select id into strict v_edition from public.race_editions where race_id=v_race and season_id=p_season_id and race_category_id=v_category;
    if v_plan.profiles is not null then
      for v_profile in select value,ordinality::integer n from jsonb_array_elements(v_plan.profiles) with ordinality loop
        insert into public.stages(race_edition_id,season_day_id,stage_number,name,stage_type,distance_km,status,departure_at,profile_type,day_slot)
        select v_edition,d.id,v_profile.n,
          case when v_plan.stage_count=1 then v_plan.race_name else 'Étape '||v_profile.n end,
          case when v_profile.value->>'profile'='time_trial' then 'individual_time_trial' else 'road' end,
          (v_profile.value->>'distance')::numeric,'planned',
          (d.calendar_date::timestamp+case when v_plan.stage_count=1 and v_plan.first_slot='late' or v_plan.stage_count>1 and mod(v_profile.n-1,2)=1 then time '18:00' else time '14:00' end) at time zone 'Europe/Paris',
          v_profile.value->>'profile',case when v_plan.stage_count=1 then v_plan.first_slot when mod(v_profile.n-1,2)=0 then 'early' else 'late' end
        from public.season_days d where d.season_id=p_season_id and d.day_number=v_plan.start_day+(v_profile.n-1)/2
        on conflict(race_edition_id,stage_number) do nothing returning id into v_stage;
        if v_stage is not null then
          perform private.rebuild_standard_stage_segments(v_stage);
          if v_plan.race_format='stage_race' and v_profile.value->>'profile'<>'time_trial' then
            insert into public.stage_segment_primes(stage_segment_id,prime_type,mountain_category,points_scale)
            select segment.id,'mountain',case when v_profile.value->>'profile'='mountain' then '1' else '3' end,
              case when v_profile.value->>'profile'='mountain' then array[10,8,6,4,2,1]::smallint[] else array[2,1]::smallint[] end
            from public.stage_segments segment where segment.stage_id=v_stage and segment.terrain_type='climb'
              and not exists(select 1 from public.stage_segments next_segment where next_segment.stage_id=v_stage
                and next_segment.segment_number=segment.segment_number+1 and next_segment.terrain_type='climb');
            insert into public.stage_segment_primes(stage_segment_id,prime_type,points_scale)
            select segment.id,'intermediate_sprint',array[20,17,15,13,11,10,9,8,7,6,5,4,3,2,1]::smallint[]
            from public.stage_segments segment where segment.stage_id=v_stage and segment.terrain_type='flat'
            order by abs(segment.segment_number-ceil((v_profile.value->>'distance')::numeric/20)) limit 1;
          end if;
        end if;
      end loop;
    end if;
    if (select count(*) from public.stages where race_edition_id=v_edition)<>v_plan.stage_count then
      raise exception 'Unexpected stage count for %.',v_plan.slug;
    end if;
    update public.stages t set season_day_id=d.id,
      day_slot=case when v_plan.stage_count=1 then v_plan.first_slot when mod(t.stage_number-1,2)=0 then 'early' else 'late' end,
      departure_at=(d.calendar_date::timestamp+case when v_plan.stage_count=1 and v_plan.first_slot='late' or v_plan.stage_count>1 and mod(t.stage_number-1,2)=1 then time '18:00' else time '14:00' end) at time zone 'Europe/Paris'
    from public.season_days d where t.race_edition_id=v_edition and d.season_id=p_season_id
      and d.day_number=v_plan.start_day+case when v_plan.stage_count>1 then (t.stage_number-1)/2 else 0 end
      and (t.season_day_id is distinct from d.id
        or t.day_slot is distinct from case when v_plan.stage_count=1 then v_plan.first_slot when mod(t.stage_number-1,2)=0 then 'early' else 'late' end
        or t.departure_at is distinct from (d.calendar_date::timestamp+case when v_plan.stage_count=1 and v_plan.first_slot='late' or v_plan.stage_count>1 and mod(t.stage_number-1,2)=1 then time '18:00' else time '14:00' end) at time zone 'Europe/Paris');
  end loop;

  -- Resolve only lower-category races displaced by the approved Elite dates.
  -- Never recreate their stages or discard their entries/preparation.
  for v_conflict in
    select distinct e.id,r.country_id from public.race_editions e join public.races r on r.id=e.race_id
    join public.race_categories c on c.id=e.race_category_id
    join public.stages t on t.race_edition_id=e.id
    join public.stages elite_stage on elite_stage.season_day_id=t.season_day_id
    join public.race_editions elite on elite.id=elite_stage.race_edition_id
    join public.races elite_race on elite_race.id=elite.race_id
    join private.s5_elite_calendar_plan() p on p.slug=elite_race.slug
    where e.season_id=p_season_id and elite.season_id=p_season_id and e.status<>'cancelled'
      and c.code<>'elite' and r.competition_type='standard' and r.status='active'
      and r.country_id=elite_race.country_id
      and not private.standard_race_country_overlap_allowed(p_season_id,r.country_id,e.id,elite.id)
    order by e.id
  loop
    if exists(select 1 from public.stages t where t.race_edition_id=v_conflict.id and (t.status<>'planned'
      or exists(select 1 from public.stage_results x where x.stage_id=t.id)
      or exists(select 1 from public.official_stage_simulations x where x.stage_id=t.id)))
      or exists(select 1 from public.national_federation_race_projects p join public.race_editions e on e.race_id=p.race_id
        where e.id=v_conflict.id and p.status in('scheduled','active')) then
      raise exception 'A displaced race requires manual arbitration: %.',v_conflict.id;
    end if;
    select min(d.day_number)::integer first_day,(max(d.day_number)-min(d.day_number)+1)::integer duration
      into v_profile from public.stages t join public.season_days d on d.id=t.season_day_id where t.race_edition_id=v_conflict.id;
    v_start:=private.find_free_standard_race_start_day(p_season_id,v_conflict.country_id,v_profile.first_day,v_profile.duration,v_conflict.id);
    if v_start is null then raise exception 'No free day for displaced race %.',v_conflict.id; end if;
    update public.stages t set season_day_id=target.id,
      departure_at=(target.calendar_date::timestamp+case t.day_slot when 'early' then time '14:00' else time '18:00' end) at time zone 'Europe/Paris'
    from public.season_days original,public.season_days target where t.race_edition_id=v_conflict.id
      and original.id=t.season_day_id and target.season_id=p_season_id and target.day_number=original.day_number+v_start-v_profile.first_day;
    update public.race_editions set
      registration_closes_at=((registration_closes_at at time zone 'Europe/Paris')+make_interval(days=>v_start-v_profile.first_day)) at time zone 'Europe/Paris',
      withdrawal_closes_at=((withdrawal_closes_at at time zone 'Europe/Paris')+make_interval(days=>v_start-v_profile.first_day)) at time zone 'Europe/Paris',
      wildcard_closes_at=((wildcard_closes_at at time zone 'Europe/Paris')+make_interval(days=>v_start-v_profile.first_day)) at time zone 'Europe/Paris'
    where id=v_conflict.id;
  end loop;

  -- Standard registration rules: 08:00 for 14:00 starts, 12:00 for 18:00.
  -- In particular the Corsa closes J2 at 08:00, never H-24.
  update public.race_editions e set registration_closes_at=x.closes_at,withdrawal_closes_at=x.closes_at,
    wildcard_closes_at=x.departure_at-interval '24 hours'
  from (select distinct on(t.race_edition_id) t.race_edition_id,t.departure_at,
      (d.calendar_date::timestamp+case t.day_slot when 'early' then time '08:00' else time '12:00' end) at time zone 'Europe/Paris' closes_at
    from public.stages t join public.race_editions ed on ed.id=t.race_edition_id
    join public.races r on r.id=ed.race_id join private.s5_elite_calendar_plan() p on p.slug=r.slug
    join public.season_days d on d.id=t.season_day_id where ed.season_id=p_season_id order by t.race_edition_id,t.stage_number) x
  where e.id=x.race_edition_id and (e.registration_closes_at is distinct from x.closes_at or e.withdrawal_closes_at is distinct from x.closes_at
    or e.wildcard_closes_at is distinct from x.departure_at-interval '24 hours');
end;
$$;
revoke all on function private.apply_s5_elite_calendar(uuid) from public, anon, authenticated;

create or replace function private.guard_s5_elite_daily_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_day uuid; v_season uuid;
begin
  select t.season_day_id,e.season_id into v_day,v_season from public.stages t
    join public.race_editions e on e.id=t.race_edition_id join public.seasons s on s.id=e.season_id
    join public.race_categories c on c.id=e.race_category_id
    where t.id=new.id and s.game_year>=5 and s.status in('planned','active')
      and c.code='elite' and e.status<>'cancelled' and t.status<>'cancelled';
  if not found then return null; end if;
  if (select count(distinct e.id) from public.stages t join public.race_editions e on e.id=t.race_edition_id
    join public.race_categories c on c.id=e.race_category_id where t.season_day_id=v_day and e.season_id=v_season
      and c.code='elite' and e.status<>'cancelled' and t.status<>'cancelled')>2 then
    raise exception 'Deux épreuves Elite au maximum peuvent être programmées le même jour.';
  end if;
  return null;
end;
$$;
revoke all on function private.guard_s5_elite_daily_limit() from public, anon, authenticated;
drop trigger if exists guard_s5_elite_daily_limit on public.stages;
create constraint trigger guard_s5_elite_daily_limit after insert or update of race_edition_id,season_day_id,day_slot on public.stages
  deferrable initially deferred for each row execute function private.guard_s5_elite_daily_limit();

do $provision$
declare v_definition text; v_anchor text := '  perform public.repair_missing_standard_race_deadlines(p_target_season_id);'; v_season record;
begin
  select replace(pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure),E'\r\n',E'\n') into v_definition;
  if position('perform private.apply_s5_elite_calendar(p_target_season_id);' in v_definition)=0 then
    if position(v_anchor in v_definition)=0 then raise exception 'Unexpected calendar provisioning hook.'; end if;
    execute replace(v_definition,v_anchor,E'  perform private.apply_s5_elite_calendar(p_target_season_id);\n'||v_anchor);
  end if;
  -- Contract extensions can reserve season identities before their calendar
  -- exists. Their normal provisioning hook will apply the plan later.
  for v_season in select s.id from public.seasons s where s.game_year>=5 and s.status='planned'
    and (select count(*) from public.season_days d where d.season_id=s.id)=28
    and exists(select 1 from public.race_editions e join public.race_categories c on c.id=e.race_category_id where e.season_id=s.id and c.code='elite')
    order by s.game_year loop
    perform private.apply_s5_elite_calendar(v_season.id);
  end loop;
end;
$provision$;

-- Preserve the existing five-distinct-wins achievement and all claimed rewards.
-- Its wording must no longer imply that there are only five Monuments.
update public.career_objective_definitions set title='Collection des classiques',
  description='Gagner au moins une édition de cinq Monuments différents.'
where code='all_monuments_won' and target_value=5 and metric_key='distinct_monument_wins';

do $verify$
declare v_season record;
begin
  for v_season in select s.id from public.seasons s where s.game_year>=5 and s.status='planned'
    and (select count(*) from public.season_days d where d.season_id=s.id)=28
    and exists(select 1 from public.race_editions e join public.race_categories c on c.id=e.race_category_id where e.season_id=s.id and c.code='elite') loop
    if (select count(*) from public.race_editions e join public.race_categories c on c.id=e.race_category_id
      where e.season_id=v_season.id and c.code='elite' and e.status<>'cancelled')<>24
      or (select count(*) from public.stages t join public.race_editions e on e.id=t.race_edition_id
        join public.races r on r.id=e.race_id join private.s5_elite_calendar_plan() p on p.slug=r.slug where e.season_id=v_season.id)<>74 then
      raise exception 'Expected 24 Elite races / 74 stages; calendar migration aborted.';
    end if;
    if exists(select 1 from public.stages t join public.race_editions e on e.id=t.race_edition_id
      join public.races r on r.id=e.race_id join private.s5_elite_calendar_plan() p on p.slug=r.slug
      join public.season_days d on d.id=t.season_day_id where e.season_id=v_season.id and
        (d.day_number<>p.start_day+case when p.stage_count>1 then (t.stage_number-1)/2 else 0 end
        or t.day_slot<>case when p.stage_count=1 then p.first_slot when mod(t.stage_number-1,2)=0 then 'early' else 'late' end
        or (t.departure_at at time zone 'Europe/Paris')::time<>case t.day_slot when 'early' then time '14:00' else time '18:00' end)) then
      raise exception 'Elite calendar placement does not match the approved plan.';
    end if;
    if exists(select 1 from public.race_editions e join public.races r on r.id=e.race_id
      join public.stages t on t.race_edition_id=e.id and t.stage_number=1 join public.season_days d on d.id=t.season_day_id
      where e.season_id=v_season.id and r.slug='corsa-delle-regioni'
        and e.registration_closes_at is distinct from (d.calendar_date::timestamp+time '08:00') at time zone 'Europe/Paris') then
      raise exception 'Corsa registration must close at 08:00 on its opening day.';
    end if;
  end loop;
end;
$verify$;
commit;
