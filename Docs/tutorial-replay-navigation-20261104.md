# Tutorial replays follow the selected step

Lionelionel had completed all eleven tutorials and already claimed the final
achievement. His later Equipment and Roster replay sessions stopped at a
change of page. The tutorial cursor advanced, but navigation reused the
completed progress row's historical finishing URL.

The captured Equipment session selected `/jeu/materiel/equipementier` but
received `/jeu/inventaire?categorie=equipment`. The Roster replay received
the literal `/jeu/coureurs/[identifiant]` instead of a real rider page.

Start/step actions now return the selected session's concrete `resolvedRoute`
separately from the saved progress. The client uses that route when starting
and navigating a tutorial, checking it against the selected step's route
pattern. Static sections retain their correct URL/query; a rider page must
have a concrete identifier. Unrelated URLs and unresolved placeholders cannot
be navigation destinations.

Completed/skipped progress continues to retain its status and historical
cursor during replay. Unfinished tutorials still persist their route/cursor
normally. The existing server-side requirements, authentication, authorization
and first-incomplete-step behavior are preserved. No account reset, reward
claim, schema migration, new RPC, request or polling loop is introduced.

Tests exercise the actual start/step actions against an isolated client
fixture: both reported cases, Previous, starting a replay, server recovery of
a dynamic rider route, skipped and unfinished progress, and rejection of an
unrelated section. Route tests verify concrete identifiers, query parameters,
server destination priority and invalid URL rejection. The full tutorial
regression suite, targeted ESLint and translation checks run before delivery.

Validation: all 23 focused tests pass. The wider tutorial run passes 187 of
189 tests. Its two failures are pre-existing source-string assertions in
`tutorial-center-mobile.test.ts`: they expect the former header-anchored menu
and old bottom classes, whereas the unchanged menu already uses a fixed
floating panel. Both the menu and that test are identical to the production
baseline; this navigation fix does not alter their layout.

Production verification uses only bounded, sequential read-only diagnostics
and ordinary public page requests. It does not operate a player's tutorial.
