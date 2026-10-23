begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Preparation only: no registrations are opened, no result is imported and
-- no player receives a reward when this migration is installed.
create table public.season_gala_result_imports (
  event_key text primary key check (event_key in (
    'world-tour:mountain','world-tour:hills','world-tour:cobbles',
    'continental:mountain','continental:hills','continental:sprint')),
  season_id uuid not null references public.seasons(id) on delete restrict,
  results jsonb not null check (jsonb_typeof(results) = 'array' and jsonb_array_length(results) = 10),
  receipt jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now()
);
create table public.season_gala_reward_grants (
  id uuid primary key default gen_random_uuid(),
  event_key text not null references public.season_gala_result_imports(event_key) on delete restrict,
  rank smallint not null check (rank between 1 and 10),
  rider_id uuid not null references public.riders(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete restrict,
  equipment_item_id uuid references public.equipment_catalog_items(id) on delete restrict,
  reward_key text references public.daily_reward_catalog(reward_key) on delete restrict,
  unit_number smallint not null check (unit_number between 1 and 3),
  granted_at timestamptz not null default now(),
  check (num_nonnulls(equipment_item_id, reward_key) = 1)
);
create unique index season_gala_reward_equipment_once on public.season_gala_reward_grants(event_key, rank, equipment_item_id) where equipment_item_id is not null;
create unique index season_gala_reward_consumable_once on public.season_gala_reward_grants(event_key, rank, reward_key, unit_number) where reward_key is not null;
alter table public.season_gala_result_imports enable row level security;
alter table public.season_gala_reward_grants enable row level security;
revoke all on public.season_gala_result_imports, public.season_gala_reward_grants from public, anon, authenticated, service_role;
grant select on public.season_gala_result_imports, public.season_gala_reward_grants to service_role;

-- A real event provenance, not a fabricated daily claim or compensation.
-- Nullable addition and NOT VALID checks avoid scanning the existing stock;
-- PostgreSQL still enforces them for every new or changed inventory row.
alter table public.daily_reward_inventory add column source_season_gala_reward_id uuid;
alter table public.daily_reward_inventory add constraint daily_reward_inventory_gala_source_fk
  foreign key (source_season_gala_reward_id) references public.season_gala_reward_grants(id) on delete restrict not valid;
alter table public.daily_reward_inventory drop constraint daily_reward_inventory_exactly_one_source;
alter table public.daily_reward_inventory add constraint daily_reward_inventory_exactly_one_source check (
  num_nonnulls(source_claim_id,source_referral_reward_id,source_auction_compensation_id,
    source_longevity_trophy_reward_id,source_international_selection_compensation_id,
    source_race_incident_compensation_id,source_season_gala_reward_id) = 1
) not valid;

insert into public.equipment_catalog_items (
  catalog_key,name,slot_type,status,supplier_key,supplier_name,description,
  price,rarity,image_path,effect_summary,effect_payload,acquisition_channel
)
select 'gala-s4-' || profile.code || '-' || prize.slot,
  prize.name || ' · ' || profile.label,prize.slot,'active','gala-saison-4','Grand Gala · Saison 4',
  'Lot exclusif du podium du Grand Gala de la saison 4, utilisable sur un coureur.',
  0,case when prize.bonus >= 2 then 'premium' else 'performance' end,prize.image,
  '+' || prize.bonus || ' ' || profile.stat_label,
  jsonb_build_object('ratingBonuses',jsonb_build_object(profile.code,prize.bonus)),'event_reward'
from (values ('mountain','Montagne','MON'),('hills','Vallons','VAL'),('cobbles','Pavés','PAV'),('sprint','Sprint','SPR')) profile(code,label,stat_label)
cross join (values
  ('bib_shorts','Cuissard · Éclat de Gala',3,'/images/equipment/products/montclair-victoire-atelier.webp'),
  ('helmet','Casque · Couronne de Gala',2,'/images/equipment/products/aerion-stratos-pro.webp'),
  ('shoes','Chaussures · Dernier Éclair',1,'/images/equipment/products/montclair-alpine-lace.webp')
) prize(slot,name,bonus,image);

create function public.guard_season_four_gala_registration()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_program text; v_season uuid;
begin
  if tg_table_name = 'season_gala_registrations' then
    if tg_op = 'INSERT' then
      if exists(select 1 from public.season_gala_result_imports where season_id=new.season_id and split_part(event_key,':',1)=new.program) then
        raise exception 'Les inscriptions de ce programme sont figées après import des résultats.';
      end if;
      return new;
    end if;
    if tg_op = 'UPDATE' and (new.team_id,new.season_id,new.program) is distinct from (old.team_id,old.season_id,old.program)
      and exists(select 1 from public.season_gala_registration_riders where registration_id=old.id) then
      raise exception 'Retirez les compositions avant de changer de programme : World Tour et Continental sont exclusifs.';
    end if;
    if exists(select 1 from public.season_gala_result_imports where season_id=old.season_id and split_part(event_key,':',1)=old.program) then
      raise exception 'Les inscriptions de ce programme sont figées après import des résultats.';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  select program,season_id into v_program,v_season from public.season_gala_registrations
    where id=case when tg_op='DELETE' then old.registration_id else new.registration_id end for update;
  if not found then
    if tg_op='DELETE' then return old; end if;
    raise exception 'Inscription du gala introuvable.';
  end if;
  if exists(select 1 from public.season_gala_result_imports where season_id=v_season and split_part(event_key,':',1)=v_program) then
    raise exception 'Les compositions de ce programme sont figées après import des résultats.';
  end if;
  if tg_op='DELETE' then return old; end if;
  if (v_program='world-tour' and new.profile not in ('mountain','hills','cobbles'))
    or (v_program='continental' and new.profile not in ('mountain','hills','sprint')) then
    raise exception 'Cette épreuve appartient à l’autre programme du gala.';
  end if;
  if tg_op='UPDATE' and new.registration_id<>old.registration_id then
    raise exception 'Une composition ne peut pas être déplacée vers une autre inscription.';
  end if;
  return new;
end;$$;
revoke all on function public.guard_season_four_gala_registration() from public,anon,authenticated;
create trigger season_four_gala_registration_guard before insert or update or delete on public.season_gala_registrations
  for each row execute function public.guard_season_four_gala_registration();
create trigger season_four_gala_roster_guard before insert or update or delete on public.season_gala_registration_riders
  for each row execute function public.guard_season_four_gala_registration();

create function public.settle_season_four_gala_results(p_event_key text,p_results jsonb)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_season uuid; v_program text; v_profile text; v_results jsonb; v_previous record;
  v_row record; v_target record; v_item uuid; v_grant uuid; v_reward record;
  v_equipment integer := 0; v_consumables integer := 0; v_unit integer; v_receipt jsonb; v_summary text;
begin
  if p_event_key is null or p_event_key not in ('world-tour:mountain','world-tour:hills','world-tour:cobbles','continental:mountain','continental:hills','continental:sprint') then
    raise exception 'Course du gala S4 inconnue.';
  end if;
  if jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results)<>10 then
    raise exception 'Le top 10 complet, sans équipe de simulation, est requis.';
  end if;
  if (select count(distinct r.rank) from jsonb_to_recordset(p_results) r(rank integer))<>10
    or (select count(distinct r.rider_id) from jsonb_to_recordset(p_results) r(rider_id uuid))<>10
    or exists(select 1 from jsonb_to_recordset(p_results) r(rank integer,rider_id uuid,team_id uuid)
      where rank is null or rank not between 1 and 10 or rider_id is null or team_id is null) then
    raise exception 'Classement incomplet ou coureurs dupliqués.';
  end if;
  select jsonb_agg(jsonb_build_object('rank',r.rank,'rider_id',r.rider_id,'team_id',r.team_id) order by r.rank)
    into v_results from jsonb_to_recordset(p_results) r(rank integer,rider_id uuid,team_id uuid);
  select id into strict v_season from public.seasons where game_year=4;
  v_program:=split_part(p_event_key,':',1); v_profile:=split_part(p_event_key,':',2);
  perform pg_advisory_xact_lock(hashtextextended('season-four-gala:'||p_event_key,0));
  select * into v_previous from public.season_gala_result_imports where event_key=p_event_key;
  if found then
    if v_previous.results<>v_results then raise exception 'Un classement déjà récompensé ne peut pas être remplacé.'; end if;
    return v_previous.receipt || jsonb_build_object('alreadyImported',true);
  end if;
  -- Lock first, then validate: a concurrent roster edit cannot invalidate a
  -- checked result between validation and crediting the inventory.
  perform 1 from public.season_gala_registrations registration where registration.season_id=v_season
    and registration.program=v_program order by registration.id for update;
  if exists(select 1 from jsonb_to_recordset(v_results) r(rank integer,rider_id uuid,team_id uuid)
    where not exists(select 1 from public.season_gala_registrations registration
      join public.season_gala_registration_riders roster on roster.registration_id=registration.id
      where registration.season_id=v_season and registration.program=v_program and registration.team_id=r.team_id
        and roster.profile=v_profile and roster.rider_id=r.rider_id)) then
    raise exception 'Un coureur ne figure pas dans la composition enregistrée pour cette course et ce programme.';
  end if;
  if exists(select 1 from public.season_gala_registrations registration
    where registration.season_id=v_season and registration.program=v_program and (
      select count(*) not between 7 and 8 or min(position)<>1 or max(position)<>count(*)
      from public.season_gala_registration_riders roster where roster.registration_id=registration.id and roster.profile=v_profile
    )) then raise exception 'Chaque composition doit comporter 7 à 8 coureurs, sans position manquante.'; end if;
  if (select count(*) from public.daily_reward_catalog where is_active and (
      (reward_key='secondary-technique' and effect_kind='rating_boost' and effect_payload @> '{"amount":1,"statScope":"secondary"}')
      or (reward_key='collective-training-200' and effect_kind='training_multiplier' and effect_payload @> '{"multiplier":2}')
      or (reward_key='energy-ration' and effect_kind='form_boost' and effect_payload @> '{"amount":5}')
      or (reward_key='injury-care-recovery-kit' and effect_kind='injury_care' and effect_payload @> '{"recoveryHours":12}')
    ))<>4 then raise exception 'Un consommable ne correspond plus à la dotation annoncée.'; end if;
  insert into public.season_gala_result_imports(event_key,season_id,results) values(p_event_key,v_season,v_results);
  for v_row in select * from jsonb_to_recordset(v_results) r(rank integer,rider_id uuid,team_id uuid) order by r.rank loop
    select ts.id team_season_id,s.id season_id,s.game_year,director.id director_id,
      concat_ws(' ',rider.first_name,rider.last_name) rider_name into strict v_target
      from public.team_seasons ts join public.seasons s on s.id=ts.season_id and s.status='active'
      join public.team_manager_assignments assignment on assignment.team_id=ts.team_id and assignment.role='general_manager' and assignment.status='active'
      join public.sporting_directors director on director.id=assignment.sporting_director_id and director.status='active'
      join public.riders rider on rider.id=v_row.rider_id
      where ts.team_id=v_row.team_id and ts.status in ('active','planned') for update of ts;
    if v_row.rank<=3 then
      select id,effect_summary into strict v_item,v_summary from public.equipment_catalog_items
        where catalog_key='gala-s4-'||v_profile||'-'||case v_row.rank when 1 then 'bib_shorts' when 2 then 'helmet' else 'shoes' end
          and acquisition_channel='event_reward' and status='active';
      insert into public.season_gala_reward_grants(event_key,rank,rider_id,team_id,team_season_id,sporting_director_id,equipment_item_id,unit_number)
        values(p_event_key,v_row.rank,v_row.rider_id,v_row.team_id,v_target.team_season_id,v_target.director_id,v_item,1);
      insert into public.team_equipment_inventory(team_season_id,equipment_item_id,quantity,last_purchase_price)
        values(v_target.team_season_id,v_item,1,0) on conflict(team_season_id,equipment_item_id)
        do update set quantity=public.team_equipment_inventory.quantity+1,updated_at=now();
      v_equipment:=v_equipment+1;
    else
      v_summary:='Consommables ajoutés à votre inventaire ; utilisez-les au moment de votre choix.';
      for v_reward in select * from (values
        ('secondary-technique',case when v_row.rank=4 then 1 else 0 end),
        ('collective-training-200',case when v_row.rank=5 then 3 else 0 end),
        ('energy-ration',case when v_row.rank=4 then 3 when v_row.rank<=7 then 2 else 1 end),
        ('injury-care-recovery-kit',case when v_row.rank<=5 then 2 else 1 end)
      ) packs(reward_key,quantity) where quantity>0 loop
        for v_unit in 1..v_reward.quantity loop
          insert into public.season_gala_reward_grants(event_key,rank,rider_id,team_id,team_season_id,sporting_director_id,reward_key,unit_number)
            values(p_event_key,v_row.rank,v_row.rider_id,v_row.team_id,v_target.team_season_id,v_target.director_id,v_reward.reward_key,v_unit) returning id into v_grant;
          insert into public.daily_reward_inventory(sporting_director_id,team_season_id,source_season_gala_reward_id,reward_key,expires_after_game_year)
            values(v_target.director_id,v_target.team_season_id,v_grant,v_reward.reward_key,v_target.game_year+1);
          v_consumables:=v_consumables+1;
        end loop;
      end loop;
    end if;
    insert into public.sporting_director_messages(sporting_director_id,season_id,team_season_id,message_type,sender_name,subject,preview,body,action_href,action_label,source_reference,is_important)
      values(v_target.director_id,v_target.season_id,v_target.team_season_id,'system','Grand Gala · Saison 4',
        'Vos gains du Grand Gala',v_target.rider_name||' · place '||v_row.rank,
        v_target.rider_name||' termine à la place '||v_row.rank||' ('||p_event_key||E').\n\n'||v_summary||E'\nLes lots sont disponibles dans votre inventaire. Aucun point, argent ou effet de course officiel n’a été ajouté.',
        '/jeu/inventaire','Voir mes gains','gala-s4:'||p_event_key||':'||v_row.rank,true)
      on conflict(sporting_director_id,source_reference) do nothing;
  end loop;
  v_receipt:=jsonb_build_object('eventKey',p_event_key,'rewardedRiders',10,'equipmentUnits',v_equipment,'consumableUnits',v_consumables,'alreadyImported',false);
  update public.season_gala_result_imports set receipt=v_receipt where event_key=p_event_key;
  return v_receipt;
