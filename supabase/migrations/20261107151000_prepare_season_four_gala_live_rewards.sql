begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';
set local application_name = 'cyclostratege-gala-s4-live-rewards';

-- Preparation only. A trusted producer must supply verified attendance IDs.
insert into public.equipment_catalog_items (
  catalog_key, name, slot_type, status, supplier_key, supplier_name, description,
  price, rarity, image_path, effect_summary, effect_payload, acquisition_channel
) values (
  'gala-s4-live-gloves', 'Gants · Nuit dorée', 'gloves', 'active',
  'gala-saison-4', 'Grand Gala · Saison 4',
  'Cadeau exclusif pour les spectateurs du Grand Gala de la saison 4.',
  0, 'performance', '/images/equipment/products/montclair-podium-atelier.webp',
  '+1 VAL', '{"ratingBonuses":{"hills":1}}', 'event_reward'
);

create table public.season_gala_live_reward_grants (
  auth_user_id uuid primary key,
  sporting_director_id uuid not null unique references public.sporting_directors(id) on delete restrict,
  participant_name text not null check (btrim(participant_name) <> ''),
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  equipment_item_id uuid not null references public.equipment_catalog_items(id) on delete restrict,
  album_edition_id text not null references public.cyclo_stickers_editions(edition_id) on delete restrict,
  granted_at timestamptz not null default now()
);
alter table public.season_gala_live_reward_grants enable row level security;
revoke all on public.season_gala_live_reward_grants from public, anon, authenticated, service_role;
grant select on public.season_gala_live_reward_grants to service_role;

create function public.settle_season_four_gala_live_rewards(p_verified_director_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_directors uuid[];
  v_director_id uuid;
  v_target record;
  v_active_season uuid;
  v_gloves uuid;
  v_edition text;
  v_granted uuid[] := '{}';
  v_boosters integer := 0;
begin
  if p_verified_director_ids is null or cardinality(p_verified_director_ids) not between 1 and 500
    or array_position(p_verified_director_ids, null) is not null then
    raise exception 'Liste vérifiée des spectateurs du gala invalide.';
  end if;
  select array_agg(director_id order by director_id) into v_directors
  from (select distinct unnest(p_verified_director_ids) director_id) viewers;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('season-four-gala:live-rewards', 0));
  select id into strict v_active_season from public.seasons where status = 'active' for share;
  select id into v_gloves from public.equipment_catalog_items
  where catalog_key = 'gala-s4-live-gloves' and slot_type = 'gloves' and status = 'active'
    and acquisition_channel = 'event_reward' and effect_payload = '{"ratingBonuses":{"hills":1}}'::jsonb;
  select album.edition_id into v_edition from public.cyclo_stickers_editions album
  join public.seasons source on source.id = album.source_season_id and source.game_year = 4 and source.status = 'completed'
  join public.seasons collection on collection.id = album.collection_season_id and collection.game_year = 5;
  if v_gloves is null or v_edition is null then
    raise exception 'Les gants du gala ou l’édition Cyclo-Stickers S4/S5 sont indisponibles.';
  end if;

  foreach v_director_id in array v_directors loop
    if exists(select 1 from public.season_gala_live_reward_grants where sporting_director_id = v_director_id) then
      continue;
    end if;
    begin
      select d.auth_user_id, d.display_name, ts.id as team_season_id into strict v_target
      from public.sporting_directors d
      join public.team_manager_assignments assignment on assignment.sporting_director_id = d.id
        and assignment.role = 'general_manager' and assignment.status = 'active'
      join public.teams team on team.id = assignment.team_id and team.status = 'active'
      join public.team_seasons ts on ts.team_id = team.id and ts.season_id = v_active_season
        and ts.status in ('active', 'planned')
      where d.id = v_director_id and d.auth_user_id is not null and d.status = 'active'
      for update of ts;
    exception when no_data_found or too_many_rows then
      raise exception 'Chaque spectateur doit avoir un compte vérifié et une équipe active unique.';
    end;

    insert into public.season_gala_live_reward_grants(
      auth_user_id, sporting_director_id, participant_name, team_season_id, equipment_item_id, album_edition_id
    ) values (v_target.auth_user_id, v_director_id, v_target.display_name, v_target.team_season_id, v_gloves, v_edition)
    on conflict do nothing;
    if not found then continue; end if;

    insert into public.team_equipment_inventory(team_season_id, equipment_item_id, quantity, last_purchase_price)
    values (v_target.team_season_id, v_gloves, 1, 0)
    on conflict (team_season_id, equipment_item_id) do update
      set quantity = public.team_equipment_inventory.quantity + 1, updated_at = now();
    v_granted := array_append(v_granted, v_director_id);
  end loop;

  if cardinality(v_granted) > 0 then
    v_boosters := public.grant_cyclo_stickers_gala_boosters(v_edition, v_granted, 'grand-gala-s4-live-2026-11-06');
    -- Earlier booster-only awards count toward the same two-copy entitlement.
    if (select count(*) from public.cyclo_stickers_edition_boosters
      where edition_id = v_edition and acquisition_source = 'gala' and sporting_director_id = any(v_granted)) <> 2 * cardinality(v_granted) then
      raise exception 'La dotation en boosters du gala est incomplète.';
    end if;
  end if;
  return jsonb_build_object(
    'verifiedParticipants', cardinality(v_directors),
    'newGrants', cardinality(v_granted),
    'alreadyGranted', cardinality(v_directors) - cardinality(v_granted),
    'equipmentUnits', cardinality(v_granted),
    'boosterUnitsAdded', v_boosters,
    'albumEditionId', v_edition
  );
end;
$$;
revoke all on function public.settle_season_four_gala_live_rewards(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.settle_season_four_gala_live_rewards(uuid[]) to service_role;

commit;
