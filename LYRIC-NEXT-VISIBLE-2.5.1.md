# DanceMoves 2.5.1 — next visible lyric contract

## Regression

The 2.4.1 lyric event correctly preserved the immediate next LRC entry. On canonical files that use a timed blank clearing cue before the next sung line, page adapters received an empty `nextText` and could not preview the next visible lyric.

Christmas Tat exposes the failure clearly: many blank cues and their following sung lines share the same timestamp. The current page adapter therefore skipped the bottom ticket even though its positioning code was intact.

## Compatible correction

The existing immediate fields remain unchanged:

- `nextTime`
- `nextText`
- `nextNormalisedText`
- `nextIndex`

DanceMoves 2.5.1 adds a non-destructive visible look-ahead:

- `nextVisibleTime`
- `nextVisibleText`
- `nextVisibleNormalisedText`
- `nextVisibleIndex`

The visible fields scan forward to the next non-empty canonical LRC entry. They do not delete, move or reinterpret blank cues, and they use the same parsed timing list and audio clock.

## Acceptance

- Immediate blank cues remain observable through the existing fields.
- A sung line following a blank cue at the same timestamp is returned through the visible fields.
- The final lyric returns null/empty/-1 visible fields.
- Page adapters do not fetch or parse a second timing file.
