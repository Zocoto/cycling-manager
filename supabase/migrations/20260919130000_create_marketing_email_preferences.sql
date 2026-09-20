begin;

create table public.user_marketing_email_preferences (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  consented_at timestamptz,
  withdrawn_at timestamptz,
  consent_source text not null default 'legacy_default_opt_out',
  consent_version text,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_marketing_email_preferences_consent_required check (
    not enabled or consented_at is not null
  ),
  constraint user_marketing_email_preferences_source_check check (
    consent_source in (
      'signup',
      'signup_default_opt_out',
      'account_menu',
      'email_unsubscribe',
      'legacy_default_opt_out'
    )
  ),
  constraint user_marketing_email_preferences_version_not_blank check (
    consent_version is null or btrim(consent_version) <> ''
  )
);

create table public.user_marketing_email_preference_events (
  id bigint generated always as identity primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null,
  source text not null,
  consent_version text,
  recorded_at timestamptz not null default now(),
  constraint user_marketing_email_preference_events_source_check check (
    source in (
      'signup',
      'signup_default_opt_out',
      'account_menu',
      'email_unsubscribe',
      'legacy_default_opt_out'
    )
  ),
  constraint user_marketing_email_preference_events_version_not_blank check (
    consent_version is null or btrim(consent_version) <> ''
  )
);

create index user_marketing_email_preferences_enabled_idx
  on public.user_marketing_email_preferences (enabled)
  where enabled;

create index user_marketing_email_preference_events_user_recorded_idx
  on public.user_marketing_email_preference_events (
    auth_user_id,
    recorded_at desc
  );

comment on table public.user_marketing_email_preferences is
  'Choix courant du membre pour les e-mails facultatifs d’actualité. Les messages de service ne dépendent pas de ce choix.';

comment on table public.user_marketing_email_preference_events is
  'Historique horodaté des consentements et retraits relatifs aux e-mails facultatifs d’actualité.';

alter table public.user_marketing_email_preferences enable row level security;
alter table public.user_marketing_email_preference_events enable row level security;

revoke all on table public.user_marketing_email_preferences,
  public.user_marketing_email_preference_events
from public, anon;

revoke insert, update, delete on table public.user_marketing_email_preferences,
  public.user_marketing_email_preference_events
from authenticated;

grant select on table public.user_marketing_email_preferences,
  public.user_marketing_email_preference_events
to authenticated;

grant select on table public.user_marketing_email_preferences,
  public.user_marketing_email_preference_events
to service_role;

drop policy if exists user_marketing_email_preferences_select_own
  on public.user_marketing_email_preferences;
create policy user_marketing_email_preferences_select_own
on public.user_marketing_email_preferences
for select
to authenticated
using (auth_user_id = (select auth.uid()));

drop policy if exists user_marketing_email_preference_events_select_own
  on public.user_marketing_email_preference_events;
create policy user_marketing_email_preference_events_select_own
on public.user_marketing_email_preference_events
for select
to authenticated
using (auth_user_id = (select auth.uid()));

insert into public.user_marketing_email_preferences (
  auth_user_id,
  enabled,
  consent_source
)
select
  account.id,
  false,
  'legacy_default_opt_out'
from auth.users as account
on conflict (auth_user_id) do nothing;

insert into public.user_marketing_email_preference_events (
  auth_user_id,
  enabled,
  source
)
select
  preference.auth_user_id,
  false,
  'legacy_default_opt_out'
from public.user_marketing_email_preferences as preference
where preference.consent_source = 'legacy_default_opt_out'
  and not exists (
    select 1
    from public.user_marketing_email_preference_events as event
    where event.auth_user_id = preference.auth_user_id
  );

create or replace function private.initialize_marketing_email_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean := coalesce(
    new.raw_user_meta_data ->> 'marketing_email_consent',
    ''
  ) = 'accepted';
  v_source text;
  v_version text := nullif(
    btrim(new.raw_user_meta_data ->> 'marketing_email_consent_version'),
    ''
  );
  v_inserted_user_id uuid;
