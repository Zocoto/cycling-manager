begin;

-- ============================================================
-- OBJECTIFS PROVISOIRES DES OFFRES DE SPONSORING
--
-- Prépare sponsor_objectives pour l’EPIC 5 :
-- - 7 objectifs ordonnés par offre ;
-- - objectifs provisoires autonomes, sans fausses courses ;
-- - classement UCI comme nouvelle famille ;
-- - bonus de renouvellement associé à chaque objectif ;
-- - paramètres métier conservés dans un instantané JSON.
-- ============================================================


-- ============================================================
-- TYPES D’OBJECTIFS
-- ============================================================

alter table public.sponsor_objectives
drop constraint if exists sponsor_objectives_type_allowed;

alter table public.sponsor_objectives
add constraint sponsor_objectives_type_allowed
check (
  objective_type in (
    'race_result',
    'nationality_quota',
    'season_wins',
    'uci_ranking'
  )
);


-- ============================================================
-- COLONNES COMMUNES AUX OBJECTIFS PROVISOIRES
-- ============================================================

alter table public.sponsor_objectives
add column display_order smallint;

alter table public.sponsor_objectives
add column renewal_bonus_percent numeric(5, 2)
not null
default 1.00;

alter table public.sponsor_objectives
add column is_provisional boolean
not null
default true;

alter table public.sponsor_objectives
add column target_details jsonb
not null
default '{}'::jsonb;


-- ============================================================
-- COMPATIBILITÉ AVEC D’ÉVENTUELLES DONNÉES EXISTANTES
-- ============================================================

with ranked_objectives as (
  select
    id,
    row_number() over (
      partition by sponsor_offer_id, season_id
      order by created_at, id
    ) as generated_display_order
  from public.sponsor_objectives
)
update public.sponsor_objectives
set display_order =
  ranked_objectives.generated_display_order
from ranked_objectives
where public.sponsor_objectives.id =
  ranked_objectives.id
  and public.sponsor_objectives.display_order is null;

alter table public.sponsor_objectives
alter column display_order set not null;


-- ============================================================
-- CONTRAINTES MÉTIER
-- ============================================================

alter table public.sponsor_objectives
add constraint sponsor_objectives_display_order_allowed
check (
  display_order between 1 and 7
);

alter table public.sponsor_objectives
add constraint sponsor_objectives_renewal_bonus_percent_allowed
check (
  renewal_bonus_percent >= 0
  and renewal_bonus_percent <= 100
);

alter table public.sponsor_objectives
add constraint sponsor_objectives_target_details_object
check (
  jsonb_typeof(target_details) = 'object'
);

create unique index
if not exists sponsor_objectives_offer_display_order_unique_idx
on public.sponsor_objectives (
  sponsor_offer_id,
  display_order
);


-- ============================================================
-- DOCUMENTATION
-- ============================================================

comment on column public.sponsor_objectives.display_order is
  'Position d’affichage de l’objectif dans l’offre, comprise entre 1 et 7.';

comment on column public.sponsor_objectives.renewal_bonus_percent is
  'Pourcentage d’augmentation du budget de renouvellement accordé si l’objectif est rempli.';

comment on column public.sponsor_objectives.is_provisional is
  'Indique que l’objectif utilise le système simplifié de l’EPIC 5 et sera remplacé ou enrichi par le futur moteur complet.';

comment on column public.sponsor_objectives.target_details is
  'Instantané JSON des paramètres nécessaires à l’affichage et à la future évaluation de l’objectif.';

notify pgrst, 'reload schema';

commit;