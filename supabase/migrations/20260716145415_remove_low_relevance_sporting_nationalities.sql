begin;

-- ============================================================
-- NATIONALITÉS SPORTIVES JOUABLES
-- Désactivation de micro-États et petits États insulaires
-- considérés comme peu pertinents pour le gameplay initial.
--
-- Les lignes restent conservées dans le référentiel afin de
-- pouvoir être réactivées plus tard si nécessaire.
-- ============================================================

update public.countries
set is_active = false
where iso_alpha2 in (
  'AD', -- Andorre
  'AG', -- Antigua-et-Barbuda
  'KM', -- Comores
  'DM', -- Dominique
  'FM', -- Micronésie
  'GD', -- Grenade
  'KI', -- Kiribati
  'LI', -- Liechtenstein
  'MH', -- Îles Marshall
  'MC', -- Monaco
  'NR', -- Nauru
  'PW', -- Palaos
  'KN', -- Saint-Christophe-et-Niévès
  'SM', -- Saint-Marin
  'VC', -- Saint-Vincent-et-les-Grenadines
  'LC', -- Sainte-Lucie
  'WS', -- Samoa
  'ST', -- Sao Tomé-et-Principe
  'SC', -- Seychelles
  'TO', -- Tonga
  'TV', -- Tuvalu
  'VA'  -- Vatican
);

-- Vérification : aucune nationalité exclue ne doit rester active.

do $$
declare
  remaining_active_count integer;
begin
  select count(*)
  into remaining_active_count
  from public.countries
  where is_active = true
    and iso_alpha2 in (
      'AD', 'AG', 'KM', 'DM', 'FM', 'GD', 'KI', 'LI',
      'MH', 'MC', 'NR', 'PW', 'KN', 'SM', 'VC', 'LC',
      'WS', 'ST', 'SC', 'TO', 'TV', 'VA'
    );

  if remaining_active_count <> 0 then
    raise exception using
      errcode = '23514',
      message =
        'Certaines nationalités sportives exclues sont encore actives.';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;