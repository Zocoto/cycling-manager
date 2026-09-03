begin;

-- Le règlement d'une étape ne doit pas rescanner toutes les courses terminées
-- de la saison. Un GUC transactionnel permet de conserver la fonction globale
-- pour la maintenance planifiée tout en la bornant lors d'une homologation.
do $migration$
declare
  v_definition text;
  v_unscoped_filter constant text := 'where stage.status in (';
  v_scoped_filter constant text :=
    'where (' || chr(10) ||
    '      nullif(current_setting(''cyclostratege.condition_stage_id'', true), '''') is null' || chr(10) ||
    '      or stage.id = nullif(' || chr(10) ||
    '        current_setting(''cyclostratege.condition_stage_id'', true),' || chr(10) ||
    '        ''''' || chr(10) ||
    '      )::uuid' || chr(10) ||
    '    )' || chr(10) ||
    '      and stage.status in (';
begin
  select pg_get_functiondef(
    'public.settle_finished_race_conditions()'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, chr(13), '');

  if position('cyclostratege.condition_stage_id' in v_definition) = 0 then
    if position(v_unscoped_filter in v_definition) = 0 then
      raise exception 'Filtre des étapes à consolider introuvable.';
    end if;
    execute replace(v_definition, v_unscoped_filter, v_scoped_filter);
  end if;
end;
$migration$;

create or replace function public.settle_finished_stage_conditions(
  p_stage_id uuid
)
returns table (
  processed_stages integer,
  processed_riders integer,
  current_day_number integer
)
language plpgsql
security definer
set search_path = ''
set statement_timeout = '60s'
as $$
begin
  if p_stage_id is null then
    raise exception 'Une étape est requise.';
  end if;

  perform set_config(
    'cyclostratege.condition_stage_id',
    p_stage_id::text,
    true
  );

  return query
  select
    settlement.processed_stages,
    settlement.processed_riders,
    settlement.current_day_number
  from public.settle_finished_race_conditions() as settlement;
end;
$$;

revoke all
on function public.settle_finished_stage_conditions(uuid)
from public, anon, authenticated;

grant execute
on function public.settle_finished_stage_conditions(uuid)
to service_role;

comment on function public.settle_finished_stage_conditions(uuid)
is 'Consolide la forme pour une seule étape officielle avec un délai serveur adapté.';

commit;
