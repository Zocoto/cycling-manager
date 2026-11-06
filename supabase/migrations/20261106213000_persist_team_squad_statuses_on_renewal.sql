begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';
set local application_name = 'cyclostratege-persistent-squad-statuses-20261106';

-- A squad role belongs to the rider's ongoing tenure in this team. Renewals
-- previously dropped it because each new contract started with NULL.
-- Resolve the value at activation, after all late edits of the old contract,
-- rather than freezing a potentially outdated value when the renewal is signed.
create function private.inherit_team_squad_status_on_renewal()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_start_year integer; v_previous_status text;
begin
  if new.acquisition_type <> 'renewal' or new.status <> 'active'
    or new.squad_status is not null then return new; end if;
  if tg_op = 'UPDATE' and old.status <> 'planned' then return new; end if;

  select game_year into v_start_year from public.seasons where id = new.start_season_id;
  select previous.squad_status into v_previous_status
  from public.rider_contracts previous
  join public.seasons ending on ending.id = previous.end_season_id
  where previous.rider_id = new.rider_id and previous.team_id = new.team_id
    and previous.id <> new.id and previous.status in ('active','completed')
    and ending.game_year = v_start_year - 1
  order by previous.signed_at desc nulls last, previous.created_at desc, previous.id desc
  limit 1;
  -- Take the nearest predecessor's actual value, including a deliberate NULL.
  -- Do not search for an older non-NULL role or inherit from a different club.
  if found then new.squad_status := v_previous_status; end if;
  return new;
end;
$$;
create trigger inherit_team_squad_status_on_renewal
before insert or update of status on public.rider_contracts for each row
execute function private.inherit_team_squad_status_on_renewal();
revoke all on function private.inherit_team_squad_status_on_renewal()
  from public, anon, authenticated, service_role;

comment on function private.inherit_team_squad_status_on_renewal() is
  'Carries the latest squad role across a continuous same-team renewal, including an explicitly cleared role.';

-- No retrospective player-role updates: without a role-change audit, existing
-- NULL values may be either lost roles or deliberate choices made since J1.
notify pgrst, 'reload schema';
commit;
