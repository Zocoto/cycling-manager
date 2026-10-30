# Replays: race-clock pace at ×1

## Behavior

The replay previously allotted six seconds to every sector, regardless of
its actual race duration, followed by an eight-second final kilometre.
That could compress a six-hour race into roughly two minutes even at ×1.

×1 now follows the recorded race clock. Sector durations use the leading
group's saved elapsed time and the official winning time at the line.
Pausing and changing speed retain the current position. The final approach,
last kilometre and visible riders' finish passage respect the selected
speed. The available accelerations are ×2, ×4, ×8, ×16, ×32, ×64 and ×128.
The default remains ×1; a compact native selector replaces the three speed
buttons. Direct access to sectors and replay-from-start remain available.

The header shows the race duration at ×1, and the controls show the current
race clock. For example, the frozen Baltic Cobbles reference lasts 21,598
seconds at ×1 and about 169 seconds at ×128, plus the finishing passage.

Older locks without sector clocks use distance-weighted interpolation
between valid recorded anchors, preserving their overall winning time.
Without any recorded clock, 40 km/h is the presentation fallback. Invalid
or non-monotonic clocks are skipped rather than reversing the replay.

Replay interpolation starts at each sector's entrance, including kilometre
zero. This also makes old snapshot-only locks move progressively instead
of showing the sector-end snapshot for its entire duration. The live
interpolation path keeps its existing behavior.

Final-sector progress now feeds the time-trial scene as well as the road
finish scene, so it advances during playback rather than remaining fixed.
Finish helpers retain their previous defaults for callers that do not
provide a recorded kilometre duration.

## Scope and verification

This is presentation only, including for existing replays. No simulation,
ranking, incident, payout, calendar, live broadcast schedule or locked data
is recalculated. No migration, server request or scheduled job is added.
Timing is computed once per frozen simulation with `useMemo`; the existing
animation-frame rate limit and cleanup remain in place.

104 targeted tests across eight files cover real sector clocks, historical and invalid data,
sub-kilometre finishes, every acceleration, final-passage continuation,
speed-change resumption, control rendering and visual interpolation.
Existing live, finish, incident, motion and time-trial visual tests run too.

Browser verification uses synthetic local data only at `/apercus/replay`
(road) and `/apercus/replay?chrono=1` (time trial). The route returns 404 in
production. Recorded observations verify ×1 and ×16 rates, a stable pause,
sector navigation, the final approach, stopping at ×128, time-trial final
progress, and 390/320px layouts without horizontal page overflow.

Local evidence: `C:/Dev/artifacts/replay-pace-20261030/`. The Baltic frozen
simulation's SHA-256 is identical before and after building replay timing.
The local full-project type check finds only a missing `tinyld` package in
the shared dependency directory; the clean production build is the final
TypeScript check.
