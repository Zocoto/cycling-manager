begin;

-- Le parrainage doit recompenser une invitation reussie sans imposer le
-- didacticiel au filleul. L'unicite du filleul et l'anti-auto-parrainage
-- restent garantis par les contraintes existantes.
drop trigger if exists qualify_referral_after_criterium
  on public.tutorial_progress;
drop function if exists private.qualify_referral_after_criterium();

create or replace function private.qualify_referral_after_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer_id uuid;
begin
  update public.sporting_director_referrals as referral
  set
    status = 'qualified',
    qualified_at = coalesce(referral.qualified_at, now())
  where referral.id = new.id
    and referral.status = 'registered'
  returning referral.referrer_director_id into v_referrer_id;

  if v_referrer_id is not null then
    perform private.sync_referral_rewards(v_referrer_id);
  end if;

  return new;
end;
$$;

revoke all
  on function private.qualify_referral_after_signup()
  from public, anon, authenticated;

create trigger qualify_referral_after_signup
  after insert on public.sporting_director_referrals
  for each row
  execute function private.qualify_referral_after_signup();

-- Les cinq paliers deviennent volontairement premium. Une recompense deja
-- consommee reste intacte ; une recompense encore disponible est revalorisee.
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
      (1, 'premium-equipment'::text),
      (3, 'primary-breakthrough'::text),
      (5, 'talent-revealed-plus'::text),
      (10, 'staff-expertise-badge'::text),
      (25, 'high-performance-cell'::text)
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
    on conflict (source_referral_reward_id) do update
      set reward_key = excluded.reward_key
      where daily_reward_inventory.status = 'available';
  end loop;
end;
$$;

revoke all
  on function private.sync_referral_rewards(uuid)
  from public, anon, authenticated;

-- Les primes d'objectifs de carriere deviennent elles aussi structurantes.
-- Les reclamations deja versees ne sont pas modifiees.
update public.game_objective_definitions
set
  reward_cash = case objective_key
    when 'referral_qualified_1' then 75000
    when 'referral_qualified_5' then 350000
    when 'referral_qualified_25' then 2000000
  end,
  reward_experience = case objective_key
    when 'referral_qualified_1' then 120
    when 'referral_qualified_5' then 600
    when 'referral_qualified_25' then 2500
  end,
  reward_reputation = case objective_key
    when 'referral_qualified_1' then 5
    when 'referral_qualified_5' then 25
    when 'referral_qualified_25' then 100
  end,
  reward_random_special_ability =
    objective_key = 'referral_qualified_25',
  updated_at = now()
where objective_key in (
  'referral_qualified_1',
  'referral_qualified_5',
  'referral_qualified_25'
);

-- Regularisation des invitations encore en attente et mise a niveau des
-- objets disponibles pour tous les parrains deja qualifies.
update public.sporting_director_referrals
set
  status = 'qualified',
  qualified_at = coalesce(qualified_at, now())
where status = 'registered';

do $$
declare
  v_referrer_id uuid;
begin
  for v_referrer_id in
    select distinct referral.referrer_director_id
    from public.sporting_director_referrals as referral
    where referral.status = 'qualified'
  loop
    perform private.sync_referral_rewards(v_referrer_id);
  end loop;
end;
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
    (1, 'premium-equipment'::text),
    (3, 'primary-breakthrough'::text),
    (5, 'talent-revealed-plus'::text),
    (10, 'staff-expertise-badge'::text),
    (25, 'high-performance-cell'::text)
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
    'patronHatUnlocked', v_qualified_count >= 25,
    'referrals', v_referrals,
    'milestones', coalesce(v_milestones, '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
