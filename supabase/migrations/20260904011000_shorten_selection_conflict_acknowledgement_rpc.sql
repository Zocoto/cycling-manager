begin;

-- PostgreSQL limite les identifiants à 63 octets. La première publication de
-- la RPC et de son trigger a donc tronqué leurs noms ; on les raccourcit
-- explicitement pour que PostgREST expose un endpoint stable.
do $rename_truncated_selection_functions$
begin
  if pg_catalog.to_regprocedure(
    'public.respond_to_international_championship_selection_with_conflict_a(uuid,boolean,text[])'
  ) is not null
    and pg_catalog.to_regprocedure(
      'public.respond_to_international_selection_with_conflict_ack(uuid,boolean,text[])'
    ) is null
  then
    alter function
      public.respond_to_international_championship_selection_with_conflict_a(
        uuid,
        boolean,
        text[]
      )
    rename to respond_to_international_selection_with_conflict_ack;
  end if;

  if pg_catalog.to_regprocedure(
    'public.refresh_pending_international_selection_messages_from_calendar_()'
  ) is not null
    and pg_catalog.to_regprocedure(
      'public.refresh_pending_selection_messages_from_calendar_change()'
    ) is null
  then
    alter function
      public.refresh_pending_international_selection_messages_from_calendar_()
    rename to refresh_pending_selection_messages_from_calendar_change;
  end if;
end;
$rename_truncated_selection_functions$;

revoke all
on function public.respond_to_international_selection_with_conflict_ack(
  uuid,
  boolean,
  text[]
)
from public, anon;

grant execute
on function public.respond_to_international_selection_with_conflict_ack(
  uuid,
  boolean,
  text[]
)
to authenticated;

notify pgrst, 'reload schema';

commit;
