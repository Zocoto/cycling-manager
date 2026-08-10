begin;

-- ============================================================
-- PARRAINAGE
-- Un filleul est qualifie apres avoir termine le Criterium de la
-- decouverte. Les recompenses sont versees une seule fois par palier.
-- ============================================================

create table public.referral_profiles (
  sporting_director_id uuid primary key
    references public.sporting_directors(id) on delete cascade,
  referral_code text not null unique,
  created_at timestamptz not null default now(),
  constraint referral_profiles_code_format
    check (referral_code ~ '^DS-[A-F0-9]{12}$')
);

create table public.sporting_director_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  referred_director_id uuid unique
    references public.sporting_directors(id) on delete set null,
  referred_display_name text not null,
  referral_code_snapshot text not null,
  status text not null default 'registered',
  registered_at timestamptz not null default now(),
  qualified_at timestamptz,
  constraint sporting_director_referrals_status_allowed
    check (status in ('registered', 'qualified', 'rejected')),
  constraint sporting_director_referrals_not_self
    check (
      referred_director_id is null
      or referred_director_id <> referrer_director_id
    ),
  constraint sporting_director_referrals_qualification_consistent
    check (
      (status = 'qualified' and qualified_at is not null)
      or (status <> 'qualified' and qualified_at is null)
    )
);

create index sporting_director_referrals_referrer_status_idx
  on public.sporting_director_referrals (
    referrer_director_id,
    status,
    registered_at desc
  );

create table public.referral_reward_grants (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  milestone_count integer not null,
  reward_key text not null
    references public.daily_reward_catalog(reward_key) on delete restrict,
  granted_at timestamptz not null default now(),
  constraint referral_reward_grants_milestone_allowed
    check (milestone_count in (1, 3, 5, 10, 25)),
  constraint referral_reward_grants_one_per_milestone
    unique (sporting_director_id, milestone_count)
);

alter table public.daily_reward_inventory
  alter column source_claim_id drop not null;

alter table public.daily_reward_inventory
  add column source_referral_reward_id uuid unique
    references public.referral_reward_grants(id) on delete cascade;

alter table public.daily_reward_inventory
  add constraint daily_reward_inventory_exactly_one_source
  check (
    (source_claim_id is not null and source_referral_reward_id is null)
    or (source_claim_id is null and source_referral_reward_id is not null)
  );

-- ============================================================
-- CODE PERSONNEL
-- ============================================================

