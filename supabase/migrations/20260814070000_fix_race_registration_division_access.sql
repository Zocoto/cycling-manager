begin;

-- Le contexte d'inscription est assemblé côté serveur avec le client privé.
-- Les autres tables de l'équipe étaient lisibles par service_role, mais pas
-- le référentiel des divisions : toute la lecture retombait alors à tort sur
-- "Amateur / 0 réputation" pour toutes les catégories de course.
grant select on table public.divisions to service_role;

notify pgrst, 'reload schema';

commit;
