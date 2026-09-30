begin;

-- Centralise l'attribution pour qu'elle puisse être rejouée sans doublon si
-- Supabase complète les métadonnées du compte après le trigger d'inscription.
create or replace function private.assign_referral_from_auth_user(
  p_auth_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user auth.users%rowtype;
  v_referral_code text;
  v_referred_director_id uuid;
  v_referred_display_name text;
  v_referrer_director_id uuid;
  v_existing_referrer_id uuid;
  v_existing_status text;
  v_inserted_id uuid;
begin
  select auth_user.*
  into v_auth_user
  from auth.users as auth_user
  where auth_user.id = p_auth_user_id;

  if not found then
    return null;
  end if;

  v_referral_code := upper(
    btrim(coalesce(v_auth_user.raw_user_meta_data ->> 'referral_code', ''))
  );

  if v_referral_code !~ '^DS-[A-F0-9]{12}$' then
    return null;
  end if;

  select director.id, director.display_name
  into v_referred_director_id, v_referred_display_name
  from public.sporting_directors as director
  where director.auth_user_id = p_auth_user_id
  limit 1;

  if v_referred_director_id is null then
    return null;
  end if;

  select profile.sporting_director_id
  into v_referrer_director_id
  from public.referral_profiles as profile
  join public.sporting_directors as referrer
    on referrer.id = profile.sporting_director_id
   and referrer.status = 'active'
  where profile.referral_code = v_referral_code
    and profile.sporting_director_id <> v_referred_director_id
  limit 1;

  if v_referrer_director_id is null then
    return null;
  end if;

  select referral.referrer_director_id, referral.status
  into v_existing_referrer_id, v_existing_status
  from public.sporting_director_referrals as referral
  where referral.referred_director_id = v_referred_director_id
  limit 1;

  if v_existing_referrer_id is not null then
    -- Une attribution existante n'est jamais remplacée par une métadonnée
    -- modifiée a posteriori.
    if v_existing_referrer_id = v_referrer_director_id
      and v_existing_status = 'registered'
      and v_auth_user.email_confirmed_at is not null
    then
      update public.sporting_director_referrals as referral
      set
        status = 'qualified',
        qualified_at = coalesce(
          referral.qualified_at,
          v_auth_user.email_confirmed_at,
          now()
        )
      where referral.referred_director_id = v_referred_director_id
        and referral.status = 'registered';

      perform private.sync_referral_rewards(v_referrer_director_id);
    end if;

    return v_existing_referrer_id;
  end if;

  insert into public.sporting_director_referrals (
    referrer_director_id,
    referred_director_id,
    referred_display_name,
    referral_code_snapshot,
    status,
    qualified_at
  ) values (
    v_referrer_director_id,
    v_referred_director_id,
    v_referred_display_name,
    v_referral_code,
    case
      when v_auth_user.email_confirmed_at is null then 'registered'
      else 'qualified'
    end,
    v_auth_user.email_confirmed_at
  )
  on conflict (referred_director_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null
    and v_auth_user.email_confirmed_at is not null
  then
    perform private.sync_referral_rewards(v_referrer_director_id);
  end if;

  return v_referrer_director_id;
end;
$$;

revoke all
  on function private.assign_referral_from_auth_user(uuid)
  from public, anon, authenticated;

create or replace function private.sync_referral_after_auth_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assign_referral_from_auth_user(new.id);
  return new;
end;
$$;

revoke all
  on function private.sync_referral_after_auth_change()
  from public, anon, authenticated;

drop trigger if exists sync_referral_after_auth_change on auth.users;
create trigger sync_referral_after_auth_change
  after insert or update of raw_user_meta_data, email_confirmed_at
  on auth.users
  for each row
  execute function private.sync_referral_after_auth_change();

-- Seconde tentative explicite de la Server Action d'inscription. Cette RPC
-- n'est accessible qu'avec la clé de service et ne permet aucune attribution
-- arbitraire : le code est toujours relu dans auth.users.
create or replace function public.finalize_registration_referral(
  p_auth_user_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.assign_referral_from_auth_user(p_auth_user_id) is not null;
$$;

revoke all
  on function public.finalize_registration_referral(uuid)
  from public, anon, authenticated;
grant execute
  on function public.finalize_registration_referral(uuid)
  to service_role;

-- Rattrape d'abord toutes les invitations dont le code est encore présent
-- dans les métadonnées Auth mais dont la ligne de parrainage manque.
do $$
declare
  v_auth_user_id uuid;
  v_existing_referral_id uuid;
  v_repaired_referrer_id uuid;
  v_repaired_name text;
  v_repaired_count integer := 0;
  v_repaired_names text := '';
begin
  for v_auth_user_id in
    select auth_user.id
    from auth.users as auth_user
    where upper(
      btrim(coalesce(auth_user.raw_user_meta_data ->> 'referral_code', ''))
    ) ~ '^DS-[A-F0-9]{12}$'
  loop
    select referral.id
    into v_existing_referral_id
    from public.sporting_directors as director
    join public.sporting_director_referrals as referral
      on referral.referred_director_id = director.id
    where director.auth_user_id = v_auth_user_id
    limit 1;

    v_repaired_referrer_id :=
      private.assign_referral_from_auth_user(v_auth_user_id);

    if v_existing_referral_id is null
      and v_repaired_referrer_id is not null
    then
      select director.display_name
      into v_repaired_name
      from public.sporting_directors as director
      where director.auth_user_id = v_auth_user_id
      limit 1;

      v_repaired_count := v_repaired_count + 1;
      v_repaired_names := concat_ws(', ', v_repaired_names, v_repaired_name);
    end if;
  end loop;

  raise notice
    'Parrainages explicites rattrapes : % [%]',
    v_repaired_count,
    nullif(v_repaired_names, '');
end;
$$;

-- Rattrapage nominatif du seul compte communiqué sans ambiguïté. Le second
-- filleul est réparé ci-dessus si son code est bien resté dans auth.users ;
-- aucun homonyme approximatif n'est attribué à Gouille.
do $$
declare
  v_gouille_id uuid;
  v_gouille_code text;
  v_candidate_count integer;
  v_candidate_names text;
  v_candidate record;
begin
  select director.id, profile.referral_code
  into v_gouille_id, v_gouille_code
  from public.sporting_directors as director
  join public.referral_profiles as profile
    on profile.sporting_director_id = director.id
  where lower(director.username) = 'gouille'
     or lower(director.display_name) = 'gouille'
  order by (lower(director.username) = 'gouille') desc
  limit 1;

  if v_gouille_id is null then
    raise exception 'Rattrapage parrainage : directeur Gouille introuvable.';
  end if;

  select
    count(*)::integer,
    string_agg(director.display_name, ', ' order by director.display_name)
  into v_candidate_count, v_candidate_names
  from public.sporting_directors as director
  join auth.users as auth_user
    on auth_user.id = director.auth_user_id
  left join public.sporting_director_referrals as referral
    on referral.referred_director_id = director.id
  where lower(director.username) = 'tymeo2202'
    and director.created_at >= timestamptz '2026-08-01 00:00:00+00'
    and (
      referral.id is null
      or referral.referrer_director_id = v_gouille_id
    )
    and (
      nullif(
        upper(btrim(auth_user.raw_user_meta_data ->> 'referral_code')),
        ''
      ) is null
      or upper(btrim(auth_user.raw_user_meta_data ->> 'referral_code')) =
        v_gouille_code
    );

  if v_candidate_count <> 1 then
    raise exception
      'Rattrapage Gouille ambigu : % candidat(s) compatible(s) [%]. Aucune attribution appliquee.',
      v_candidate_count,
      coalesce(v_candidate_names, 'aucun');
  end if;

  for v_candidate in
    select
      director.id,
      director.display_name,
      auth_user.email_confirmed_at
    from public.sporting_directors as director
    join auth.users as auth_user
      on auth_user.id = director.auth_user_id
    left join public.sporting_director_referrals as referral
      on referral.referred_director_id = director.id
    where lower(director.username) = 'tymeo2202'
      and director.created_at >= timestamptz '2026-08-01 00:00:00+00'
      and (
        referral.id is null
        or referral.referrer_director_id = v_gouille_id
      )
      and (
        nullif(
          upper(btrim(auth_user.raw_user_meta_data ->> 'referral_code')),
          ''
        ) is null
        or upper(btrim(auth_user.raw_user_meta_data ->> 'referral_code')) =
          v_gouille_code
      )
  loop
    insert into public.sporting_director_referrals (
      referrer_director_id,
      referred_director_id,
      referred_display_name,
      referral_code_snapshot,
      status,
      qualified_at
    ) values (
      v_gouille_id,
      v_candidate.id,
      v_candidate.display_name,
      v_gouille_code,
      case
        when v_candidate.email_confirmed_at is null then 'registered'
        else 'qualified'
      end,
      v_candidate.email_confirmed_at
    )
    on conflict (referred_director_id) do nothing;
  end loop;

  perform private.sync_referral_rewards(v_gouille_id);

  raise notice 'Parrainages Gouille verifies/repares : %', v_candidate_names;
end;
$$;

notify pgrst, 'reload schema';

commit;
