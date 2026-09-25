begin;

-- Les talents de préparateur et l'affinité nationale ont porté le plafond
-- théorique à 44 % (soit 2,88 points), mais les contraintes historiques
-- validaient encore uniquement le bonus de niveau brut, plafonné à 25 %.
alter table public.stage_reconnaissances
  drop constraint if exists stage_reconnaissances_preparer_bonus_range,
  drop constraint if exists stage_reconnaissances_bonus_range;

alter table public.stage_reconnaissances
  add constraint stage_reconnaissances_preparer_bonus_range
    check (preparer_bonus_percentage between 0 and 50),
  add constraint stage_reconnaissances_bonus_range
    check (
      base_bonus_points = 2
      and bonus_points between 2 and 3
    );

comment on constraint stage_reconnaissances_preparer_bonus_range
on public.stage_reconnaissances is
  'Autorise le bonus cumulé du niveau, de l affinité nationale et du talent Repérage minutieux.';

comment on constraint stage_reconnaissances_bonus_range
on public.stage_reconnaissances is
  'Autorise jusqu à 3 points de reconnaissance afin de couvrir le maximum calculable de 2,88.';

commit;
