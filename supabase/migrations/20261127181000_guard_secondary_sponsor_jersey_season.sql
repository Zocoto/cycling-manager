begin;
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

-- The preview and save path must refer to the same season. Preparing a future
-- placement never authorizes editing the current season's secondary contract.
create or replace function public.update_secondary_sponsor_logo(
  p_contract_id uuid,p_x_percent numeric,p_y_percent numeric,p_scale numeric,p_rotation_degrees numeric,p_color_mode text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_x_percent is null or p_y_percent is null or p_scale is null or p_rotation_degrees is null
    or p_x_percent not between 15 and 85 or p_y_percent not between 20 and 78
    or p_scale not between 0.5 and 1.8 or p_rotation_degrees not between -45 and 45
    or p_color_mode is null or p_color_mode not in ('original','black','white') then
    raise exception 'Le placement ou la couleur du logo est hors des limites autorisées.';
  end if;

  update public.secondary_sponsor_contracts contract
  set logo_x_percent=round(p_x_percent,2),logo_y_percent=round(p_y_percent,2),
    logo_scale=round(p_scale,2),logo_rotation_degrees=round(p_rotation_degrees,2),logo_color_mode=p_color_mode
  where contract.id=p_contract_id
    and exists (
      select 1 from public.team_manager_assignments assignment
      join public.sporting_directors director on director.id=assignment.sporting_director_id
      where assignment.team_id=contract.team_id and assignment.role='general_manager' and assignment.status='active'
        and director.status='active' and director.auth_user_id=auth.uid()
    )
    and exists (
      select 1
      from public.seasons target
      join public.seasons current_season on current_season.status='active'
      join public.team_sponsor_contracts principal on principal.team_id=contract.team_id and principal.role='principal'
      join public.seasons start_season on start_season.id=principal.start_season_id
      left join public.seasons end_season on end_season.id=principal.end_season_id
      where target.id=contract.season_id
        and target.game_year between start_season.game_year
          and coalesce(end_season.game_year,start_season.game_year+principal.contract_duration_seasons-1)
        and (
          (contract.status='active' and target.id=current_season.id and principal.status='active'
            and nullif(btrim(principal.selected_jersey_id),'') is not null)
          or (contract.status='planned' and target.status='planned' and target.game_year=current_season.game_year+1
            and (
              (principal.status='planned' and principal.start_season_id=target.id
                and nullif(btrim(principal.selected_jersey_id),'') is not null)
              or (principal.status='active' and principal.pending_jersey_season_id=target.id
                and nullif(btrim(principal.pending_jersey_id),'') is not null
                and not exists (
                  select 1 from public.team_sponsor_contracts next_contract
                  where next_contract.team_id=contract.team_id and next_contract.role='principal'
                    and next_contract.status='planned' and next_contract.start_season_id=target.id
                ))
            ))
        )
    );

  if not found then
    raise exception 'Le placement ne peut pas être modifié. Choisissez le maillot principal de la saison concernée.';
  end if;
end;
$$;

revoke all on function public.update_secondary_sponsor_logo(uuid,numeric,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.update_secondary_sponsor_logo(uuid,numeric,numeric,numeric,numeric,text) to authenticated;

commit;
