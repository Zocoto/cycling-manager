-- A manual federation selection is a season achievement. Switching the
-- default mode back to automatic must not erase that historical credit.

begin;

alter table public.national_federation_selection_lists
  add column if not exists manually_submitted_at timestamptz;

comment on column public.national_federation_selection_lists.manually_submitted_at is
  'First successful manual submission to team directors. This audit marker is never cleared by automatic takeover.';

create index if not exists national_federation_selection_lists_manual_objective_idx
  on public.national_federation_selection_lists (country_id, season_id)
  where manually_submitted_at is not null;

-- The federation journal is immutable and therefore remains authoritative
-- when an earlier automatic takeover cleared created_by_director_id.
with manual_publications as (
  select
    selection_list.id as selection_list_id,
    min(journal.created_at) as first_submitted_at
  from public.national_federation_selection_lists as selection_list
  join public.national_federation_journal_entries as journal
    on journal.country_id = selection_list.country_id
   and journal.season_id = selection_list.season_id
   and journal.source_reference like
     'federation-selection:' || selection_list.id::text || ':published:%'
  group by selection_list.id
)
update public.national_federation_selection_lists as selection_list
set manually_submitted_at = manual_publication.first_submitted_at
from manual_publications as manual_publication
where selection_list.id = manual_publication.selection_list_id
  and selection_list.manually_submitted_at is null;

-- Record the durable marker inside the same transaction as every future
-- manual publication. A failed publication rolls the marker back as well.
do $patch_manual_publication$
declare
  v_definition text;
  v_anchor text :=
    '  perform public.assert_federation_selection_open(v_list.country_id, v_list.season_id, v_list.slot_key);';
  v_replacement text;
begin
  select replace(
    pg_catalog.pg_get_functiondef(
      'public.publish_national_federation_preselection(text,text)'::regprocedure
    ),
    chr(13),
    ''
  ) into v_definition;

  if v_definition not like '%manually_submitted_at%' then
    if position(v_anchor in v_definition) = 0 then
      raise exception 'The manual federation publication anchor is missing.';
    end if;

    v_replacement := v_anchor || E'\n'
      || '  update public.national_federation_selection_lists' || E'\n'
      || '  set manually_submitted_at = coalesce(manually_submitted_at, now())' || E'\n'
      || '  where id = v_list.id;';
    v_definition := replace(v_definition, v_anchor, v_replacement);
    execute v_definition;
  end if;
end;
$patch_manual_publication$;

-- Race-creation eligibility and the next-season objective grant reuse this
-- score function, so they must consume the same durable evidence as the UI.
do $patch_federation_score$
declare
  v_definition text;
  v_previous text := 'and selection_list.created_by_director_id is not null';
begin
  select replace(
    pg_catalog.pg_get_functiondef(
      'public.get_national_federation_race_creation_score_base(uuid,uuid)'::regprocedure
    ),
    chr(13),
    ''
  ) into v_definition;

  if v_definition not like '%selection_list.manually_submitted_at is not null%' then
    if position(v_previous in v_definition) = 0 then
      raise exception 'The federation objective score anchor is missing.';
    end if;
    v_definition := replace(
      v_definition,
      v_previous,
      'and selection_list.manually_submitted_at is not null'
    );
    execute v_definition;
  end if;
end;
$patch_federation_score$;

notify pgrst, 'reload schema';

commit;
