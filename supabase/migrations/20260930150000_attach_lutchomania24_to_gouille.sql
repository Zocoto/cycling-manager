begin;

-- Rattrapage nominatif demandé après confirmation du pseudo exact.
-- Le compte a utilisé par erreur le code de gouilleTW. La réattribution est
-- bornée à ce seul ancien parrain et refuse de rendre un palier déjà accordé
-- injustifié après le déplacement.
do $$
declare
  v_gouille_id uuid;
  v_gouille_code text;
  v_candidate_id uuid;
  v_candidate_name text;
  v_email_confirmed_at timestamptz;
  v_existing_referrer_id uuid;
  v_existing_referrer_name text;
  v_existing_referral_status text;
  v_existing_referrer_qualified_count integer;
  v_existing_referrer_rewards text;
  v_candidate_count integer;
begin
  select director.id, profile.referral_code
  into v_gouille_id, v_gouille_code
  from public.sporting_directors as director
  join public.referral_profiles as profile
    on profile.sporting_director_id = director.id
  where lower(director.username) = 'gouille'
  order by director.created_at asc
  limit 1;

  if v_gouille_id is null then
    raise exception
      'Rattrapage parrainage lutchomania24 : directeur Gouille introuvable.';
  end if;

  select count(*)::integer
  into v_candidate_count
  from public.sporting_directors as director
  where lower(director.username) = 'lutchomania24';

  if v_candidate_count <> 1 then
    raise exception
      'Rattrapage parrainage lutchomania24 ambigu : % compte(s) exact(s).',
      v_candidate_count;
  end if;

  select
    director.id,
    director.display_name,
    auth_user.email_confirmed_at
  into
    v_candidate_id,
    v_candidate_name,
    v_email_confirmed_at
  from public.sporting_directors as director
  join auth.users as auth_user
    on auth_user.id = director.auth_user_id
  where lower(director.username) = 'lutchomania24';

  select
    referral.referrer_director_id,
    coalesce(referrer.username, referrer.display_name),
    referral.status
  into
    v_existing_referrer_id,
    v_existing_referrer_name,
    v_existing_referral_status
  from public.sporting_director_referrals as referral
  join public.sporting_directors as referrer
    on referrer.id = referral.referrer_director_id
  where referral.referred_director_id = v_candidate_id;

  if v_existing_referrer_id is not null
     and v_existing_referrer_id <> v_gouille_id then
    select count(*)::integer
    into v_existing_referrer_qualified_count
    from public.sporting_director_referrals as referral
    where referral.referrer_director_id = v_existing_referrer_id
      and referral.status = 'qualified';

    if lower(v_existing_referrer_name) <> 'gouilletw' then
      raise exception
        'Rattrapage lutchomania24 refuse : le parrain actuel est %.',
        v_existing_referrer_name;
    end if;

    select string_agg(
      reward.milestone_count::text || ':' || coalesce(inventory.status, 'sans-inventaire'),
      ', '
      order by reward.milestone_count
    )
    into v_existing_referrer_rewards
    from public.referral_reward_grants as reward
    left join public.daily_reward_inventory as inventory
      on inventory.source_referral_reward_id = reward.id
    where reward.sporting_director_id = v_existing_referrer_id;

    if exists (
      select 1
      from public.referral_reward_grants as reward
      where reward.sporting_director_id = v_existing_referrer_id
        and reward.milestone_count > (
          v_existing_referrer_qualified_count
          - case when v_existing_referral_status = 'qualified' then 1 else 0 end
        )
    ) then
      raise exception
        'Rattrapage lutchomania24 refuse : un palier de gouilleTW deviendrait injustifie [%].',
        coalesce(v_existing_referrer_rewards, 'aucune');
    end if;

    update public.sporting_director_referrals as referral
    set
      referrer_director_id = v_gouille_id,
      referral_code_snapshot = v_gouille_code
    where referral.referred_director_id = v_candidate_id
      and referral.referrer_director_id = v_existing_referrer_id;

    perform private.sync_referral_rewards(v_existing_referrer_id);
  end if;

  if v_existing_referrer_id is null then
    insert into public.sporting_director_referrals (
      referrer_director_id,
      referred_director_id,
      referred_display_name,
      referral_code_snapshot,
      status,
      qualified_at
    ) values (
      v_gouille_id,
      v_candidate_id,
      v_candidate_name,
      v_gouille_code,
      case
        when v_email_confirmed_at is null then 'registered'
        else 'qualified'
      end,
      v_email_confirmed_at
    );
  end if;

  perform private.sync_referral_rewards(v_gouille_id);

  raise notice
    'Parrainage verifie : % est rattache a Gouille (ancien parrain : %).',
    v_candidate_name,
    coalesce(v_existing_referrer_name, 'aucun');
end;
$$;

commit;