end;$$;
revoke all on function public.settle_season_four_gala_results(text,jsonb) from public,anon,authenticated;
grant execute on function public.settle_season_four_gala_results(text,jsonb) to service_role;
comment on function public.settle_season_four_gala_results(text,jsonb) is 'Admin-only atomic S4 gala top-ten import and inventory awards. Idempotent; no official race settlement, cash, points, form, Twitch attendance gifts or automatic activation.';

-- The stage uses three ordinary queued boosts. Pin the chosen boost for the
-- entire session, including when several activations have identical timestamps.
-- Otherwise an equal-priority pending row can consume a second boost for the
-- next rider in that same session. Strongest-first still applies on later days.
create or replace function public.get_daily_reward_training_multiplier_for_session(p_team_id uuid,p_season_day_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_day record; v_effect record;
begin
  select day.season_id,day.day_number into v_day from public.season_days day where day.id=p_season_day_id;
  select effect.id,effect.effect_payload,effect.consumed_day_number into v_effect
  from public.daily_reward_active_effects effect
  where effect.team_id=p_team_id and effect.season_id=v_day.season_id and effect.effect_kind='training_multiplier'
    and ((effect.status='active' and effect.consumed_day_number is null and v_day.day_number between effect.starts_day_number and effect.ends_day_number)
      or (effect.status='consumed' and effect.consumed_day_number=v_day.day_number))
  order by case when effect.consumed_day_number=v_day.day_number then 0 else 1 end,
    ((effect.effect_payload->>'multiplier')::numeric) desc,effect.activated_at,effect.id
  limit 1 for update;
  if v_effect is null then return 1; end if;
  if v_effect.consumed_day_number is null then
    update public.daily_reward_active_effects set consumed_day_number=v_day.day_number,status='consumed' where id=v_effect.id;
  end if;
  return greatest(1,least(3,(v_effect.effect_payload->>'multiplier')::numeric));
end;$$;
revoke all on function public.get_daily_reward_training_multiplier_for_session(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_daily_reward_training_multiplier_for_session(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
