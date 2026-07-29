create table if not exists public.alpha_bot_managers (
  id uuid primary key default gen_random_uuid(),
  bot_key text not null unique,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  sporting_director_id uuid not null unique references public.sporting_directors(id) on delete cascade,
  team_id uuid not null unique references public.teams(id) on delete cascade,
  display_name text not null,
  strategy text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alpha_bot_managers_bot_key_format
    check (bot_key ~ '^[a-z0-9_]{3,40}$'),
  constraint alpha_bot_managers_strategy_format
    check (strategy in ('climber', 'classics', 'sprinter', 'rouleur', 'development'))
);

create table if not exists public.alpha_bot_cycles (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.alpha_bot_managers(id) on delete cascade,
  cycle_key text not null,
  slot text not null,
  status text not null default 'running',
  attempt_count integer not null default 1,
  actions jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (manager_id, cycle_key),
  constraint alpha_bot_cycles_slot_check
    check (slot in ('morning', 'evening')),
  constraint alpha_bot_cycles_status_check
    check (status in ('running', 'completed', 'failed')),
  constraint alpha_bot_cycles_attempt_count_check
    check (attempt_count between 1 and 3)
);

create index if not exists alpha_bot_cycles_manager_started_idx
  on public.alpha_bot_cycles (manager_id, started_at desc);

alter table public.alpha_bot_managers enable row level security;
alter table public.alpha_bot_cycles enable row level security;

revoke all on table public.alpha_bot_managers from public, anon, authenticated;
revoke all on table public.alpha_bot_cycles from public, anon, authenticated;
grant all on table public.alpha_bot_managers to service_role;
grant all on table public.alpha_bot_cycles to service_role;

create or replace function public.claim_alpha_bot_cycle(
  p_manager_id uuid,
  p_cycle_key text,
  p_slot text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Cette opération est réservée au service interne.';
  end if;

  if p_slot not in ('morning', 'evening') then
    raise exception 'Créneau automatisé invalide.';
  end if;

  insert into public.alpha_bot_cycles (
    manager_id,
    cycle_key,
    slot
  )
  values (
    p_manager_id,
    left(trim(p_cycle_key), 80),
    p_slot
  )
  on conflict (manager_id, cycle_key) do nothing
  returning id into v_cycle_id;

  if v_cycle_id is not null then
    return v_cycle_id;
  end if;

  select id
  into v_cycle_id
  from public.alpha_bot_cycles
  where manager_id = p_manager_id
    and cycle_key = left(trim(p_cycle_key), 80)
    and attempt_count < 3
    and (
      status = 'failed'
      or (
        status = 'running'
        and started_at < now() - interval '20 minutes'
      )
    )
  for update;

  if v_cycle_id is null then
    return null;
  end if;

  update public.alpha_bot_cycles
  set
    status = 'running',
    attempt_count = attempt_count + 1,
    actions = '[]'::jsonb,
    error_message = null,
    started_at = now(),
    completed_at = null
  where id = v_cycle_id;

  return v_cycle_id;
end;
$$;

create or replace function public.complete_alpha_bot_cycle(
  p_cycle_id uuid,
  p_status text,
  p_actions jsonb default '[]'::jsonb,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Cette opération est réservée au service interne.';
  end if;

  if p_status not in ('completed', 'failed') then
    raise exception 'Statut final invalide.';
  end if;

  update public.alpha_bot_cycles
  set
    status = p_status,
    actions = coalesce(p_actions, '[]'::jsonb),
    error_message = nullif(left(coalesce(p_error_message, ''), 1000), ''),
    completed_at = now()
  where id = p_cycle_id;

  if not found then
    raise exception 'Cycle automatisé introuvable.';
  end if;
end;
$$;

revoke all on function public.claim_alpha_bot_cycle(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_alpha_bot_cycle(uuid, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.claim_alpha_bot_cycle(uuid, text, text)
  to service_role;
grant execute on function public.complete_alpha_bot_cycle(uuid, text, jsonb, text)
  to service_role;

comment on table public.alpha_bot_managers is
  'Comptes de test alpha pilotés automatiquement. Cette table interne n’est jamais exposée aux joueurs.';
comment on table public.alpha_bot_cycles is
  'Journal idempotent et auditable des cycles de jeu des comptes de test alpha.';
