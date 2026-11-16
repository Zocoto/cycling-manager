begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Keep the original atomic purchase/ledger path and give the trophy the
-- snapshot's source season, which can differ from the season of the claim.
do $migration$
declare
  claim_definition text := pg_get_functiondef(
    'public.claim_current_cyclo_stickers_achievement(text,text)'::regprocedure
  );
  claim_anchor text := $original$values(v_director,'cyclo_stickers_s4',now(),now())$original$;
  title_definition text := pg_get_functiondef(
    'private.notify_sporting_director_trophy()'::regprocedure
  );
  title_anchor text := '  v_kind := case';
begin
  if length(claim_definition) - length(replace(claim_definition, claim_anchor, '')) <> length(claim_anchor)
    or length(title_definition) - length(replace(title_definition, title_anchor, '')) <> length(title_anchor) then
    raise exception 'Unexpected Cyclo-Stickers trophy award or notification definition.';
  end if;

  execute replace(claim_definition, claim_anchor, $updated$values(
        v_director,
        'cyclo_stickers_s' || (select source.game_year::text from public.seasons as source where source.id = v_edition.source_season_id),
        now(), now()
      )$updated$);

  execute replace(title_definition, title_anchor, $updated$  if new.trophy_key ~ '^cyclo_stickers_s[1-9][0-9]*$' then
    v_title := 'Mémoire du peloton · Saison ' || substr(new.trophy_key, length('cyclo_stickers_s') + 1);
  end if;
$updated$ || title_anchor);
end;
$migration$;

notify pgrst, 'reload schema';
commit;
