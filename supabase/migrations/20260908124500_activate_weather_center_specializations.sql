begin;

create or replace function public.is_valid_team_infrastructure_specialization(
  p_infrastructure_code text,
  p_specialization_code text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_infrastructure_code
    when 'recruitment_data_room' then p_specialization_code in ('market_intelligence', 'talent_network', 'deal_room')
    when 'staff_academy' then p_specialization_code in ('pedagogy', 'expertise', 'versatility')
    when 'training_center' then p_specialization_code in ('individualization', 'elite_performance', 'durability')
    when 'indoor_track' then p_specialization_code in ('pure_speed', 'explosiveness', 'leadout_school')
    when 'cryotherapy_center' then p_specialization_code in ('rapid_recovery', 'rehabilitation', 'load_management')
    when 'wind_tunnel' then p_specialization_code in ('solo_aero', 'team_aero', 'versatile_aero')
    when 'weather_center' then p_specialization_code in ('normal_weather', 'wet_protocol', 'extreme_weather')
    when 'tactical_center' then p_specialization_code in ('offensive_school', 'race_control', 'adaptive_cell')
    when 'media_center' then p_specialization_code in ('prestige_press', 'community_media', 'crisis_room')
    when 'international_welcome_center' then p_specialization_code in ('administrative_path', 'sporting_integration', 'youth_gateway')
    when 'research_lab' then p_specialization_code in ('pure_performance', 'reliability', 'frugal_innovation')
    when 'fan_club_headquarters' then p_specialization_code in ('recruitment_campaigns', 'loyalty_program', 'event_house')
    when 'club_shop' then p_specialization_code in ('volume_retail', 'premium_retail', 'limited_editions')
    else false
  end
$$;

update public.team_infrastructure_specializations
set active_specialization_code = case
      when active_specialization_code = 'microclimate' then 'normal_weather'
      else active_specialization_code
    end,
    pending_specialization_code = case
      when pending_specialization_code = 'microclimate' then 'normal_weather'
      else pending_specialization_code
    end,
    updated_at = now()
where infrastructure_code = 'weather_center'
  and (
    active_specialization_code = 'microclimate'
    or pending_specialization_code = 'microclimate'
  );

commit;
