begin;

set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Keep the paginated transfer search aligned with getRiderSportingProfile.
-- Patch only the two qualification predicates, preserving scouting, permissions,
-- pagination and all existing filters. No rider rows are rewritten or scanned.
do $migration$
declare
  v_signature regprocedure :=
    'public.search_transfer_riders(uuid,text,text,integer,integer,integer,text,numeric,text,uuid,integer,integer)'::regprocedure;
  v_definition text := replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), '');
  v_old_climber text := $old$not (rating.mountain >= 62 and rating.time_trial >= 62)
              and rating.mountain >= 62$old$;
  v_old_rouleur text := $old$not (rating.mountain >= 62 and rating.time_trial >= 62)
              and rating.time_trial >= 62$old$;
  v_new_climber text := $new$rating.mountain >= 62
              and (
                not (rating.mountain >= 62 and rating.time_trial >= 62)
                or rating.mountain - (rating.mountain + rating.time_trial)::numeric / 2 > 4
              ) /* sporting_profile_climber_preserved_v1 */$new$;
  v_new_rouleur text := $new$rating.time_trial >= 62
              and (
                not (rating.mountain >= 62 and rating.time_trial >= 62)
                or rating.time_trial - (rating.mountain + rating.time_trial)::numeric / 2 > 4
              ) /* sporting_profile_rouleur_preserved_v1 */$new$;
begin
  -- SQL files may be checked out with either Windows or Unix line endings.
  v_old_climber := replace(v_old_climber, chr(13), '');
  v_old_rouleur := replace(v_old_rouleur, chr(13), '');
  v_new_climber := replace(v_new_climber, chr(13), '');
  v_new_rouleur := replace(v_new_rouleur, chr(13), '');

  if position(v_new_climber in v_definition) > 0
    and position(v_new_rouleur in v_definition) > 0 then
    return;
  end if;

  if (length(v_definition) - length(replace(v_definition, v_old_climber, '')))
       <> length(v_old_climber)
    or (length(v_definition) - length(replace(v_definition, v_old_rouleur, '')))
       <> length(v_old_rouleur) then
    raise exception 'Unexpected transfer profile predicates; no changes applied.';
  end if;

  v_definition := replace(v_definition, v_old_climber, v_new_climber);
  v_definition := replace(v_definition, v_old_rouleur, v_new_rouleur);
  execute v_definition;
end;
$migration$;

commit;
