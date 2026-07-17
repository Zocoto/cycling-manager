begin;

-- ============================================================
-- SAISON INITIALE
-- Première saison active utilisée pour lancer les carrières.
-- Une saison Cyclostratège dure exactement 28 jours.
-- ============================================================

insert into public.seasons (
  game_year,
  name,
  starts_on,
  ends_on,
  status,
  current_day_number
)
values (
  1,
  'Saison 1',
  date '2026-07-17',
  date '2026-08-13',
  'active',
  1
)
on conflict (game_year)
do update set
  name = excluded.name,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  status = excluded.status,
  current_day_number = excluded.current_day_number;


-- ============================================================
-- JOURNÉES DE LA SAISON
-- Création des 28 journées du calendrier.
-- ============================================================

insert into public.season_days (
  season_id,
  day_number,
  calendar_date,
  label
)
select
  season.id,
  day_number,
  season.starts_on + (day_number - 1),
  'Jour ' || day_number
from public.seasons as season
cross join generate_series(1, 28) as day_number
where season.game_year = 1
on conflict (season_id, day_number)
do update set
  calendar_date = excluded.calendar_date,
  label = excluded.label;

commit;