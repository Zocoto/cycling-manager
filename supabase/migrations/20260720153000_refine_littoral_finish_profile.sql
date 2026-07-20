begin;

-- Le Grand Prix du Littoral est une classique favorable aux coureurs rapides,
-- mais son arrivée est jugée au sommet d'une côte. Le profil détaillé doit
-- conserver cette particularité même si son étiquette globale reste "sprint".
with littoral_finish as (
  select segment.id
  from public.stage_segments as segment
  join public.stages as stage
    on stage.id = segment.stage_id
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  where race.slug = 'grand-prix-du-littoral'
    and segment.segment_number = (
      select max(last_segment.segment_number)
      from public.stage_segments as last_segment
      where last_segment.stage_id = stage.id
    )
)
update public.stage_segments as segment
set
  terrain_type = 'climb',
  surface_type = 'asphalt',
  average_gradient_pct = 5.8
from littoral_finish
where segment.id = littoral_finish.id;

commit;
