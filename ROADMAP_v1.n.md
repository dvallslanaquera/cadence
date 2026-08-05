# LIST OF TASKS TO DO 
- i.1 When selecting a task from the dropdown menu that shows in the menu to create a new task, selecting a task will automatically select what is the project that is most frequently paired with. 
- i.2 When creating a new task by double-clicking on the timer grid, 'end time' field is empty, and the app assumes that the task is being doing now in real time, so the task will look on the header of the grid and the timer will be clocking. 
- i.3 When double-clicking on the grid, the 'start time' will be selected in increments of 15 minutes. So, for example, when double clicking on the grid to create a new log, the start time can only be 0:00, 0:15, 0:30, 0:45 or 1 between 0:00 and 1:00 based on where the user double-clicked. 
- i.4 Dashboard tab default view is 'this week' and not 'last 4 weeks'. 
- i.5 I wanna keep track of the version of the app. The version can be consulted in the Settings view, in a new 'About' section. Each time the app is uploaded, the version is incremented. 
- i.6 The size of the hour lines in the timer grid must be 33% smaller than now. The grid is a bit too big. 
- i.7 Add a zoom bar to the grid. The zoom slider will be added to the bottom of the grid. control+scroll will allow the user to zoom in and zoom out. 
- i.8 Review the style of the text in the UI. Use the guidelines in global CLAUDE.md about um lines, wording, etc. 
- i.9 when creating a new task and selecting the task from the dropdown menu, the prohect that the task was lastly paired to, will be selected too automatically 
- i.10 Add to Setting the option of changing the language. Add Spanish, French, Italian and Japanese. The name in Setting of 'Language" will always be displayed in English 

## Updates about the phone version 
- p.1 The user needs to double tap on the screen to create a new time log in the timer grid. 
- p.2 When creating a new time log through the grid, the menu that pops up to add information like task name, project, start time, etc. I want that menu to be in the middle of the phone screen. Right now is showing on the left or right of the screen, making task creation hard or even impossible. 

## Third batch of changes (applied)
Refactoring Checklist
Status: done. WeekView was split into WeekViewHeader, MobileDayStrip, DayHeaderRow, WeekGrid,
ZoomBar; useZoom, useWeekNavigation, useKeyboardShortcuts were extracted; the grid sizing moved
from JS-measured calc(100vh - Npx) to a flex-1 min-h-0 column; the redundant lambdas, the
eslint-disable, the per-render formatMinutesAsClock(hour*60) (now a static HOUR_LABELS array),
the repeated new Date(new Date(iso)...) in moveEntry/resizeEntry (now shiftInstant), and the
goToToday mobileDayIndex split were all fixed. WeekView is now ~130 lines. ARCHITECTURE.md §7
and §8 were updated with the new file map.
1. Extract child components
Split the JSX into separate files. Each piece below is self-contained and has a clear props boundary:

 WeekViewHeader — the top bar: nav arrows, week label, totals, export button, start-timer button. Props: weekStart, weekEnd, weekTotal, weekYear, tz, onPrevWeek, onNextWeek, onToday, onQuickStart.
 MobileDayStrip — the 7-button day selector for mobile. Props: days, tz, segments, mobileDayIndex, onSelectDay, todayKey.
 DayHeaderRow — the sticky header row with weekday, date, per-day total, and task strip. Props: visibleDays, tz, segments, tasksByDay, todayKey, gridTemplate, onQuickStart.
 WeekGrid — the scrolling container with hour gutter and day columns. Props: visibleDays, tz, segments, selectedEntryId, todayKey, hourHeight, pxPerMinute, now, scrollRef, gridTemplate, and all the entry callbacks.
 ZoomBar — fit button, range slider, px/hour label. Props: hourHeight, onApplyZoom, onResetFit, min, max.
After extraction, WeekView itself should be ~120–150 lines: state declarations, hooks, event handlers, and the component tree wiring.

