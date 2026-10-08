begin;
set local lock_timeout='3s';
set local statement_timeout='10s';
do $$ begin
  if to_regprocedure('public.settle_halloween_event()') is null
     or to_regprocedure('public.get_current_halloween_state()') is null
     or to_regprocedure('public.apply_halloween_avatar()') is null
     or position('halloween_rider_effects' in pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure))=0 then
    raise exception 'Halloween migrations are incomplete; cannot register the release.';
  end if;
end $$;
insert into supabase_migrations.schema_migrations(version,name) values
('20261008210000','create_halloween_event'),
('20261008210100','halloween_items_and_state'),
('20261008210200','halloween_catalog'),
('20261008210300','halloween_settlement'),
('20261008210400','halloween_avatars_and_longevity')
on conflict(version) do nothing;
commit;
