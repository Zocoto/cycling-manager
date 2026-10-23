begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';
set local application_name = 'direct-offer-read-policy-fix-20261023';

-- The old inline policy reads a deliberately private assignment table under
-- the player's role, so even a legitimate recipient gets permission denied.
-- Reuse the mature, authenticated SECURITY DEFINER ownership predicate instead.
do $$
begin
  if (select md5(pg_get_expr(polqual, polrelid)) from pg_policy
      where polrelid = 'public.direct_transfer_offers'::regclass
        and polname = 'direct_transfer_offers_select_managed_teams')
      is distinct from '987f2a6be56aec95ae719181c23b189f'
    or md5(replace(pg_get_functiondef('public.current_user_manages_team(uuid)'::regprocedure), chr(13), ''))
      <> '4537699f0a1249d5d275dd8f94535f42'
    or not (select prosecdef from pg_proc where oid = 'public.current_user_manages_team(uuid)'::regprocedure)
    or not has_function_privilege('authenticated', 'public.current_user_manages_team(uuid)', 'execute')
  then
    raise exception 'Direct-offer policy or ownership helper changed; review required.';
  end if;
end;
$$;

alter policy direct_transfer_offers_select_managed_teams
on public.direct_transfer_offers
using (
  public.current_user_manages_team(buyer_team_id)
  or public.current_user_manages_team(seller_team_id)
);

-- No new grants, assignment-table access, write policies, offer changes or
-- replacement of transfer/finance/contract functions.
commit;