2. Extract custom hooks
 useZoom(scrollRef) — returns { hourHeight, pxPerMinute, applyZoom, zoomBy, resetFit }. Encapsulates: the hourHeight state, userZoomed ref, lastHourHeight ref, the ResizeObserver layout effect, the onWheel effect, and the scroll-position-preserving layout effect. This is ~100 lines of pure logic with no JSX.
 useWeekNavigation(weekStart, tz) — returns { goToWeek, goToToday }. Wraps router.push calls. Makes the keyboard shortcuts effect list proper deps instead of using eslint-disable.
 useKeyboardShortcuts(handlers) — generic hook that takes a map of key → handler and manages the keydown listener. Reusable, testable, and removes the eslint-disable-next-line hack.
3. Replace JS-measured grid sizing with CSS
 Remove gridTop state, the getBoundingClientRect measurement, the resize listener, and the magic numbers 84 / 168.
 Wrap the whole WeekView return in a flex column container:
<div className="flex h-dvh flex-col">
  {/* header — natural height */}
  {/* mobile strip — natural height */}
  {/* day headers — natural height */}
  <div className="flex-1 overflow-hidden">  {/* grid */}
    <WeekGrid ... />
  </div>
  {/* zoom bar — natural height */}
</div>
The grid takes remaining space automatically. No measurement, no calc(100vh - Npx), no fragility when chrome layout changes.

4. Clean up small code smells
 Remove redundant wrappers: onStart={(task) => quickStart(task)} → onStart={quickStart}. Same for any other pass-through lambdas.
 Fix the eslint-disable: After extracting goToWeek/goToToday to useCallback, list them in the keyboard effect's dependency array and remove the suppression.
 Hoist formatMinutesAsClock(hour * 60): The hour gutter maps over 24 hours and calls formatMinutesAsClock(hour * 60) each render. Precompute with useMemo or just use a static array since hours never change.
 Consolidate new Date() calls in moveEntry / resizeEntry: new Date(new Date(entry.startedAt).getTime() + shift) is hard to read. Extract a shiftInstant(iso: string, ms: number): string helper into the time domain module:
export function shiftInstant(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}
 Move goToToday's mobileDayIndex logic: The function both navigates and sets mobile state. After extracting MobileDayStrip, have the parent handle mobileDayIndex in a single onWeekChange handler so the two concerns don't bleed.
5. Reorganize file structure
components/week/
  WeekView.tsx          # ~130 lines — state + wiring + tree
  WeekViewHeader.tsx
  MobileDayStrip.tsx
  DayHeaderRow.tsx
  WeekGrid.tsx
  ZoomBar.tsx
  useZoom.ts            # zoom + scroll logic
  useWeekNavigation.ts # router navigation
  geometry.ts           # (already exists)
Co-locating everything in one folder keeps imports short (./ZoomBar, ./useZoom) and makes the feature boundary obvious.

## Fourth batch of changes
Audit of /timer, /dashboard, and the remaining /week files. Action items only; no code changed
yet. Each item names the file and the concrete extraction or fix. Priority roughly high to low
within a folder.

### /week — the files the third batch did not touch (DayColumn, EntryBlock, EntryPopover, DayTaskStrip)
1. Extract hooks from the three large components, the same way WeekView was unwound.

 useDragCreate(dayKey, segments, { onCreateRange, onStartTimerAt, nowMinutes }, pxPerMinute)
 in DayColumn.tsx. Owns the pointer-down/move/up ghost state, the CLICK_THRESHOLD_PX move
 gate, the touch double-tap tracking (lastTap / suppressDoubleClickUntil refs), and
 createIntentAt (the intentFromClick dispatch). Returns { ghost, pointerHandlers,
 onDoubleClick }. DayColumn becomes JSX plus the lane styling; ~80 lines of pointer logic
 leave the component. Note DayColumn already calls Date.now() for the touch tap timing, which
 is fine in a component but the hook should keep that boundary explicit.

 useEntryDrag(segment, { onMove, onResize }, pxPerMinute, snapMinutes, readOnly) in
 EntryBlock.tsx. Owns beginDrag, onPointerMove, endDrag, clampShift, the preview state, the
 suggestionsOpen ref, and the void Promise.resolve(settled).catch().finally() settle wait.
 Returns { preview, previewTop, previewBottom, previewDuration, dragHandlers, rangeLabel }.
 The memo wrapper stays; the hook holds the drag maths.

 useEntryForm(entry, tz) in EntryPopover.tsx. Owns the EntryFields state, the entryFields
 helper, keepEdit, the derived->form sync effect (the 7-field keepEdit merge), and the
 onDialChange / onStartTimeInput / onEndTimeInput / save handlers, plus dialStart, dialEnd,
 spanMinutes. Returns { form, edit, save, dialStart, dialEnd, spanMinutes }. EntryPopover
 becomes its JSX tree only, which is what makes a 328-line file readable.

