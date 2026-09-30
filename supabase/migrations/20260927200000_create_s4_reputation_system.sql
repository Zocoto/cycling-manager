begin;

-- La réputation devient une progression ouverte. Seule l'expérience conserve
-- son plafond de niveau 50.
alter table public.sporting_directors
  drop constraint if exists sporting_directors_reputation_points_cap;

create or replace function public.enforce_sporting_director_progression_caps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.reputation_points := greatest(0, coalesce(new.reputation_points, 0));
  new.experience_points := least(new.experience_points, 63700);
  return new;
end;
$$;

alter table public.sporting_directors
  add column if not exists peak_reputation_points numeric(12, 2) not null default 0;

update public.sporting_directors
set peak_reputation_points = greatest(peak_reputation_points, reputation_points);

create or replace function private.track_sporting_director_peak_reputation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.peak_reputation_points := greatest(
    coalesce(old.peak_reputation_points, 0),
    coalesce(new.peak_reputation_points, 0),
    coalesce(new.reputation_points, 0)
  );
  return new;
end;
$$;

drop trigger if exists track_sporting_director_peak_reputation
  on public.sporting_directors;
create trigger track_sporting_director_peak_reputation
before update of reputation_points, peak_reputation_points
on public.sporting_directors
for each row execute function private.track_sporting_director_peak_reputation();

create table public.reputation_ledger (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  source_type text not null,
  source_reference text not null,
  requested_delta numeric(12, 2) not null,
  applied_delta numeric(12, 2) not null,
  points_before numeric(12, 2) not null,
  points_after numeric(12, 2) not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint reputation_ledger_source_not_empty
    check (btrim(source_type) <> '' and btrim(source_reference) <> ''),
  constraint reputation_ledger_description_not_empty
    check (btrim(description) <> ''),
  constraint reputation_ledger_points_valid
    check (points_before >= 0 and points_after >= 0),
  unique (source_reference)
);

create index reputation_ledger_director_created_idx
  on public.reputation_ledger (sporting_director_id, created_at desc);

alter table public.reputation_ledger enable row level security;
create policy reputation_ledger_select_own
  on public.reputation_ledger for select to authenticated
  using (
    exists (
      select 1 from public.sporting_directors as director
      where director.id = reputation_ledger.sporting_director_id
        and director.auth_user_id = auth.uid()
    )
  );
grant select on public.reputation_ledger to authenticated;
grant all privileges on public.reputation_ledger to service_role;