create or replace function private.ensure_referral_profile(
  p_sporting_director_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_attempt integer;
begin
  select profile.referral_code
  into v_code
  from public.referral_profiles as profile
  where profile.sporting_director_id = p_sporting_director_id;

  if v_code is not null then
    return v_code;
  end if;

  for v_attempt in 1..8 loop
    v_code := 'DS-' || upper(
      substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
    );

    begin
      insert into public.referral_profiles (
        sporting_director_id,
        referral_code
      ) values (
        p_sporting_director_id,
        v_code
      );

      return v_code;
    exception when unique_violation then
      -- Une collision est extremement improbable ; on regenere un code.
    end;
  end loop;

  raise exception 'Impossible de generer un code de parrainage unique.';
end;
$$;

revoke all
  on function private.ensure_referral_profile(uuid)
  from public, anon, authenticated;

create or replace function private.create_referral_profile_after_director()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_referral_profile(new.id);
  return new;
end;
$$;

create trigger create_referral_profile_after_director
  after insert on public.sporting_directors
  for each row
  execute function private.create_referral_profile_after_director();

do $$
declare
  v_director record;
begin
  for v_director in
    select director.id
    from public.sporting_directors as director
    left join public.referral_profiles as profile
      on profile.sporting_director_id = director.id
    where profile.sporting_director_id is null
  loop
    perform private.ensure_referral_profile(v_director.id);
  end loop;
end;
$$;

-- ============================================================
-- ATTRIBUTION A L'INSCRIPTION
-- Le code est transmis dans raw_user_meta_data.referral_code.
-- ============================================================

create or replace function private.create_sporting_director_after_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_manager_name text;
  normalized_referral_code text;
  v_director_id uuid;
begin
  normalized_manager_name := regexp_replace(
    btrim(coalesce(new.raw_user_meta_data ->> 'manager_name', '')),
    '[[:space:]]+',
    ' ',
    'g'
  );

  if char_length(normalized_manager_name) < 3
    or char_length(normalized_manager_name) > 30
  then
    raise exception using
      errcode = '22023',
      message = 'Le nom du directeur sportif doit contenir entre 3 et 30 caracteres.';
  end if;

  insert into public.sporting_directors (
    auth_user_id,
    username,
    display_name
  ) values (
    new.id,
    normalized_manager_name,
    normalized_manager_name
  )
  returning id into v_director_id;

  normalized_referral_code := upper(
    btrim(coalesce(new.raw_user_meta_data ->> 'referral_code', ''))
  );

  if normalized_referral_code ~ '^DS-[A-F0-9]{12}$' then
    insert into public.sporting_director_referrals (
      referrer_director_id,
      referred_director_id,
      referred_display_name,
      referral_code_snapshot
    )
    select
      profile.sporting_director_id,
      v_director_id,
      normalized_manager_name,
      profile.referral_code
    from public.referral_profiles as profile
    join public.sporting_directors as referrer
      on referrer.id = profile.sporting_director_id
     and referrer.status = 'active'
    where profile.referral_code = normalized_referral_code
      and profile.sporting_director_id <> v_director_id
    on conflict (referred_director_id) do nothing;
  end if;

  return new;
end;
$$;

-- ============================================================
-- QUALIFICATION ET RECOMPENSES
-- ============================================================

create or replace function private.sync_referral_rewards(
  p_sporting_director_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qualified_count integer;
  v_context record;
  v_milestone record;
  v_grant_id uuid;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('referral-reward:' || p_sporting_director_id::text, 0)
  );

  select count(*)::integer
  into v_qualified_count
  from public.sporting_director_referrals as referral
  where referral.referrer_director_id = p_sporting_director_id
    and referral.status = 'qualified';

  select
    team_season.id as team_season_id,
    season.game_year
  into v_context
  from public.team_manager_assignments as assignment
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
   and team_season.status in ('planned', 'active')
  where assignment.sporting_director_id = p_sporting_director_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  order by team_season.created_at desc
  limit 1;

  if v_context is null then
    return;
  end if;

  for v_milestone in
    select *
    from (values
      (1, 'secondary-technique'::text),
      (3, 'scouting-week-20'::text),
      (5, 'premium-equipment'::text),
      (10, 'talent-revealed'::text),
      (25, 'automatic-naturalization'::text)
    ) as milestones(milestone_count, reward_key)
    where milestones.milestone_count <= v_qualified_count
    order by milestones.milestone_count
  loop
    insert into public.referral_reward_grants (
      sporting_director_id,
      milestone_count,
      reward_key
    ) values (
      p_sporting_director_id,
      v_milestone.milestone_count,
      v_milestone.reward_key
    )
    on conflict (sporting_director_id, milestone_count) do update
      set reward_key = excluded.reward_key
    returning id into v_grant_id;

    insert into public.daily_reward_inventory (
      sporting_director_id,
      team_season_id,
      source_claim_id,
      source_referral_reward_id,
      reward_key,
      expires_after_game_year
    ) values (
      p_sporting_director_id,
      v_context.team_season_id,
      null,
      v_grant_id,
      v_milestone.reward_key,
      v_context.game_year + 1
    )
    on conflict (source_referral_reward_id) do nothing;
  end loop;
end;
$$;

revoke all
  on function private.sync_referral_rewards(uuid)
  from public, anon, authenticated;

create or replace function private.qualify_referral_after_criterium()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer_id uuid;
begin
  if new.tutorial_key <> 'criterium-discovery'
    or new.status <> 'completed'
    or (tg_op = 'UPDATE' and old.status = 'completed')
  then
    return new;
  end if;

  update public.sporting_director_referrals
  set
    status = 'qualified',
    qualified_at = coalesce(new.completed_at, now())
  where referred_director_id = new.sporting_director_id
    and status = 'registered'
  returning referrer_director_id into v_referrer_id;

  if v_referrer_id is not null then
    perform private.sync_referral_rewards(v_referrer_id);
  end if;

  return new;
end;
$$;

create trigger qualify_referral_after_criterium
  after insert or update of status on public.tutorial_progress
  for each row
  execute function private.qualify_referral_after_criterium();

-- Les comptes deja parraines ne peuvent pas exister avant cette migration,
-- mais cette synchronisation rend la migration relancable sur une base de test.
update public.sporting_director_referrals as referral
set
  status = 'qualified',
  qualified_at = progress.completed_at
from public.tutorial_progress as progress
where progress.sporting_director_id = referral.referred_director_id
  and progress.tutorial_key = 'criterium-discovery'
  and progress.status = 'completed'
  and referral.status = 'registered';

-- ============================================================
-- RPC PUBLIQUES
-- ============================================================

create or replace function public.get_public_referral_invitation(
  p_code text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', profile.referral_code,
    'referrerName', director.display_name
  )
  from public.referral_profiles as profile
  join public.sporting_directors as director
    on director.id = profile.sporting_director_id
   and director.status = 'active'
  where profile.referral_code = upper(btrim(coalesce(p_code, '')))
  limit 1;
$$;

create or replace function public.get_current_referral_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_code text;
  v_registered_count integer;
  v_qualified_count integer;
  v_referrals jsonb;
  v_milestones jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez etre connecte.';
  end if;

  select director.id
  into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_director_id is null then
    return null;
  end if;

  v_code := private.ensure_referral_profile(v_director_id);
  perform private.sync_referral_rewards(v_director_id);

  select
    count(*)::integer,
    count(*) filter (where referral.status = 'qualified')::integer
  into v_registered_count, v_qualified_count
  from public.sporting_director_referrals as referral
  where referral.referrer_director_id = v_director_id
    and referral.status <> 'rejected';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', referral.id,
    'displayName', referral.referred_display_name,
    'status', referral.status,
    'registeredAt', referral.registered_at,
    'qualifiedAt', referral.qualified_at
  ) order by referral.registered_at desc), '[]'::jsonb)
  into v_referrals
  from public.sporting_director_referrals as referral
  where referral.referrer_director_id = v_director_id
    and referral.status <> 'rejected';

  select jsonb_agg(jsonb_build_object(
    'count', milestone.milestone_count,
    'rewardKey', milestone.reward_key,
    'rewardName', catalog.name,
    'rewardSummary', catalog.effect_summary,
    'rewardLevel', catalog.importance,
    'granted', grant_row.id is not null,
    'grantedAt', grant_row.granted_at
  ) order by milestone.milestone_count)
  into v_milestones
  from (values
    (1, 'secondary-technique'::text),
    (3, 'scouting-week-20'::text),
    (5, 'premium-equipment'::text),
    (10, 'talent-revealed'::text),
    (25, 'automatic-naturalization'::text)
  ) as milestone(milestone_count, reward_key)
  join public.daily_reward_catalog as catalog
    on catalog.reward_key = milestone.reward_key
  left join public.referral_reward_grants as grant_row
    on grant_row.sporting_director_id = v_director_id
   and grant_row.milestone_count = milestone.milestone_count;

  return jsonb_build_object(
    'code', v_code,
    'registeredCount', v_registered_count,
    'qualifiedCount', v_qualified_count,
    'patronOutfitUnlocked', v_qualified_count >= 5,
    'referrals', v_referrals,
    'milestones', coalesce(v_milestones, '[]'::jsonb)
  );
