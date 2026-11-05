# Tutorial launch and recovery reliability

Mr0's two reported tutorials were both persisted at their first step:
Youth Development at youth-overview and Criterium Discovery at briefing.
His active, founded team and complete profile satisfied the prerequisites.
Nine other tutorials were completed. No account or progression reset is needed.

The common failure was reproduced with the actual provider/menu/launcher
callbacks: launching from /jeu?centre-didacticiels=1 pushed the tutorial's
destination, then closing its menu replaced it with /jeu. The saved session
remained active, but the overlay was hidden on the unrelated page.

Successful launches now close the menu without issuing another navigation.
Ordinary dismissal still removes the centre query parameter. Active sessions
can be resumed from the centre or the return panel after navigating away.
Local return-to-step navigation is separate from startTutorial: server-driven
route resumption must still read a changed cursor after Criterium registration.
Errors are visible outside the overlay as well as inside the centre.

An immediate client mutex prevents duplicate clicks. Client waits stop after
15 seconds and ignore late responses. Pause releases the local interface
before waiting for persistence, without inventing a completed/skipped status.
Server PostgREST operations share an eight-second abort signal; this does not
cancel the authentication claims call or prove that an interrupted write did
not commit. Resuming reads the persisted state.

Server actions reread uniqueness conflicts once and use status/timestamp
conditions for concurrent changes. Replays preserve historical completion.
Bootstrap and action responses omit stored replay metadata. Criterium
registration reads nine evidence fields instead of its simulation timeline;
course/result pages keep their full metadata getter. Stored metadata is
never cleared by these cursor writes. No migration, new RPC or polling is added.

The Criterium calendar confirmation also renders after resuming without its
original query parameter, and replay tabs expose a return-to-Live target.
Youth DEMO pages exclude real scouting, signing and training forms.
The overlay chooses rendered targets and handles late/replaced/hidden targets;
a missing interactive target leaves the page accessible.

Validation:

- Final TypeScript check succeeds; targeted ESLint checks are clean.
- Combined tutorial suite: 230 passed, with two unchanged pre-existing CSS
  source-string failures in tutorial-center-mobile.test.ts. These were already
  documented in tutorial-replay-navigation-20261104.md; the old header-anchored
  menu and bottom class expectations remain inconsistent with the baseline.
- Local browser fixture uses real React provider/menu/overlay with inert
  actions/router. Both reported launches, all 12 Youth steps, the school-tab
  transition, visible errors, return-to-step, pause and a late target were
  checked. The mobile centre and controls fit a 390 by 844 viewport.
- The actual nine-field PostgREST projection returns HTTP 200 for Mr0's single
  Criterium row. All live diagnostics were bounded, sequential and read-only.
  No player tutorial, race, reward or account was operated for verification.
- I18n scanner: 24 checks; 18,739 source strings covered.
