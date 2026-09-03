begin;

create table public.national_federation_selection_slots (
  slot_key text primary key,
  competition_code text not null,
  label text not null,
  rider_category text not null,
  profile_label text not null,
  host_country_code text not null,
  host_country_name text not null,
  day_number smallint not null,
  rider_limit smallint not null,
  active_from_game_year integer not null default 3,
  constraint national_federation_selection_slots_category_allowed check (
    rider_category in ('professional', 'junior')
  ),
  constraint national_federation_selection_slots_day_valid check (
    day_number between 1 and 28
  ),
  constraint national_federation_selection_slots_limit_valid check (
    rider_limit between 1 and 12
  )
);

insert into public.national_federation_selection_slots (
  slot_key, competition_code, label, rider_category, profile_label,
  host_country_code, host_country_name, day_number, rider_limit
)
values
  ('cc-pro-road', 'continental_championship', 'CC Pros · Route', 'professional', 'Route', 'NL', 'Pays-Bas', 22, 8),
  ('cc-pro-itt', 'continental_championship', 'CC Pros · CLM', 'professional', 'Chrono', 'NL', 'Pays-Bas', 22, 2),
  ('cc-junior-road', 'continental_championship_junior', 'CC Juniors · Route', 'junior', 'Route', 'NL', 'Pays-Bas', 22, 6),
  ('cc-junior-itt', 'continental_championship_junior', 'CC Juniors · CLM', 'junior', 'Chrono', 'NL', 'Pays-Bas', 22, 2),
  ('nc-mountain', 'nations_cup', 'Nations Cup · Montagne', 'professional', 'Montagne', 'CH', 'Suisse', 24, 1),
  ('nc-hills', 'nations_cup', 'Nations Cup · Vallons', 'professional', 'Vallons', 'CH', 'Suisse', 24, 1),
  ('nc-sprint', 'nations_cup', 'Nations Cup · Sprint', 'professional', 'Sprint', 'CH', 'Suisse', 24, 1),
  ('nc-cobbles', 'nations_cup', 'Nations Cup · Pavés', 'professional', 'Pavés', 'CH', 'Suisse', 24, 1),
  ('nc-time-trial', 'nations_cup', 'Nations Cup · Chrono', 'professional', 'Chrono', 'CH', 'Suisse', 24, 1),
  ('world-pro-road', 'world_championship', 'Mondiaux Pros · Route', 'professional', 'Route', 'CA', 'Canada', 26, 8),
  ('world-pro-itt', 'world_championship', 'Mondiaux Pros · CLM', 'professional', 'Chrono', 'CA', 'Canada', 26, 2),
  ('world-junior-road', 'world_championship_junior', 'Mondiaux Juniors · Route', 'junior', 'Route', 'CA', 'Canada', 26, 6),
  ('world-junior-itt', 'world_championship_junior', 'Mondiaux Juniors · CLM', 'junior', 'Chrono', 'CA', 'Canada', 26, 2);

