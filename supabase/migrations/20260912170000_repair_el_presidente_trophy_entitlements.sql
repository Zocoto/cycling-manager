begin;

-- Répare les attributions manquantes pour tous les présidents humains connus,
-- y compris ceux dont le mandat s'est terminé avant l'ajout du trophée.
do $$
declare
  v_president record;
begin
  for v_president in
    select distinct term.president_director_id
    from public.national_federation_terms as term
    join public.sporting_directors as director
      on director.id = term.president_director_id
     and director.status = 'active'
     and director.auth_user_id is not null
    where term.president_director_id is not null
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = director.id
      )
  loop
    perform private.award_el_presidente_trophy(
      v_president.president_director_id
    );
  end loop;

  if exists (
    select 1
    from public.national_federation_terms as term
    join public.sporting_directors as director
      on director.id = term.president_director_id
     and director.status = 'active'
     and director.auth_user_id is not null
    left join public.sporting_director_trophies as trophy
      on trophy.sporting_director_id = director.id
     and trophy.trophy_key = 'el_presidente'
     and trophy.claimed_at is not null
    where term.president_director_id is not null
      and trophy.id is null
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = director.id
      )
  ) then
    raise exception
      'Le rattrapage El Presidente a laissé au moins un président humain sans trophée.';
  end if;
end;
$$;

commit;
