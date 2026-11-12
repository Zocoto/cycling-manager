begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

create or replace function private.apply_international_callup_refusal_morale(
  p_rider_id uuid, p_academy_rider_id uuid, p_race_edition_id uuid,
  p_description text, p_metadata jsonb
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_day_id uuid; v_reference text;
begin
  if (p_rider_id is null) = (p_academy_rider_id is null) or p_race_edition_id is null then
    raise exception 'Le coureur et la convocation sont requis pour modifier le moral.';
  end if;
  select day.id into v_day_id
  from public.seasons season join public.season_days day
    on day.season_id = season.id and day.day_number = season.current_day_number
  where season.status = 'active';
  if v_day_id is null then
    raise exception 'La journée de saison du moral est introuvable.';
  end if;
  -- The same championship can be represented by both selection pipelines.
  -- Share its event ID rather than a replaceable membership/candidate ID.
  -- For juniors the ID belongs to development_race_editions, not race_editions.
  v_reference := 'international-callup:' || p_race_edition_id::text;
  if p_rider_id is not null then
    perform public.apply_rider_morale_event(p_rider_id, v_day_id,
      'international_callup_refusal', v_reference, -5, p_description, p_metadata);
  else
    perform public.apply_youth_rider_morale_event(p_academy_rider_id, v_day_id,
      'international_callup_refusal', v_reference, -5, p_description, p_metadata);
  end if;
end;
$$;

commit;