2. Extract child components.

 CreateGhost (the ghost preview block in DayColumn, lines ~198-213). Self-contained: from,
 to, pxPerMinute. Removes one branch from DayColumn's return.

 TaskRow in DayTaskStrip.tsx (the per-task row, lines ~47-86). The row holds the project
 picker + start button and is the part that repeats; the strip just maps over tasks.

 EntryPopoverShell: the desktop/mobile Popover.Content branching in EntryBlock
 (lines ~251-299) wraps the same EntryPopover twice with different anchoring. Pulling the
 shell out leaves EntryBlock's return focused on the block itself.

3. Code smells.

 EntryBlock's `void Promise.resolve(settled).catch(() => {}).finally(() => setPreview(null))`
 has an empty catch. The comment says the mutation reports its own failure, which is true,
 but a named helper like `holdDragUntil(settled, done)` reads better than the inline promise
 dance and would be reused by the useEntryDrag extraction above.

 DayColumn's minutesAt takes a snapMinutes arg and reads columnRef each call; fine, but after
 useDragCreate the hook should own columnRef rather than the component passing it back in.

### /timer — RunningBar.tsx (244 lines, already split into RunningFields / PulseDot / StaleSchedulerBadge)
4. Extract a useCommitField hook.

 The description input and the start-time input in RunningFields duplicate the same pattern:
 capture the field on focus, commit on blur, Enter blurs, Escape resets to null and blurs.
 useCommitField(initial, { onCommit }) returns { value, onFocus, onChange, onBlur, onKeyDown
 } and removes ~30 lines of near-identical handlers. This is the RunningBar equivalent of
 useZoom: the one piece of logic worth lifting out.

### /dashboard — DashboardView + charts + Panel + chartTheme
6. Extract a RangePresets component.

 DashboardView lines ~77-92 build the segmented range selector inline (week / month /
 quarter / year). RangePresets({ value, onChange, presets }) is reused nowhere yet, but it
 is the one piece of DashboardView that is pure presentation and lets DashboardView shrink
 toward being a query+layout file, the way WeekView now is.

7. Move PanelSkeleton out of DashboardView into Panel.tsx.

 PanelSkeleton is a function in DashboardView that renders a Spinner in a Panel-sized box.
 It belongs with Panel, DataTable and ChartTooltip, which are the dashboard's shared shells.

8. Extract a WeekCountInput (or a clamped NumberInput) from HoursPerWeekChart.

 The weeks-count Input (lines ~60-75) carries its own Number.isFinite / 1..260 / Math.floor
 clamp. A small component that owns that clamp would let HoursPerWeekChart's controls prop be
 one element instead of a label+input+handler block.

9. Remove or justify the eslint-disable in ProjectDonut.

 ProjectDonut's useMemo (line ~38) carries `// eslint-disable-next-line
 react-hooks/exhaustive-deps` over a deps array that already lists `t`. The third batch's
 item 4 was exactly this kind of suppression; either the deps are complete and the disable is
 dead, or something the linter wants is missing. Verify and drop the suppression.
