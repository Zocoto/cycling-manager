begin;

-- Deux comptes distincts portent le nom public Gouille. Le compte joueur qui
-- possède les trois filleuls historiques utilise le username gouilleTW ; les
-- deux rattachements nominatifs récents ont été dirigés vers l'autre compte.
-- Cette réparation ne touche qu'aux deux filleuls explicitement confirmés.
do $$
declare
  v_incorrect_account_id uuid;
  v_target_account_id uuid;
  v_target_referral_code text;
  v_incorrect_account_count integer;
  v_target_account_count integer;
  v_candidate_count integer;
  v_unexpected_assignments text;
  v_incorrect_reward_count integer;
  v_target_qualified_count integer;
begin
  select count(*)::integer
  into v_incorrect_account_count
  from public.sporting_directors as director
  where lower(director.username) = 'gouille';

  select count(*)::integer
  into v_target_account_count
  from public.sporting_directors as director
  where lower(director.username) = 'gouilletw';

  if v_incorrect_account_count <> 1 or v_target_account_count <> 1 then
    raise exception
      'Reparation Gouille refusee : comptes source=% cible=%.',
      v_incorrect_account_count,
      v_target_account_count;
  end if;

  select director.id
  into v_incorrect_account_id
  from public.sporting_directors as director
  where lower(director.username) = 'gouille';

  select director.id, profile.referral_code
  into v_target_account_id, v_target_referral_code
  from public.sporting_directors as director
  join public.referral_profiles as profile
    on profile.sporting_director_id = director.id
  where lower(director.username) = 'gouilletw';

  select count(*)::integer
  into v_candidate_count
  from public.sporting_directors as candidate
  where lower(candidate.username) in ('tymeo2202', 'lutchomania24');

  if v_candidate_count <> 2 then
    raise exception
      'Reparation Gouille refusee : % filleul(s) nominatif(s) trouve(s).',
      v_candidate_count;
  end if;

  select string_agg(
    candidate.username || '->' || coalesce(referrer.username, 'aucun'),
    ', '
    order by candidate.username
  )
  into v_unexpected_assignments
  from public.sporting_directors as candidate
  left join public.sporting_director_referrals as referral
    on referral.referred_director_id = candidate.id
  left join public.sporting_directors as referrer
    on referrer.id = referral.referrer_director_id
  where lower(candidate.username) in ('tymeo2202', 'lutchomania24')
    and (
      referral.id is null
      or referral.referrer_director_id not in (
        v_incorrect_account_id,
        v_target_account_id
      )
    );

  if v_unexpected_assignments is not null then
    raise exception
      'Reparation Gouille refusee : attribution inattendue [%].',
      v_unexpected_assignments;
  end if;

  -- Le compte source n'a ni équipe active ni récompense de parrainage. Cette
  -- garde empêche néanmoins toute réattribution future après consommation.
  select count(*)::integer
  into v_incorrect_reward_count
  from public.referral_reward_grants as reward
  where reward.sporting_director_id = v_incorrect_account_id;

  if v_incorrect_reward_count <> 0 then
    raise exception
      'Reparation Gouille refusee : le compte source possede % palier(s).',
      v_incorrect_reward_count;
  end if;

  update public.sporting_director_referrals as referral
  set
    referrer_director_id = v_target_account_id,
    referral_code_snapshot = v_target_referral_code
  from public.sporting_directors as candidate
  where referral.referred_director_id = candidate.id
    and lower(candidate.username) in ('tymeo2202', 'lutchomania24')
    and referral.referrer_director_id in (
      v_incorrect_account_id,
      v_target_account_id
    );

  update public.sporting_director_referrals as referral
  set
    status = 'qualified',
    qualified_at = coalesce(referral.qualified_at, auth_user.email_confirmed_at)
  from public.sporting_directors as candidate
  join auth.users as auth_user
    on auth_user.id = candidate.auth_user_id
  where referral.referred_director_id = candidate.id
    and referral.referrer_director_id = v_target_account_id
    and lower(candidate.username) in ('tymeo2202', 'lutchomania24')
    and auth_user.email_confirmed_at is not null;

  perform private.sync_referral_rewards(v_incorrect_account_id);
  perform private.sync_referral_rewards(v_target_account_id);

  select count(*)::integer
  into v_target_qualified_count
  from public.sporting_director_referrals as referral
  where referral.referrer_director_id = v_target_account_id
    and referral.status = 'qualified';

  if v_target_qualified_count < 5 then
    raise exception
      'Reparation Gouille incomplete : seulement % filleuls qualifies.',
      v_target_qualified_count;
  end if;

  raise notice
    'Parrainage Gouille repare : % filleuls qualifies sur gouilleTW.',
    v_target_qualified_count;
end;
$$;

commit;