end;
$$;

-- ============================================================
-- RLS ET PRIVILEGES
-- ============================================================

alter table public.referral_profiles enable row level security;
alter table public.sporting_director_referrals enable row level security;
alter table public.referral_reward_grants enable row level security;

create policy referral_profiles_read_own
on public.referral_profiles for select to authenticated
using (
  exists (
    select 1 from public.sporting_directors as director
    where director.id = referral_profiles.sporting_director_id
      and director.auth_user_id = auth.uid()
  )
);

create policy sporting_director_referrals_read_own
on public.sporting_director_referrals for select to authenticated
using (
  exists (
    select 1 from public.sporting_directors as director
    where director.id = sporting_director_referrals.referrer_director_id
      and director.auth_user_id = auth.uid()
  )
);

create policy referral_reward_grants_read_own
on public.referral_reward_grants for select to authenticated
using (
  exists (
    select 1 from public.sporting_directors as director
    where director.id = referral_reward_grants.sporting_director_id
      and director.auth_user_id = auth.uid()
  )
);

revoke all on table public.referral_profiles from public, anon, authenticated;
revoke all on table public.sporting_director_referrals from public, anon, authenticated;
revoke all on table public.referral_reward_grants from public, anon, authenticated;

grant select on table public.referral_profiles to authenticated;
grant select on table public.sporting_director_referrals to authenticated;
grant select on table public.referral_reward_grants to authenticated;
grant all privileges on table public.referral_profiles to service_role;
grant all privileges on table public.sporting_director_referrals to service_role;
grant all privileges on table public.referral_reward_grants to service_role;

revoke all on function public.get_public_referral_invitation(text) from public;
grant execute on function public.get_public_referral_invitation(text)
  to anon, authenticated, service_role;

revoke all on function public.get_current_referral_overview() from public;
grant execute on function public.get_current_referral_overview()
  to authenticated, service_role;

comment on table public.sporting_director_referrals is
  'Parrainages attribues a l inscription et qualifies apres le Criterium de la decouverte.';

comment on table public.referral_reward_grants is
  'Objets accordes une seule fois pour chaque palier de filleuls qualifies.';

notify pgrst, 'reload schema';

commit;
