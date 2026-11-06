# Draft list validation and availability

The save action was fixed at bottom:0/z40, underneath the mobile navigation
at z120. The validation dock now uses the shared mobile-dock-clearance rule,
safe-area spacing, and room for the floating help button. A second save button
is always present in the preferences panel while editing is allowed. Pending
changes and save feedback are displayed beside the controls. Confirmation
dialogs appear above the mobile navigation.

Preferences remain editable after 14:00 while the participant is pending,
including their own unexpired turn. A completed recruitment, passed turn,
expired own deadline or known position behind the current turn closes editing.
The legitimate running/current_position=NULL state between worker bursts still
permits edits. Saving precedes automatic advancement, as before, so a newly
validated automatic list can be used immediately during the player's turn.

The server already supported preferences after selections started. The migration
only tightens the stale-position/missing-own-deadline guards; it preserves all
other save logic, worker scheduling, pick rules, view data and permissions.
Server refreshes adopt saved preferences when the editor is clean and retain
unsaved local edits otherwise.

Validation: 32 component/helper tests and 61 isolated SQL assertions across 15
scenarios, using the audited production function definitions as source fixtures.
No live player list or draft was modified. Mobile QA at 390x844 and 320x568 used
the development-only /apercus/draft route, real mobile navigation and fake data
with the draft already running after 14:00. The dock button receives clicks,
stays above navigation and creates no horizontal overflow. The preview is 404
in production. Local Turbopack failed spawning its CSS worker; Webpack rendered
the preview successfully. Production uses the normal Vercel build.

Delivery: scripts/deliver-draft-preferences-until-turn.mjs checks the reviewed
SQL hash and exact function baseline, applies only this guard with bounded
waits and an atomic migration receipt, then verifies the full function bodies,
unchanged permissions and the availability of the database and public site.
