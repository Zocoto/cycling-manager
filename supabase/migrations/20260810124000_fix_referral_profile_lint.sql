begin;

-- La variable de boucle PL/pgSQL est declaree implicitement par FOR.
-- Ne pas la redeclarer evite un avertissement de shadowing au lint.
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

commit;
