# Persistent squad roles across renewals

Squad roles were stored on rider_contracts, while renewals inserted a new planned
contract without squad_status. Riders whose multi-season contract stayed active
kept their role; riders moving to their renewal lost it at season activation.

The new BEFORE INSERT/status UPDATE trigger inherits the role when a renewal
becomes active. It reads the latest continuous predecessor for the same rider
and team, ending in the immediately preceding game year. This includes a NULL
role deliberately cleared by the manager, and picks up edits made after the
renewal was signed. Planned contracts are not given an early, potentially stale
copy. A non-NULL role already supplied on the new contract is preserved.

Recruitments, transfers, academy promotions, returns after a gap and other clubs'
roles are not inherited. Existing active contracts and both role-setting RPCs
are unchanged. There is no retrospective backfill: the old schema did not record
when a role was cleared, so a missing role cannot always be classified safely.
The targeted Gouille audit found 31 active riders with 31 roles already populated,
including nine choices differing from the preceding contract; these current
settings are preserved rather than reverting to older choices.

The isolated PostgreSQL tests use the existing contract, payroll, deferred
transfer and season lifecycle bootstrap, plus real single/bulk role setters.
They cover activation, late edits/clears, explicit future roles, unchanged
multi-season contracts, continuity limits, transfers, permissions and financial
side effects. No live fixture or test rollover is executed.

Delivery uses scripts/deliver-persistent-squad-statuses.mjs: a reviewed-source
hash, bounded read-only preflight, a single migration with atomic receipt, exact
verification of all protected function bodies/permissions, the enabled trigger,
helper access and database/public application health.
