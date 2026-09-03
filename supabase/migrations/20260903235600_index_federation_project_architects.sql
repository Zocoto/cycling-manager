begin;

create index if not exists national_federation_project_architect_contract_idx
  on public.national_federation_project_architects (staff_contract_id);

commit;
