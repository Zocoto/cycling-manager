# Secondary sponsor brand names

The original catalog seed appended the country ISO code to each of the ten
brand templates (for example Novara FR). The migration replaces only those
exact generated labels with their brand name, retaining catalog keys, country
relationships, IDs, prestige, colors and logo variants. Offers and contracts
reference these IDs, so their labels and dynamic SVG logos read the clean name.

Current/planned team identities that copied the suffix at activation are repaired
only when their trailing secondary sponsor component is recognized. Short names
also handle a single country-code letter clipped at the 30-character limit.
Custom names, real brand acronyms, archived seasons and sporting snapshots are
preserved. Contracts, objectives, rewards and finances are unchanged.

A restricted BEFORE INSERT/UPDATE normalizer protects a future import or reseed
using the old naming format. Its exact catalog-key, country and template match
does not remove arbitrary uppercase text. Existing activation and gala identity
functions automatically use the corrected catalog and are left unchanged.

Validation: 61 isolated PGlite assertions across seven scenarios, including the
real activation function, legacy upsert, clipped short names and preservation of
unrelated data. The real team-name uniqueness constraint is reproduced, with a
collision test proving the complete transaction rolls back. No live fixture is
used. Production preflight checks the bounded set of affected team identities
and name collisions before applying only the reviewed migration with an atomic
receipt, then verifies corrected labels, the normalizer, unchanged business
functions, database connectivity and public application availability.