create table public.national_federation_selection_lists (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  slot_key text not null
    references public.national_federation_selection_slots(slot_key),
  status text not null default 'draft',
  revision integer not null default 1,
  created_by_director_id uuid not null
    references public.sporting_directors(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint national_federation_selection_lists_status_allowed check (
    status in ('draft', 'pending_confirmation', 'finalized')
  ),
  constraint national_federation_selection_lists_revision_valid check (
    revision > 0
  ),
  constraint national_federation_selection_lists_country_slot_unique
    unique (country_id, season_id, slot_key)
);

create index national_federation_selection_lists_country_season_idx
  on public.national_federation_selection_lists (country_id, season_id, slot_key);

create table public.national_federation_selection_members (
  id uuid primary key default gen_random_uuid(),
  selection_list_id uuid not null
    references public.national_federation_selection_lists(id) on delete cascade,
  professional_rider_id uuid references public.riders(id) on delete cascade,
  junior_rider_id uuid references public.youth_academy_riders(id) on delete cascade,
  owner_team_id uuid references public.teams(id) on delete set null,
  owner_director_id uuid references public.sporting_directors(id) on delete set null,
  response_status text not null default 'draft',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint national_federation_selection_members_one_rider check (
    num_nonnulls(professional_rider_id, junior_rider_id) = 1
  ),
  constraint national_federation_selection_members_response_allowed check (
    response_status in ('draft', 'pending', 'confirmed', 'declined')
  )
);

create unique index national_federation_selection_members_professional_unique
  on public.national_federation_selection_members (
    selection_list_id, professional_rider_id
  ) where professional_rider_id is not null;
create unique index national_federation_selection_members_junior_unique
  on public.national_federation_selection_members (
    selection_list_id, junior_rider_id
  ) where junior_rider_id is not null;
create index national_federation_selection_members_owner_pending_idx
  on public.national_federation_selection_members (owner_director_id, created_at)
  where response_status = 'pending';

alter table public.national_federation_selection_slots enable row level security;
alter table public.national_federation_selection_lists enable row level security;
alter table public.national_federation_selection_members enable row level security;

create policy national_federation_selection_slots_select_authenticated
on public.national_federation_selection_slots for select to authenticated using (true);
create policy national_federation_selection_lists_select_authenticated
on public.national_federation_selection_lists for select to authenticated using (true);
create policy national_federation_selection_members_select_authenticated
on public.national_federation_selection_members for select to authenticated using (true);

grant select on table public.national_federation_selection_slots to authenticated;
grant select on table public.national_federation_selection_lists to authenticated;
grant select on table public.national_federation_selection_members to authenticated;
grant all on table public.national_federation_selection_slots to service_role;
grant all on table public.national_federation_selection_lists to service_role;
grant all on table public.national_federation_selection_members to service_role;

create or replace function public.save_national_federation_preselection(
  p_country_code text,
  p_slot_key text,
  p_rider_ids uuid[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_list_id uuid;
  v_revision integer;
  v_rider_ids uuid[] := coalesce(p_rider_ids, '{}'::uuid[]);
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour enregistrer une présélection.';
  end if;
  if upper(btrim(coalesce(p_country_code, ''))) <> 'BE' then
    raise exception 'La présélection est limitée à la fédération belge pendant la bêta.';
  end if;

  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  select * into v_season
  from public.seasons where status = 'active' limit 1;
  select * into v_slot
  from public.national_federation_selection_slots
  where slot_key = p_slot_key
    and active_from_game_year <= v_season.game_year;

  if v_identity.country_id is null or v_identity.team_id is null then
    raise exception 'Votre équipe ne fait pas partie de cette fédération.';
  end if;
  if v_season.id is null or v_season.game_year < 3 then
    raise exception 'Les présélections officielles seront disponibles à partir de la Saison 3.';
  end if;
  if v_slot.slot_key is null then
    raise exception 'Cette épreuve de sélection n’est pas disponible.';
  end if;
  if not exists (
    select 1
    from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Seul le président élu peut modifier la présélection.';
  end if;
  if cardinality(v_rider_ids) > v_slot.rider_limit then
    raise exception 'Le quota de cette épreuve est dépassé.';
  end if;
  if cardinality(v_rider_ids) <> (
    select count(distinct selected.rider_id)::integer
    from unnest(v_rider_ids) as selected(rider_id)
  ) then
    raise exception 'Un coureur ne peut apparaître deux fois dans la même liste.';
  end if;
  if v_slot.competition_code = 'nations_cup' and exists (
    select 1
    from public.national_federation_selection_lists as other_list
    join public.national_federation_selection_slots as other_slot
      on other_slot.slot_key = other_list.slot_key
     and other_slot.competition_code = 'nations_cup'
    join public.national_federation_selection_members as member
      on member.selection_list_id = other_list.id
    where other_list.country_id = v_identity.country_id
      and other_list.season_id = v_season.id
      and other_list.slot_key <> v_slot.slot_key
      and coalesce(member.professional_rider_id, member.junior_rider_id) = any(v_rider_ids)
  ) then
    raise exception 'Un coureur ne peut disputer qu’une seule épreuve de Nations Cup.';
  end if;

  if v_slot.rider_category = 'professional' then
    if (select count(*) from public.riders as rider
        where rider.id = any(v_rider_ids)
          and rider.country_id = v_identity.country_id
          and rider.status in ('active', 'free_agent')) <> cardinality(v_rider_ids) then
      raise exception 'La liste contient un coureur professionnel inéligible.';
    end if;
  elsif (select count(*) from public.youth_academy_riders as rider
         where rider.id = any(v_rider_ids)
           and rider.country_id = v_identity.country_id
           and rider.status in ('active', 'recruited', 'free_agent')) <> cardinality(v_rider_ids) then
    raise exception 'La liste contient un coureur junior inéligible.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_identity.country_id::text || ':' || v_season.id::text || ':' || v_slot.slot_key,
      0
    )
  );

  insert into public.national_federation_selection_lists (
    country_id, season_id, slot_key, status, revision, created_by_director_id
  ) values (
    v_identity.country_id, v_season.id, v_slot.slot_key, 'draft', 1,
    v_identity.sporting_director_id
  )
  on conflict (country_id, season_id, slot_key) do update set
    status = 'draft',
    revision = national_federation_selection_lists.revision + 1,
    created_by_director_id = excluded.created_by_director_id,
    published_at = null,
    updated_at = now()
  returning id, revision into v_list_id, v_revision;

  delete from public.national_federation_selection_members
  where selection_list_id = v_list_id;

  if v_slot.rider_category = 'professional' then
    insert into public.national_federation_selection_members (
      selection_list_id, professional_rider_id, owner_team_id,
      owner_director_id, response_status
    )
    select
      v_list_id,
      rider.id,
      owner_contract.team_id,
      owner_assignment.sporting_director_id,
      'draft'
    from unnest(v_rider_ids) as selected(rider_id)
    join public.riders as rider on rider.id = selected.rider_id
    left join lateral (
      select contract.team_id
      from public.rider_contracts as contract
      where contract.rider_id = rider.id and contract.status = 'active'
      order by contract.created_at desc, contract.id desc
      limit 1
    ) as owner_contract on true
    left join lateral (
      select assignment.sporting_director_id
      from public.team_manager_assignments as assignment
      where assignment.team_id = owner_contract.team_id
        and assignment.role = 'general_manager'
        and assignment.status = 'active'
      order by assignment.created_at desc, assignment.id desc
      limit 1
    ) as owner_assignment on true;
  else
    insert into public.national_federation_selection_members (
      selection_list_id, junior_rider_id, owner_team_id,
      owner_director_id, response_status
    )
    select
      v_list_id,
      rider.id,
      rider.team_id,
      owner_assignment.sporting_director_id,
      'draft'
    from unnest(v_rider_ids) as selected(rider_id)
    join public.youth_academy_riders as rider on rider.id = selected.rider_id
    left join lateral (
      select assignment.sporting_director_id
      from public.team_manager_assignments as assignment
      where assignment.team_id = rider.team_id
        and assignment.role = 'general_manager'
        and assignment.status = 'active'
      order by assignment.created_at desc, assignment.id desc
      limit 1
    ) as owner_assignment on true;
  end if;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_identity.country_id,
    v_season.id,
    v_season.current_day_number,
    'selection',
    'Présélection mise à jour',
    v_slot.label || ' · ' || cardinality(v_rider_ids)::text || '/' || v_slot.rider_limit::text || ' coureurs.',
    'federation-selection:' || v_list_id::text || ':revision:' || v_revision::text
  ) on conflict (source_reference) do nothing;

  return jsonb_build_object(
    'listId', v_list_id,
    'revision', v_revision,
    'riderCount', cardinality(v_rider_ids)
  );
end;
$$;

create or replace function public.publish_national_federation_preselection(
  p_country_code text,
  p_slot_key text
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_list public.national_federation_selection_lists%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_notified integer := 0;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  if upper(btrim(coalesce(p_country_code, ''))) <> 'BE' then
    raise exception 'La publication est limitée à la fédération belge pendant la bêta.';
  end if;
  select * into v_identity from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  select selection_list.* into v_list
  from public.national_federation_selection_lists as selection_list
  where selection_list.country_id = v_identity.country_id
    and selection_list.season_id = v_season.id
    and selection_list.slot_key = p_slot_key
  for update;
  select * into v_slot from public.national_federation_selection_slots
  where slot_key = p_slot_key;

  if v_season.game_year < 3 then
    raise exception 'La publication sera disponible à partir de la Saison 3.';
  end if;
  if v_list.id is null or v_slot.slot_key is null then
    raise exception 'Enregistrez d’abord une présélection.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Seul le président élu peut publier la présélection.';
  end if;

  update public.national_federation_selection_lists
  set status = 'pending_confirmation', published_at = now(), updated_at = now()
  where id = v_list.id;
  update public.national_federation_selection_members
  set
    response_status = case when owner_director_id is null then 'confirmed' else 'pending' end,
    responded_at = case when owner_director_id is null then now() else null end
  where selection_list_id = v_list.id;

  insert into public.sporting_director_messages (
    sporting_director_id, season_id, message_type, sender_name, subject,
    preview, body, action_href, action_label, source_reference, is_important
  )
  select
    member.owner_director_id,
    v_season.id,
    'international_selection',
    'Fédération belge',
    'Présélection nationale à confirmer',
    rider_name.name || ' est retenu pour ' || v_slot.label || '.',
    'Merci de confirmer ou refuser sa disponibilité. Le président pourra revoir sa liste après un refus.',
    '/jeu/federations/be?onglet=selections',
    'Répondre à la sélection',
    'federation-selection:' || member.id::text || ':revision:' || v_list.revision::text,
    true
  from public.national_federation_selection_members as member
  cross join lateral (
    select coalesce(
      (select rider.first_name || ' ' || rider.last_name from public.riders as rider where rider.id = member.professional_rider_id),
      (select rider.first_name || ' ' || rider.last_name from public.youth_academy_riders as rider where rider.id = member.junior_rider_id),
      'Un coureur'
    ) as name
  ) as rider_name
  where member.selection_list_id = v_list.id
    and member.owner_director_id is not null
  on conflict (sporting_director_id, source_reference) do nothing;
  get diagnostics v_notified = row_count;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number,
    'selection', 'Présélection soumise aux équipes',
    v_slot.label || ' · les DS concernés ont reçu une demande de confirmation.',
    'federation-selection:' || v_list.id::text || ':published:' || v_list.revision::text
  ) on conflict (source_reference) do nothing;

  return v_notified;
end;
$$;

create or replace function public.respond_to_national_federation_preselection(
  p_member_id uuid,
  p_accept boolean
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_member public.national_federation_selection_members%rowtype;
  v_list public.national_federation_selection_lists%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_rider_name text;
  v_president_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  select * into v_identity from public.get_current_federation_identity('BE');
  select * into v_season from public.seasons where status = 'active' limit 1;
  select * into v_member from public.national_federation_selection_members
  where id = p_member_id for update;
  select * into v_list from public.national_federation_selection_lists
  where id = v_member.selection_list_id;
  select * into v_slot from public.national_federation_selection_slots
  where slot_key = v_list.slot_key;

  if v_member.id is null
     or v_identity.team_id is null
     or v_member.owner_team_id <> v_identity.team_id
     or v_member.owner_director_id <> v_identity.sporting_director_id then
    raise exception 'Cette demande ne concerne pas votre équipe.';
  end if;
  if v_member.response_status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée.';
  end if;

  update public.national_federation_selection_members
  set response_status = case when p_accept then 'confirmed' else 'declined' end,
      responded_at = now()
  where id = v_member.id;

  select coalesce(
    (select rider.first_name || ' ' || rider.last_name from public.riders as rider where rider.id = v_member.professional_rider_id),
    (select rider.first_name || ' ' || rider.last_name from public.youth_academy_riders as rider where rider.id = v_member.junior_rider_id),
    'Le coureur'
  ) into v_rider_name;
  select term.president_director_id into v_president_id
  from public.national_federation_terms as term
  where term.country_id = v_list.country_id
    and term.start_game_year <= v_season.game_year
    and term.end_game_year >= v_season.game_year
  limit 1;

  if v_president_id is not null and v_president_id <> v_identity.sporting_director_id then
    insert into public.sporting_director_messages (
      sporting_director_id, season_id, message_type, sender_name, subject,
      preview, body, action_href, action_label, source_reference, is_important
    ) values (
      v_president_id, v_season.id, 'international_selection',
      v_identity.team_name,
      case when p_accept then 'Présélection confirmée' else 'Présélection refusée' end,
      v_rider_name || case when p_accept then ' sera disponible.' else ' ne sera pas disponible.' end,
      case when p_accept
        then 'La participation du coureur est confirmée par son DS.'
        else 'La liste doit être revue ou un remplaçant doit être appelé.' end,
      '/jeu/federations/be?onglet=selections', 'Voir la sélection',
      'federation-selection:' || v_member.id::text || ':response', not p_accept
    ) on conflict (sporting_director_id, source_reference) do nothing;
  end if;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_list.country_id, v_season.id, v_season.current_day_number, 'selection',
    case when p_accept then 'Disponibilité confirmée' else 'Disponibilité refusée' end,
    v_identity.team_name || ' · ' || v_rider_name || ' · ' || v_slot.label || '.',
    'federation-selection:' || v_member.id::text || ':response'
  ) on conflict (source_reference) do nothing;

  if not exists (
    select 1 from public.national_federation_selection_members
    where selection_list_id = v_list.id and response_status = 'pending'
  ) then
    update public.national_federation_selection_lists
    set status = 'finalized', updated_at = now()
    where id = v_list.id;
  end if;

  return case when p_accept then 'confirmed' else 'declined' end;
end;
$$;

do $dashboard_selection_alert$
declare
  v_definition text;
  v_previous text := $previous$
  selection_alerts as (
    select count(*)::integer as pending_selection_count
    from public.international_championship_rider_selections as selection
    join current_context as context
      on context.sporting_director_id = selection.sporting_director_id
    where selection.response_status = 'pending'
      and selection.is_selected = true
  ),
$previous$;
  v_replacement text := $replacement$
  selection_alerts as (
    select (
      count(selection.id)
      + (
        select count(*)
        from public.national_federation_selection_members as federation_member
        where federation_member.owner_director_id = context.sporting_director_id
          and federation_member.response_status = 'pending'
      )
    )::integer as pending_selection_count
    from current_context as context
    left join public.international_championship_rider_selections as selection
      on selection.sporting_director_id = context.sporting_director_id
     and selection.response_status = 'pending'
     and selection.is_selected = true
    group by context.sporting_director_id
  ),
$replacement$;
begin
  select replace(
    pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure),
    E'\r\n', E'\n'
  ) into v_definition;
  if strpos(v_definition, v_previous) = 0 then
    raise exception 'Le bloc des alertes de sélection du Bureau est introuvable.';
  end if;
  execute replace(v_definition, v_previous, v_replacement);
end;
$dashboard_selection_alert$;

revoke all on function public.save_national_federation_preselection(text, text, uuid[])
  from public, anon;
revoke all on function public.publish_national_federation_preselection(text, text)
  from public, anon;
revoke all on function public.respond_to_national_federation_preselection(uuid, boolean)
  from public, anon;
grant execute on function public.save_national_federation_preselection(text, text, uuid[])
  to authenticated, service_role;
grant execute on function public.publish_national_federation_preselection(text, text)
  to authenticated, service_role;
grant execute on function public.respond_to_national_federation_preselection(uuid, boolean)
  to authenticated, service_role;

comment on table public.national_federation_selection_lists is
  'Présélections fédérales versionnées par saison et épreuve.';
comment on table public.national_federation_selection_members is
  'Coureurs présélectionnés et décision tracée de leur DS propriétaire.';

notify pgrst, 'reload schema';

commit;
