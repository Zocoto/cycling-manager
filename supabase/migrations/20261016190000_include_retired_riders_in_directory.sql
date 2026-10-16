begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

-- Keep name lookup indexed when retired careers join the existing directory.
-- The active-only index remains available to recruitment/market queries.
create index riders_directory_full_name_trgm_idx on public.riders using gin
  ((lower(first_name || ' ' || last_name)) extensions.gin_trgm_ops)
  where status in ('active', 'free_agent', 'retired');

do $$ declare definition text; before_text text:=$b$on rider.status in ('active', 'free_agent')$b$;
begin
  definition:=pg_get_functiondef('public.search_game_directory(text,integer)'::regprocedure);
  if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then
    raise exception 'Unexpected rider directory definition; search migration aborted.';
  end if;
  execute replace(definition,before_text,$a$on rider.status in ('active', 'free_agent', 'retired')$a$);
end $$;
-- No rider status, recruitment permissions, signed sponsor objective, historical
-- contract or result is changed. Authentication and category limits are retained.
notify pgrst,'reload schema';
commit;
