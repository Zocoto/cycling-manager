begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- Only change the candidate order for local races. Keep availability checks,
-- serialized settlement, registrations, results and all other categories intact.
do $migration$
declare
  v_signature regprocedure := pg_catalog.to_regprocedure(
    'public.settle_due_free_agent_detection_teams(timestamp with time zone)'
  );
  v_definition text;
  v_old text := $old$      order by
        (
          -- Une course nationale privilégie très fortement son vivier local,$old$;
  v_new text := $new$      order by
        -- Local detection geography precedes sporting level.
        case
          when v_edition.category_code = 'local' then
            case
              when rider.country_id = v_edition.race_country_id then 0
              when exists (
                select 1
                from public.country_adjacencies as adjacency
                where adjacency.country_id = v_edition.race_country_id
                  and adjacency.adjacent_country_id = rider.country_id
              ) then 1
              when rider_country.continent_code =
                v_edition.race_continent_code then 2
              else 3
            end
          else 0
        end asc,
        (
          -- Une course nationale privilégie très fortement son vivier local,$new$;
begin
  if v_signature is null then
    raise exception 'The existing detection-team settlement is missing.';
  end if;
  v_definition := replace(
    pg_catalog.pg_get_functiondef(v_signature), chr(13) || chr(10), chr(10)
  );
  -- Git on Windows may check out this migration with CRLF line endings.
  v_old := replace(v_old, chr(13) || chr(10), chr(10));
  v_new := replace(v_new, chr(13) || chr(10), chr(10));
  if position(
    $required$category.code in ('local', 'regional', 'national', 'continental', 'world')$required$
    in v_definition
  ) = 0 then
    raise exception 'Install the reviewed local/regional category extension first.';
  end if;
  if position(v_new in v_definition) > 0 then
    return;
  end if;
  if position('Local detection geography precedes sporting level.' in v_definition) > 0 then
    raise exception 'The local geography priority is only partially installed.';
  end if;
  if (length(v_definition) - length(replace(v_definition, v_old, '')))
    / length(v_old) <> 1 then
    raise exception 'Unexpected detection-team ordering; no changes applied.';
  end if;

  -- Replace the reviewed ordering anchor only, preserving signature and ACL.
  execute replace(v_definition, v_old, v_new);
end;
$migration$;

comment on function public.settle_due_free_agent_detection_teams(timestamptz) is
  'Complète les courses standard à cinq équipes après la clôture si possible. En locale, agents libres du pays puis pays voisins puis continent puis autres pays, avant le niveau sportif. Aucun changement aux éditions déjà finalisées.';

notify pgrst, 'reload schema';
commit;
