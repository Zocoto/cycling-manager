begin;

-- ============================================================
-- NATIONALITÉS JOUABLES
-- La liste proposée au joueur est limitée à :
--   - 193 États membres de l'ONU ;
--   - l'État de Palestine ;
--   - le Saint-Siège.
--
-- Les territoires dépendants, collectivités d'outre-mer et
-- zones non souveraines restent dans le référentiel, mais sont
-- désactivés pour les sélections dans l'application.
-- ============================================================

update public.countries
set is_active = false;

update public.countries
set is_active = true
where iso_alpha2 in (
  -- A
  'AF', -- Afghanistan
  'AL', -- Albanie
  'DZ', -- Algérie
  'DE', -- Allemagne
  'AD', -- Andorre
  'AO', -- Angola
  'AG', -- Antigua-et-Barbuda
  'SA', -- Arabie saoudite
  'AR', -- Argentine
  'AM', -- Arménie
  'AU', -- Australie
  'AT', -- Autriche
  'AZ', -- Azerbaïdjan

  -- B
  'BS', -- Bahamas
  'BH', -- Bahreïn
  'BD', -- Bangladesh
  'BB', -- Barbade
  'BE', -- Belgique
  'BZ', -- Belize
  'BJ', -- Bénin
  'BT', -- Bhoutan
  'BY', -- Biélorussie
  'MM', -- Birmanie / Myanmar
  'BO', -- Bolivie
  'BA', -- Bosnie-Herzégovine
  'BW', -- Botswana
  'BR', -- Brésil
  'BN', -- Brunei
  'BG', -- Bulgarie
  'BF', -- Burkina Faso
  'BI', -- Burundi

  -- C
  'KH', -- Cambodge
  'CM', -- Cameroun
  'CA', -- Canada
  'CV', -- Cap-Vert
  'CF', -- République centrafricaine
  'CL', -- Chili
  'CN', -- Chine
  'CY', -- Chypre
  'CO', -- Colombie
  'KM', -- Comores
  'CG', -- Congo
  'CD', -- République démocratique du Congo
  'KP', -- Corée du Nord
  'KR', -- Corée du Sud
  'CR', -- Costa Rica
  'CI', -- Côte d’Ivoire
  'HR', -- Croatie
  'CU', -- Cuba

  -- D
  'DK', -- Danemark
  'DJ', -- Djibouti
  'DM', -- Dominique
  'DO', -- République dominicaine

  -- E
  'EG', -- Égypte
  'AE', -- Émirats arabes unis
  'EC', -- Équateur
  'ER', -- Érythrée
  'ES', -- Espagne
  'EE', -- Estonie
  'SZ', -- Eswatini
  'US', -- États-Unis
  'ET', -- Éthiopie

  -- F
  'FJ', -- Fidji
  'FI', -- Finlande
  'FR', -- France

  -- G
  'GA', -- Gabon
  'GM', -- Gambie
  'GE', -- Géorgie
  'GH', -- Ghana
  'GR', -- Grèce
  'GD', -- Grenade
  'GT', -- Guatemala
  'GN', -- Guinée
  'GW', -- Guinée-Bissau
  'GQ', -- Guinée équatoriale
  'GY', -- Guyana

  -- H
  'HT', -- Haïti
  'HN', -- Honduras
  'HU', -- Hongrie

  -- I
  'IN', -- Inde
  'ID', -- Indonésie
  'IQ', -- Irak
  'IR', -- Iran
  'IE', -- Irlande
  'IS', -- Islande
  'IL', -- Israël
  'IT', -- Italie

  -- J
  'JM', -- Jamaïque
  'JP', -- Japon
  'JO', -- Jordanie

  -- K
  'KZ', -- Kazakhstan
  'KE', -- Kenya
  'KG', -- Kirghizistan
  'KI', -- Kiribati
  'KW', -- Koweït

  -- L
  'LA', -- Laos
  'LS', -- Lesotho
  'LV', -- Lettonie
  'LB', -- Liban
  'LR', -- Liberia
  'LY', -- Libye
  'LI', -- Liechtenstein
  'LT', -- Lituanie
  'LU', -- Luxembourg

  -- M
  'MK', -- Macédoine du Nord
  'MG', -- Madagascar
  'MY', -- Malaisie
  'MW', -- Malawi
  'MV', -- Maldives
  'ML', -- Mali
  'MT', -- Malte
  'MA', -- Maroc
  'MH', -- Îles Marshall
  'MU', -- Maurice
  'MR', -- Mauritanie
  'MX', -- Mexique
  'FM', -- Micronésie
  'MD', -- Moldavie
  'MC', -- Monaco
  'MN', -- Mongolie
  'ME', -- Monténégro
  'MZ', -- Mozambique

  -- N
  'NA', -- Namibie
  'NR', -- Nauru
  'NP', -- Népal
  'NI', -- Nicaragua
  'NE', -- Niger
  'NG', -- Nigeria
  'NO', -- Norvège
  'NZ', -- Nouvelle-Zélande

  -- O
  'OM', -- Oman
  'UG', -- Ouganda
  'UZ', -- Ouzbékistan

  -- P
  'PK', -- Pakistan
  'PW', -- Palaos
  'PS', -- État de Palestine
  'PA', -- Panama
  'PG', -- Papouasie-Nouvelle-Guinée
  'PY', -- Paraguay
  'NL', -- Pays-Bas
  'PE', -- Pérou
  'PH', -- Philippines
  'PL', -- Pologne
  'PT', -- Portugal

  -- Q
  'QA', -- Qatar

  -- R
  'RO', -- Roumanie
  'GB', -- Royaume-Uni
  'RU', -- Russie
  'RW', -- Rwanda

  -- S
  'KN', -- Saint-Christophe-et-Niévès
  'SM', -- Saint-Marin
  'VC', -- Saint-Vincent-et-les-Grenadines
  'LC', -- Sainte-Lucie
  'SB', -- Îles Salomon
  'SV', -- Salvador
  'WS', -- Samoa
  'ST', -- Sao Tomé-et-Principe
  'SN', -- Sénégal
  'RS', -- Serbie
  'SC', -- Seychelles
  'SL', -- Sierra Leone
  'SG', -- Singapour
  'SK', -- Slovaquie
  'SI', -- Slovénie
  'SO', -- Somalie
  'SD', -- Soudan
  'SS', -- Soudan du Sud
  'LK', -- Sri Lanka
  'ZA', -- Afrique du Sud
  'SE', -- Suède
  'CH', -- Suisse
  'SR', -- Suriname
  'SY', -- Syrie

  -- T
  'TJ', -- Tadjikistan
  'TZ', -- Tanzanie
  'TD', -- Tchad
  'CZ', -- Tchéquie
  'TH', -- Thaïlande
  'TL', -- Timor oriental
  'TG', -- Togo
  'TO', -- Tonga
  'TT', -- Trinité-et-Tobago
  'TN', -- Tunisie
  'TM', -- Turkménistan
  'TR', -- Turquie
  'TV', -- Tuvalu

  -- U
  'UA', -- Ukraine
  'UY', -- Uruguay

  -- V
  'VU', -- Vanuatu
  'VA', -- Saint-Siège / Vatican
  'VE', -- Venezuela
  'VN', -- Viêt Nam

  -- Y
  'YE', -- Yémen

  -- Z
  'ZM', -- Zambie
  'ZW'  -- Zimbabwe
);

-- ============================================================
-- CONTRÔLE DE COHÉRENCE
-- La migration échoue si le référentiel ne contient pas
-- exactement les 195 États attendus.
-- ============================================================

do $$
declare
  active_country_count integer;
begin
  select count(*)
  into active_country_count
  from public.countries
  where is_active = true;

  if active_country_count <> 195 then
    raise exception using
      errcode = '23514',
      message = format(
        'Le référentiel devrait contenir 195 pays actifs, mais %s ont été trouvés.',
        active_country_count
      );
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;