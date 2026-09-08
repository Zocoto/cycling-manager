begin;

-- The experiment is retired without deleting historical levels, briefings or
-- official simulation payloads. Existing records remain auditable, while all
-- future entry points are closed.
create or replace function public.enforce_tactical_center_s3()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.infrastructure_code = 'tactical_center' then
    raise exception 'Le Centre tactique a été retiré du jeu.';
  end if;

  return new;
end;
$$;

comment on function public.enforce_tactical_center_s3() is
  'Conserve la compatibilité du déclencheur historique et bloque définitivement tout nouveau chantier du Centre tactique.';

create or replace function public.save_current_team_tactical_briefing(
  p_race_edition_id uuid,
  p_stage_id uuid,
  p_primary_doctrine text,
  p_primary_rider_ids uuid[],
  p_backup_doctrine text default null,
  p_backup_rider_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Les doctrines de course et le Centre tactique ont été retirés.';
end;
$$;

revoke all on function public.save_current_team_tactical_briefing(
  uuid, uuid, text, uuid[], text, uuid[]
) from public, anon;
grant execute on function public.save_current_team_tactical_briefing(
  uuid, uuid, text, uuid[], text, uuid[]
) to authenticated, service_role;

comment on function public.save_current_team_tactical_briefing(
  uuid, uuid, text, uuid[], text, uuid[]
) is
  'Point d’entrée historique conservé pour les anciens clients ; aucun nouveau briefing ne peut être enregistré.';

comment on table public.race_stage_tactical_briefings is
  'Archive en lecture des briefings du Centre tactique retiré. Ces données ne sont plus injectées dans les simulations.';

notify pgrst, 'reload schema';

commit;
