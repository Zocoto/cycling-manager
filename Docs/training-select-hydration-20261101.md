# Training selectors: mobile hydration and browser restoration

## Diagnosis

The coach selector and the visible talent breakdown both derive from the same
`selectedTrainer` during the same React render. A visible talent breakdown with
an empty coach selector therefore indicates a native control/display divergence,
rather than a missing coach assignment.

The October 27 fix kept training cards fully rendered on mobile to avoid native
control painting issues with `content-visibility`. It did not reconcile a native
selection restored by the browser before React hydration. React 19.2.4 preserves
that selection during hydration; a subsequent component update applies the
controlled value again. This explains why changing the training domain can make
the correct coach reappear. This restoration scenario is reproducible locally;
we do not have a recording of the reporting player's browser restoration.

## Fix

- Reconcile only the training domain and coach selectors when the editor mounts
  and when the browser fires `pageshow`, including back/forward restoration.
- Read expected values from current React-rendered attributes, so unsaved edits
  and explicitly restored drafts take precedence over initial server values.
- Perform an immediate check and one animation-frame check for browsers that
  finish restoring controls after `pageshow`. Remove the listener and cancel the
  pending frame when the editor unmounts.
- Disable browser autocomplete for this management form and its selectors.
- Keep native menus, coach quotas, partial batch saves and mobile card rendering.

There is one listener per editor, no polling, no added request and no database
change. Only mismatched native values are written; the reconciliation never
updates React plans, marks a program dirty or submits the form. The form is
limited to the team's roster (at most two selectors per visible rider).

## Verification

- 101 existing checks across nine training, batch save, state, service,
  performance and tutorial test files pass.
- ESLint, TypeScript and `git diff --check` pass.
- The offline browser regression script exercises the actual training editor
  with mocked server actions and synthetic players. It never connects to a live
  account or changes production training plans.
- The pre-fix component reproduces the reported symptom in Chromium with a
  mobile viewport: `coach-a` is applied, but the native selector remains empty
  after hydration; changing the domain makes the coach reappear. The corrected
  component restores both selectors before any interaction.
- History restoration retains local edits; a current full coach remains
  selectable; an unassigned rider stays unassigned. Sorting, scrolling, explicit
  coach removal and a single explicit batch save retain their behavior. Browser
  hydration reports no recoverable error and the test makes no network request.

Run the browser regression with `node scripts/test-training-select-hydration.mjs
<path-to-playwright-core-module> <path-to-chromium-executable>`. The browser
runtime is supplied externally; no production dependency is added.
