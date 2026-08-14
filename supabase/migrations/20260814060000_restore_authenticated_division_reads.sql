begin;

grant select on table public.divisions to authenticated;

drop policy if exists "Authenticated users can read divisions"
  on public.divisions;

create policy "Authenticated users can read divisions"
  on public.divisions
  for select
  to authenticated
  using (true);

commit;
