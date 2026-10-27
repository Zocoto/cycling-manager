-- Additive reward only: existing referral qualification, milestones and prizes stay intact.
begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- One row is one real, unopened booster. The public album will consume these
-- server-owned rows atomically; local preview packs are never imported here.
create table public.cyclo_sticker_boosters (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  source_referral_id uuid not null references public.sporting_director_referrals(id) on delete cascade,
  copy_number smallint not null check (copy_number in (1, 2)),
  collection_season_id uuid not null references public.seasons(id),
  source_season_id uuid not null references public.seasons(id),
  granted_at timestamptz not null default now(),
  opened_at timestamptz,
  constraint cyclo_sticker_boosters_one_per_referral_copy unique (source_referral_id, copy_number),
  constraint cyclo_sticker_boosters_separate_seasons check (collection_season_id <> source_season_id),
  constraint cyclo_sticker_boosters_opened_after_grant check (opened_at is null or opened_at >= granted_at)
);

create index cyclo_sticker_boosters_unopened_owner_idx
  on public.cyclo_sticker_boosters(sporting_director_id, collection_season_id)
  where opened_at is null;

alter table public.cyclo_sticker_boosters enable row level security;
create policy cyclo_sticker_boosters_select_own on public.cyclo_sticker_boosters
  for select to authenticated using (
    exists (
      select 1 from public.sporting_directors as director
      where director.id = cyclo_sticker_boosters.sporting_director_id
        and director.auth_user_id = auth.uid()
        and director.status = 'active'
    )
  );
revoke all on public.cyclo_sticker_boosters from public, anon, authenticated;
grant select on public.cyclo_sticker_boosters to authenticated;
grant all on public.cyclo_sticker_boosters to service_role;

create or replace function private.grant_referral_sticker_boosters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection_season_id uuid;
  v_source_season_id uuid;
begin
  -- Only a fresh qualification event. Repeated saves or later season changes
  -- cannot turn historical S4 referrals into new booster rewards.
  if new.status <> 'qualified' or new.qualified_at is null then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status = 'qualified' then return new; end if;
  end if;
  if new.referred_director_id is null or new.referrer_director_id = new.referred_director_id then return new; end if;

  -- Keep the existing email-confirmation requirement, even for direct inserts.
  if not exists (
    select 1 from public.sporting_directors as referred
    join auth.users as account on account.id = referred.auth_user_id
    where referred.id = new.referred_director_id
      and account.email_confirmed_at is not null
  ) then return new; end if;

  -- Bind to the actual qualification season (Paris midnight), not the season
  -- when a delayed signup is retried. S5 boosters contain the S4 collection.
  select collection.id, source.id
  into v_collection_season_id, v_source_season_id
  from public.seasons as collection
  join public.seasons as source on source.game_year = collection.game_year - 1
  where collection.game_year >= 5
    -- Planned is accepted once its real start date is reached, so a signup
    -- exactly at midnight is safe even before the season-opening cron runs.
    and collection.status <> 'cancelled'
    and source.status <> 'cancelled'
    and new.qualified_at >= (collection.starts_on::timestamp at time zone 'Europe/Paris')
    and new.qualified_at < ((collection.ends_on + 1)::timestamp at time zone 'Europe/Paris')
    and new.qualified_at <= now()
  order by collection.game_year desc
  limit 1;
  if v_collection_season_id is null then return new; end if;

  insert into public.cyclo_sticker_boosters (
    sporting_director_id, source_referral_id, copy_number,
    collection_season_id, source_season_id
  )
  select new.referrer_director_id, new.id, copies.number,
    v_collection_season_id, v_source_season_id
  from generate_series(1, 2) as copies(number)
  on conflict (source_referral_id, copy_number) do nothing;
  return new;
end;
$$;

revoke all on function private.grant_referral_sticker_boosters() from public, anon, authenticated;

create trigger zz_grant_referral_sticker_boosters
  after insert or update of status on public.sporting_director_referrals
  for each row when (new.status = 'qualified')
  execute function private.grant_referral_sticker_boosters();

comment on table public.cyclo_sticker_boosters is
  'Persistent unopened Cyclo-Stickers boosters: two per referral first qualified from S5, additive to existing rewards. Public album opening remains gated separately.';
commit;
