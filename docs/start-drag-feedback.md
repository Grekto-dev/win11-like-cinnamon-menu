# Start menu drag-over feedback (Windows 11 reference)

Behaviour of the pinned grid while an app is dragged over another tile, measured on a Windows 11 VM
(1440x900, 96 DPI) with QEMU-injected input and a ~18 fps frame recorder. Timings are approximations of
the recording rate (frames about 55 ms apart), not exact Windows curves.

## App dragged over another app (merge preview)
- The dragged icon stays full size at the pointer.
- When the pointer is inside the target's merge zone, the target:
  - fades its label out (~100 ms),
  - shrinks its icon from 32 px to ~16 px into the **top-left cell** of a dark rounded plate,
  - fades the plate in: 38x38 px, ~8 px corner radius, slightly lighter than the menu background (the same plate a
    folder uses).
- Whole preview: about 150-300 ms, ease-out.
- On drop the dragged icon disappears and the new folder fades in at the target's slot.

## App dragged over a folder
- The folder's plate shrinks from 38 px to ~30 px (x0.78) about its centre in ~200 ms, ease-out. The folder label does not move or fade.
- On drop the dragged icon disappears, the plate grows back to full size, the new mini icon fills the next cell and the grid reflows.

## Not an effect on Windows
- A folder dragged over an app does not merge.
- A folder with no apps left dissolves.

## How the applet reproduces it
`PinnedTile.setFolderDropTarget(on)` (called by the grid after the existing hover dwell) runs the two effects through
`applet._animateActor`, so they honour the menu's animation option.

- App target: the icon is hosted in a lazily built overlay (`St.Widget` + `Clutter.BinLayout`) with the plate behind it.
  The icon's scale and translation are derived from `_folderPreviewMetrics()`, the same numbers
  `_buildFolderMiniIcon()` uses, so it lands exactly on the first cell of the folder that a drop would create
  (verified on the live shell to within 0.6 px at the default size).
- Folder target: the plate scales to `DROP_FEEDBACK.folderScale` about its centre.
- After a drop `_mergeAppIntoPinnedTarget()` records `_dropSettle`; the next `_refreshPinnedSection()` plays
  `PinnedTile.playDropSettle()` once on that tile (fade-in for a new folder, grow-back for an appended one).

The merge zone and the 300 ms dwell are unchanged. When a merge is dropped, the target keeps its merged look
(`_dropFeedbackHold`) until the commit has rebuilt the grid, so it does not start to un-merge before the new folder
fades in.