create table public.reputation_commitments (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  source_type text not null,
  source_id uuid not null,
  amount numeric(12, 2) not null,
  status text not null default 'active',
  settlement_outcome text,
  loss_amount numeric(12, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint reputation_commitments_amount_positive check (amount > 0),
  constraint reputation_commitments_status_allowed
    check (status in ('active', 'released', 'lost', 'cancelled')),
  constraint reputation_commitments_loss_valid
    check (loss_amount >= 0 and loss_amount <= amount),
  constraint reputation_commitments_settlement_valid check (
    (status = 'active' and settled_at is null and settlement_outcome is null)
    or (status <> 'active' and settled_at is not null and settlement_outcome is not null)
  ),
  unique (source_type, source_id)
);

create index reputation_commitments_director_status_idx
  on public.reputation_commitments (sporting_director_id, status);

alter table public.reputation_commitments enable row level security;
create policy reputation_commitments_select_own
  on public.reputation_commitments for select to authenticated
  using (
    exists (
      select 1 from public.sporting_directors as director
      where director.id = reputation_commitments.sporting_director_id
        and director.auth_user_id = auth.uid()
    )
  );
grant select on public.reputation_commitments to authenticated;
grant all privileges on public.reputation_commitments to service_role;

create or replace function private.get_available_reputation(
  p_sporting_director_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(
    0,
    coalesce(director.reputation_points, 0)
      - coalesce(sum(commitment.amount) filter (where commitment.status = 'active'), 0)
  )
  from public.sporting_directors as director
  left join public.reputation_commitments as commitment
    on commitment.sporting_director_id = director.id
  where director.id = p_sporting_director_id
  group by director.id, director.reputation_points;
$$;

create or replace function private.apply_reputation_delta(
  p_sporting_director_id uuid,
  p_season_id uuid,
  p_delta numeric,
  p_source_type text,
  p_source_reference text,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before numeric(12, 2);
  v_after numeric(12, 2);
  v_existing numeric(12, 2);
begin
  select ledger.applied_delta into v_existing
  from public.reputation_ledger as ledger
  where ledger.source_reference = p_source_reference;
  if found then return v_existing; end if;

  select reputation_points into v_before
  from public.sporting_directors
  where id = p_sporting_director_id
  for update;
  if not found then raise exception 'Directeur Sportif introuvable.'; end if;

  v_after := greatest(0, v_before + round(coalesce(p_delta, 0), 2));
  update public.sporting_directors
  set reputation_points = v_after
  where id = p_sporting_director_id;

  insert into public.reputation_ledger (
    sporting_director_id, season_id, source_type, source_reference,
    requested_delta, applied_delta, points_before, points_after,
    description, metadata
  ) values (
    p_sporting_director_id, p_season_id, p_source_type, p_source_reference,
    round(coalesce(p_delta, 0), 2), v_after - v_before, v_before, v_after,
    btrim(p_description), coalesce(p_metadata, '{}'::jsonb)
  );

  return v_after - v_before;
end;
$$;

create or replace function private.create_reputation_commitment(
  p_sporting_director_id uuid,
  p_season_id uuid,
  p_team_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_amount numeric,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_commitment_id uuid;
  v_game_year integer;
  v_available numeric;
begin
  if coalesce(p_amount, 0) <= 0 then return null; end if;

  select game_year into v_game_year from public.seasons where id = p_season_id;
  if coalesce(v_game_year, 0) < 4 then
    raise exception 'Les engagements de réputation ouvrent en saison 4.';
  end if;

  perform 1 from public.sporting_directors
  where id = p_sporting_director_id for update;
  v_available := private.get_available_reputation(p_sporting_director_id);
  if v_available < p_amount then
    raise exception 'Réputation disponible insuffisante : % point(s) disponible(s).', v_available;
  end if;

  insert into public.reputation_commitments (
    sporting_director_id, season_id, team_id, source_type,
    source_id, amount, metadata
  ) values (
    p_sporting_director_id, p_season_id, p_team_id, btrim(p_source_type),
    p_source_id, round(p_amount, 2), coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (source_type, source_id) do update
    set source_type = excluded.source_type
  returning id into v_commitment_id;

  return v_commitment_id;
end;
$$;

create or replace function private.settle_reputation_commitment(
  p_commitment_id uuid,
  p_outcome text,
  p_loss_ratio numeric default 0
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_commitment public.reputation_commitments%rowtype;
  v_loss numeric(12, 2);
  v_applied numeric(12, 2) := 0;
begin
  select * into v_commitment
  from public.reputation_commitments
  where id = p_commitment_id
  for update;
  if not found or v_commitment.status <> 'active' then return 0; end if;

  v_loss := round(v_commitment.amount * least(1, greatest(0, coalesce(p_loss_ratio, 0))), 2);
  if v_loss > 0 then
    v_applied := private.apply_reputation_delta(
      v_commitment.sporting_director_id,
      v_commitment.season_id,
      -v_loss,
      'reputation_commitment',
      'reputation-commitment:' || v_commitment.id,
      case p_outcome
        when 'failed' then 'Engagement de réputation perdu'
        when 'withdrawn' then 'Retrait d’un engagement de réputation'
        else 'Engagement de réputation partiellement perdu'
      end,
      jsonb_build_object(
        'commitmentId', v_commitment.id,
        'sourceType', v_commitment.source_type,
        'outcome', p_outcome
      )
    );
  end if;

  update public.reputation_commitments
  set status = case
        when v_loss <= 0 then case when p_outcome = 'cancelled' then 'cancelled' else 'released' end
        else 'lost'
      end,
      settlement_outcome = p_outcome,
      loss_amount = v_loss,
      settled_at = now()
  where id = v_commitment.id;

  return v_applied;
end;
$$;

create or replace function private.spend_reputation(
  p_sporting_director_id uuid,
  p_season_id uuid,
  p_cost numeric,
  p_source_reference text,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_available numeric;
begin
  if coalesce(p_cost, 0) <= 0 then return 0; end if;
  perform 1 from public.sporting_directors
  where id = p_sporting_director_id for update;
  v_available := private.get_available_reputation(p_sporting_director_id);
  if v_available < p_cost then
    raise exception 'Réputation disponible insuffisante : % point(s) disponible(s).', v_available;
  end if;
  return private.apply_reputation_delta(
    p_sporting_director_id, p_season_id, -p_cost,
    'reputation_spend', p_source_reference, p_description, p_metadata
  );
end;
$$;

create or replace function public.get_current_reputation_overview()
returns table (
  current_points numeric,
  committed_points numeric,
  available_points numeric,
  peak_points numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    director.reputation_points,
    coalesce(sum(commitment.amount) filter (where commitment.status = 'active'), 0),
    greatest(
      0,
      director.reputation_points
        - coalesce(sum(commitment.amount) filter (where commitment.status = 'active'), 0)
    ),
    greatest(director.peak_reputation_points, director.reputation_points)
  from public.sporting_directors as director
  left join public.reputation_commitments as commitment
    on commitment.sporting_director_id = director.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  group by director.id;
$$;

revoke all on function public.get_current_reputation_overview() from public, anon;
grant execute on function public.get_current_reputation_overview() to authenticated;
revoke all on function private.apply_reputation_delta(uuid, uuid, numeric, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.create_reputation_commitment(uuid, uuid, uuid, text, uuid, numeric, jsonb) from public, anon, authenticated;
revoke all on function private.settle_reputation_commitment(uuid, text, numeric) from public, anon, authenticated;
revoke all on function private.spend_reputation(uuid, uuid, numeric, text, text, jsonb) from public, anon, authenticated;
grant execute on function private.apply_reputation_delta(uuid, uuid, numeric, text, text, text, jsonb) to service_role;
grant execute on function private.create_reputation_commitment(uuid, uuid, uuid, text, uuid, numeric, jsonb) to service_role;
grant execute on function private.settle_reputation_commitment(uuid, text, numeric) to service_role;
grant execute on function private.spend_reputation(uuid, uuid, numeric, text, text, jsonb) to service_role;

-- À la fin de chaque saison à partir de S4, seule la part au-dessus de 300
-- points s'érode. Les victoires mondiales ou Elite réduisent cette érosion.
create table public.reputation_season_maintenance (
  season_id uuid not null references public.seasons(id) on delete cascade,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  base_penalty numeric(12, 2) not null,
  prestige_offset numeric(12, 2) not null,
  applied_penalty numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  primary key (season_id, sporting_director_id)
);
alter table public.reputation_season_maintenance enable row level security;
grant all privileges on public.reputation_season_maintenance to service_role;

create or replace function private.apply_reputation_season_maintenance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_director record;
  v_rate numeric;
  v_base numeric(12, 2);
  v_offset numeric(12, 2);
  v_penalty numeric(12, 2);
begin
  if new.status <> 'completed' or old.status = 'completed' or new.game_year < 4 then
    return new;
  end if;

  for v_director in
    select distinct director.id, director.reputation_points, assignment.team_id
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
    where director.status = 'active'
  loop
    if v_director.reputation_points <= 300 then continue; end if;
    v_rate := case
      when v_director.reputation_points >= 1250 then 0.07
      when v_director.reputation_points >= 750 then 0.05
      else 0.03
    end;
    v_base := least(75, round((v_director.reputation_points - 300) * v_rate, 2));

    select least(50, count(*) * 5)::numeric into v_offset
    from public.race_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    join public.team_seasons as team_season on team_season.id = registration.team_season_id
    join public.race_editions as edition on edition.id = result.race_edition_id
    join public.race_categories as category on category.id = edition.race_category_id
    where team_season.team_id = v_director.team_id
      and team_season.season_id = new.id
      and result.final_rank = 1
      and result.status = 'classified'
      and category.code in ('world', 'elite');

    v_penalty := greatest(0, v_base - coalesce(v_offset, 0));
    insert into public.reputation_season_maintenance (
      season_id, sporting_director_id, base_penalty, prestige_offset, applied_penalty
    ) values (new.id, v_director.id, v_base, coalesce(v_offset, 0), v_penalty)
    on conflict do nothing;

    if found and v_penalty > 0 then
      perform private.apply_reputation_delta(
        v_director.id, new.id, -v_penalty, 'season_maintenance',
        'season-maintenance:' || new.id || ':' || v_director.id,
        'Maintien de la notoriété en fin de saison',
        jsonb_build_object('basePenalty', v_base, 'prestigeOffset', coalesce(v_offset, 0))
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists apply_reputation_season_maintenance on public.seasons;
create trigger apply_reputation_season_maintenance
after update of status on public.seasons
for each row execute function private.apply_reputation_season_maintenance();

comment on column public.sporting_directors.peak_reputation_points is
  'Record historique conservé même après une dépense ou une pénalité.';
comment on table public.reputation_commitments is
  'Réputation temporairement réservée par une promesse publique ou une candidature.';
comment on table public.reputation_ledger is
  'Journal idempotent des dépenses et pertes de réputation à partir de la saison 4.';

commit;
