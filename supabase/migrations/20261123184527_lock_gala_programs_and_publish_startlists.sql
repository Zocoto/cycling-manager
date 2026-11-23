begin;
set local application_name='cyclostratege-gala-s5-program-lock-startlists-20261123';
set local lock_timeout='1s';
set local statement_timeout='10s';

-- A saved programme is a commitment, not an inline category switch. Only the
-- existing explicit withdrawal RPC clears it, while ordinary lineup edits keep
-- the same entry, admissions, ownership checks and deadline protections.
do $migration$
declare
  v_definition text;
  v_marker text := '  if v_entry.program is distinct from p_previous_program then';
  v_replacement text;
  v_count integer;
begin
  select pg_get_functiondef('public.save_current_season_five_gala_registration(text,jsonb,text)'::regprocedure)
  into v_definition;
  if position('-- A saved programme is locked until explicit withdrawal.' in v_definition)=0 then
    v_count := (length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker);
    if v_count<>1 then raise exception 'La validation du programme du gala S5 est inattendue.'; end if;
    v_replacement := E'  -- A saved programme is locked until explicit withdrawal.\n'
      || E'  if v_entry.id is not null and v_entry.program<>p_program then\n'
      || E'    raise exception ''Retirez d’abord votre inscription actuelle pour changer de programme.'';\n'
      || E'  end if;\n'
      || v_marker;
    execute replace(v_definition,v_marker,v_replacement);
  end if;
end;
$migration$;

-- Authenticated, read-only public programme. No authentication identifiers,
-- financial data, admission snapshots or unselected riders are published.
create or replace function public.get_season_five_gala_startlists()
returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='5s'
as $$
declare
  v_edition public.season_gala_editions%rowtype;
  v_service boolean := coalesce(auth.role(),'')='service_role';
  v_courses jsonb;
begin
  if auth.uid() is null and not v_service then
    raise exception using errcode='42501',message='Authentification requise.';
  end if;
  select edition.* into v_edition from public.season_gala_editions edition
  join public.seasons season on season.id=edition.source_season_id and season.game_year=5;
  if v_edition.id is null then raise exception 'Le programme du gala est indisponible.'; end if;
  if not v_service and not private.season_five_gala_can_access(v_edition.id) then
    raise exception using errcode='42501',message='Le programme du gala n’est pas encore publié.';
  end if;

  with complete_lineups as materialized (
    select selected.entry_id,selected.event_key
    from public.season_gala_entry_riders selected
    join public.riders rider on rider.id=selected.rider_id
    where selected.edition_id=v_edition.id
    group by selected.entry_id,selected.event_key
    having count(*) between 7 and 8
      and min(selected.position)=1 and max(selected.position)=count(*)
  ), entry_identities as materialized (
    -- Project the S6 kit/name once per entry, even if it enters all three races.
    select entry.id,entry.team_id,entry.program,
      jsonb_build_object('pattern',team.amateur_jersey_pattern,
        'primaryColor',team.amateur_jersey_primary_color,
        'secondaryColor',team.amateur_jersey_secondary_color,
        'accentColor',team.amateur_jersey_accent_color) as amateur_jersey,
      private.season_five_gala_team_identity(entry.team_id) as identity
    from public.season_gala_entries entry
    join public.teams team on team.id=entry.team_id
    where entry.edition_id=v_edition.id
      and exists(select 1 from complete_lineups lineup where lineup.entry_id=entry.id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'eventKey',event.event_key,'program',event.program,
    'teams',coalesce((select jsonb_agg(jsonb_build_object(
      'teamId',entry.team_id,'name',entry.identity->>'name',
      'futureName',entry.identity->>'futureName',
      'identityReady',coalesce((entry.identity->>'identityReady')::boolean,false),
      'sponsorCatalogKey',entry.identity->>'sponsorCatalogKey',
      'jerseyId',entry.identity->>'jerseyId','jerseyStyle',entry.identity->>'jerseyStyle',
      'amateurJersey',entry.amateur_jersey,
      'riders',(select jsonb_agg(jsonb_build_object(
        'riderId',selected.rider_id,'firstName',rider.first_name,'lastName',rider.last_name,'position',selected.position
      ) order by selected.position)
        from public.season_gala_entry_riders selected
        join public.riders rider on rider.id=selected.rider_id
        where selected.entry_id=entry.id and selected.event_key=event.event_key)
    ) order by coalesce(entry.identity->>'futureName',entry.identity->>'name'),entry.team_id)
      from entry_identities entry
      join complete_lineups lineup on lineup.entry_id=entry.id and lineup.event_key=event.event_key
      where entry.program=event.program),'[]'::jsonb)
  ) order by case event.program when 'pro-tour' then 0 else 1 end,event.position),'[]'::jsonb)
  into v_courses
  from public.season_gala_events event where event.edition_id=v_edition.id;

  return jsonb_build_object('editionId',v_edition.id,'sourceSeason',5,
    'targetGameYear',v_edition.target_game_year,'closesAt',v_edition.registration_closes_at,'courses',v_courses);
end;
$$;

revoke all on function public.get_season_five_gala_startlists() from public,anon;
grant execute on function public.get_season_five_gala_startlists() to authenticated,service_role;
comment on function public.get_season_five_gala_startlists() is
  'Read-only authenticated S5 gala startlists with projected S6 kits and selected rider names; includes all six courses without exposing private registration data.';

notify pgrst,'reload schema';
commit;
