begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- At most three private snapshots per offer (and therefore per season).
-- Only the selected plan is materialized in the existing gameplay tables.
-- No backfill, reroll, contract change or financial settlement on installation.
create table private.sponsor_objective_ambition_plans (
  sponsor_offer_id uuid not null references public.sponsor_offers(id) on delete cascade,
  objective_difficulty text not null check (objective_difficulty in ('accessible','balanced','ambitious')),
  objectives jsonb not null check (jsonb_typeof(objectives) = 'array' and jsonb_array_length(objectives) = 10),
  race_links jsonb not null,
  nationality_links jsonb not null,
  win_links jsonb not null,
  main_terms jsonb not null,
  created_at timestamptz not null default now(),
  primary key (sponsor_offer_id, objective_difficulty)
);
alter table private.sponsor_objective_ambition_plans enable row level security;
revoke all on private.sponsor_objective_ambition_plans from public, anon, authenticated, service_role;

create function private.remember_sponsor_objective_ambition(p_offer_id uuid, p_difficulty text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_rows jsonb;
begin
  -- The public negotiation function already holds the offer FOR UPDATE.
  -- Lock its ten rows before copying so a concurrent completion cannot mix plans.
  perform 1 from public.sponsor_objectives where sponsor_offer_id = p_offer_id for update;
  select coalesce(jsonb_agg(to_jsonb(o) order by o.display_order), '[]'::jsonb)
  into v_rows from public.sponsor_objectives o where o.sponsor_offer_id = p_offer_id;
  if jsonb_array_length(v_rows) = 0 then return; end if;
  if jsonb_array_length(v_rows) <> 10 then
    raise exception 'Les objectifs sont en cours de préparation. Rechargez la page avant de changer d’ambition.';
  end if;
  if exists (select 1 from jsonb_array_elements(v_rows) o
    where o->>'status' <> 'draft' or coalesce(o->'target_details'->>'objectiveDifficulty',p_difficulty) <> p_difficulty)
    or exists (select 1 from public.objective_progress p join public.sponsor_objectives o
      on o.id = p.sponsor_objective_id where o.sponsor_offer_id = p_offer_id) then
    raise exception 'Les objectifs de cette offre ne sont plus négociables.';
  end if;

  insert into private.sponsor_objective_ambition_plans
    (sponsor_offer_id,objective_difficulty,objectives,race_links,nationality_links,win_links,main_terms)
  select p_offer_id,p_difficulty,v_rows,
    (select coalesce(jsonb_agg(to_jsonb(r) order by r.objective_id),'[]'::jsonb)
      from public.race_result_objectives r join public.sponsor_objectives o on o.id=r.objective_id where o.sponsor_offer_id=p_offer_id),
    (select coalesce(jsonb_agg(to_jsonb(n) order by n.objective_id),'[]'::jsonb)
      from public.nationality_objectives n join public.sponsor_objectives o on o.id=n.objective_id where o.sponsor_offer_id=p_offer_id),
    (select coalesce(jsonb_agg(to_jsonb(w) order by w.objective_id),'[]'::jsonb)
      from public.season_win_objectives w join public.sponsor_objectives o on o.id=w.objective_id where o.sponsor_offer_id=p_offer_id),
    (select coalesce(jsonb_agg(to_jsonb(t) order by t.sponsor_objective_id),'[]'::jsonb)
      from public.sponsor_main_objective_terms t join public.sponsor_objectives o on o.id=t.sponsor_objective_id where o.sponsor_offer_id=p_offer_id)
  on conflict (sponsor_offer_id,objective_difficulty) do nothing;
end;
$$;

create function private.restore_sponsor_objective_ambition(p_offer_id uuid, p_difficulty text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_plan private.sponsor_objective_ambition_plans%rowtype;
begin
  select * into v_plan from private.sponsor_objective_ambition_plans
  where sponsor_offer_id=p_offer_id and objective_difficulty=p_difficulty;
  if not found then return; end if; -- First visit: existing application generator.
  insert into public.sponsor_objectives select * from jsonb_populate_recordset(null::public.sponsor_objectives,v_plan.objectives);
  insert into public.race_result_objectives select * from jsonb_populate_recordset(null::public.race_result_objectives,v_plan.race_links);
  insert into public.nationality_objectives select * from jsonb_populate_recordset(null::public.nationality_objectives,v_plan.nationality_links);
  insert into public.season_win_objectives select * from jsonb_populate_recordset(null::public.season_win_objectives,v_plan.win_links);
  -- Keep reward bounds and all existing triggers, including the S5 cash cap.
  insert into public.sponsor_main_objective_terms select * from jsonb_populate_recordset(null::public.sponsor_main_objective_terms,v_plan.main_terms);
end;
$$;
revoke all on function private.remember_sponsor_objective_ambition(uuid,text) from public, anon, authenticated, service_role;
revoke all on function private.restore_sponsor_objective_ambition(uuid,text) from public, anon, authenticated, service_role;

-- A server render started before a switch must not insert the old tier's
-- newly generated rows after that switch. The key-share lock serializes this
-- check with the negotiation's existing offer FOR UPDATE lock.
create function private.guard_sponsor_objective_ambition_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_difficulty text;
begin
  select objective_difficulty into v_difficulty from public.sponsor_offers
  where id=new.sponsor_offer_id for key share;
  if new.target_details->>'objectiveDifficulty' is distinct from v_difficulty then
    raise exception 'Le niveau d’ambition a changé. Rechargez la page.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_sponsor_objective_ambition_insert() from public, anon, authenticated, service_role;
create trigger guard_sponsor_objective_ambition_insert
before insert on public.sponsor_objectives for each row
when (new.status='draft' and new.is_provisional and new.target_details ? 'objectiveDifficulty')
execute function private.guard_sponsor_objective_ambition_insert();

-- Guarded surgical patches retain ownership, stale-budget, season, draft,
-- ambition-ceiling and signature checks from the deployed functions.
do $patch$
declare
  v_signature text;
  v_definition text;
  v_delete text;
  v_update text := E'  update public.sponsor_offers\n  set budget_per_season = v_negotiated_budget,';
  v_prepare text := $prepare$  -- sponsor_objective_ambition_plans_v1: archive before budget triggers run.
  if v_offer.objective_difficulty is distinct from p_objective_difficulty then
    perform private.remember_sponsor_objective_ambition(v_offer.id,v_offer.objective_difficulty);
    delete from public.sponsor_objectives where sponsor_offer_id=v_offer.id;
  end if;

$prepare$;
  v_restore text := $restore$  if v_offer.objective_difficulty is distinct from p_objective_difficulty then
    perform private.restore_sponsor_objective_ambition(v_offer.id,p_objective_difficulty);
  end if;$restore$;
begin
  foreach v_signature in array array[
    'public.negotiate_sponsor_offer(uuid,uuid,text,numeric,numeric)',
    'public.negotiate_continuing_sponsor_objectives(uuid,uuid,text,numeric,numeric)'
  ] loop
    select replace(pg_get_functiondef(v_signature::regprocedure),chr(13),'') into v_definition;
    v_delete := case when v_signature like 'public.negotiate_sponsor_offer(%' then
      E'  delete from public.sponsor_objectives\n  where sponsor_offer_id = v_offer.id;'
      else E'  delete from public.sponsor_objectives\n  where sponsor_offer_id = v_offer.id\n    and season_id = v_target_season.id\n    and status = ''draft'';' end;
    if array_length(string_to_array(v_definition,v_delete),1) <> 2
      or array_length(string_to_array(v_definition,v_update),1) <> 2 then
      raise exception 'Unexpected sponsor ambition switch source: %',v_signature;
    end if;
    execute replace(replace(v_definition,v_delete,v_restore),v_update,v_prepare||v_update);
  end loop;

  -- Annual satisfaction may change the budget, never the already proposed targets.
  v_signature := 'public.ensure_continuing_sponsor_offer(uuid,uuid,numeric,numeric)';
  select replace(pg_get_functiondef(v_signature::regprocedure),chr(13),'') into v_definition;
  v_delete := $old$    if v_budget_changed then
      delete from public.sponsor_objectives
      where sponsor_offer_id = v_offer_id
        and season_id = v_target_season.id
        and status = 'draft';
    end if;$old$;
  if array_length(string_to_array(v_definition,v_delete),1) <> 2 then
    raise exception 'Unexpected annual sponsor ambition source.';
  end if;
  execute replace(v_definition,v_delete,'    -- sponsor_objective_ambition_plans_v1: retain targets when the annual budget changes.');
end;
$patch$;

notify pgrst, 'reload schema';
commit;