begin
  v_source := case
    when v_enabled then 'signup'
    else 'signup_default_opt_out'
  end;

  insert into public.user_marketing_email_preferences (
    auth_user_id,
    enabled,
    consented_at,
    consent_source,
    consent_version
  ) values (
    new.id,
    v_enabled,
    case when v_enabled then now() else null end,
    v_source,
    v_version
  )
  on conflict (auth_user_id) do nothing
  returning auth_user_id into v_inserted_user_id;

  if v_inserted_user_id is not null then
    insert into public.user_marketing_email_preference_events (
      auth_user_id,
      enabled,
      source,
      consent_version
    ) values (
      new.id,
      v_enabled,
      v_source,
      v_version
    );
  end if;

  return new;
end;
$$;

drop trigger if exists auth_user_initialize_marketing_email_preference
  on auth.users;
create trigger auth_user_initialize_marketing_email_preference
after insert on auth.users
for each row execute function private.initialize_marketing_email_preference();

create or replace function public.set_current_user_marketing_email_preference(
  p_enabled boolean,
  p_consent_version text default null
)
returns table (
  enabled boolean,
  consented_at timestamptz,
  withdrawn_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current public.user_marketing_email_preferences%rowtype;
  v_version text := nullif(btrim(p_consent_version), '');
begin
  if v_user_id is null then
    raise exception 'Authentification requise.';
  end if;

  select preference.* into v_current
  from public.user_marketing_email_preferences as preference
  where preference.auth_user_id = v_user_id
  for update;

  if not found then
    insert into public.user_marketing_email_preferences (
      auth_user_id,
      enabled,
      consented_at,
      withdrawn_at,
      consent_source,
      consent_version
    ) values (
      v_user_id,
      p_enabled,
      case when p_enabled then now() else null end,
      case when p_enabled then null else now() end,
      'account_menu',
      v_version
    );

    insert into public.user_marketing_email_preference_events (
      auth_user_id,
      enabled,
      source,
      consent_version
    ) values (
      v_user_id,
      p_enabled,
      'account_menu',
      v_version
    );
  elsif v_current.enabled is distinct from p_enabled then
    update public.user_marketing_email_preferences as preference
    set enabled = p_enabled,
        consented_at = case
          when p_enabled then now()
          else preference.consented_at
        end,
        withdrawn_at = case
          when p_enabled then null
          else now()
        end,
        consent_source = 'account_menu',
        consent_version = case
          when p_enabled then v_version
          else preference.consent_version
        end,
        updated_at = now()
    where preference.auth_user_id = v_user_id;

    insert into public.user_marketing_email_preference_events (
      auth_user_id,
      enabled,
      source,
      consent_version
    ) values (
      v_user_id,
      p_enabled,
      'account_menu',
      case when p_enabled then v_version else v_current.consent_version end
    );
  end if;

  return query
  select
    preference.enabled,
    preference.consented_at,
    preference.withdrawn_at
  from public.user_marketing_email_preferences as preference
  where preference.auth_user_id = v_user_id;
end;
$$;

create or replace function public.unsubscribe_marketing_emails(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_version text;
begin
  update public.user_marketing_email_preferences as preference
  set enabled = false,
      withdrawn_at = now(),
      consent_source = 'email_unsubscribe',
      updated_at = now()
  where preference.unsubscribe_token = p_token
    and preference.enabled
  returning preference.auth_user_id, preference.consent_version
  into v_user_id, v_version;

  if v_user_id is not null then
    insert into public.user_marketing_email_preference_events (
      auth_user_id,
      enabled,
      source,
      consent_version
    ) values (
      v_user_id,
      false,
      'email_unsubscribe',
      v_version
    );
  end if;

  -- Une réponse uniforme évite de révéler si un jeton correspond à un compte.
  return true;
end;
$$;

revoke all on function private.initialize_marketing_email_preference()
  from public, anon, authenticated;

revoke all on function public.set_current_user_marketing_email_preference(boolean, text)
  from public, anon;
grant execute on function public.set_current_user_marketing_email_preference(boolean, text)
  to authenticated;

revoke all on function public.unsubscribe_marketing_emails(uuid)
  from public;
grant execute on function public.unsubscribe_marketing_emails(uuid)
  to anon, authenticated, service_role;

commit;
