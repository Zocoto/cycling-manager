begin;

-- Le didacticiel n'est plus requis, mais une adresse confirmee reste le
-- minimum anti-abus avant de verser des recompenses aussi importantes.
drop trigger if exists qualify_referral_after_signup
  on public.sporting_director_referrals;
drop function if exists private.qualify_referral_after_signup();

create or replace function private.qualify_referral_after_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer_id uuid;
begin
  if new.email_confirmed_at is null
    or (tg_op = 'UPDATE' and old.email_confirmed_at is not null)
  then
    return new;
  end if;

  update public.sporting_director_referrals as referral
  set
    status = 'qualified',
    qualified_at = coalesce(referral.qualified_at, new.email_confirmed_at, now())
  from public.sporting_directors as referred_director
  where referred_director.auth_user_id = new.id
    and referral.referred_director_id = referred_director.id
    and referral.status = 'registered'
  returning referral.referrer_director_id into v_referrer_id;

  if v_referrer_id is not null then
    perform private.sync_referral_rewards(v_referrer_id);
  end if;

  return new;
end;
$$;

revoke all
  on function private.qualify_referral_after_email_confirmation()
  from public, anon, authenticated;

drop trigger if exists qualify_referral_after_email_confirmation
  on auth.users;
create trigger qualify_referral_after_email_confirmation
  after insert or update of email_confirmed_at on auth.users
  for each row
  execute function private.qualify_referral_after_email_confirmation();

commit;
