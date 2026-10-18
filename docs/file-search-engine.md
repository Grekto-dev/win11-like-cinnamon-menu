# Local filename search and recent files

## Architecture and UI lifecycle

- Opening the menu does **not** start the search worker or scan the filesystem. Application/settings matching stays in Cinnamon. Recent-file views read a cached snapshot.
- The first nonempty query in **All** or **Files** schedules a lazy `FileSearchClient` from an idle callback. `/usr/bin/python3 -u file-search-worker.py` runs separately from Cinnamon; stdin writes and stdout reads are asynchronous. No shell command string is constructed from a query or filename.
- The worker streams its first match immediately and subsequent matches in batches, including discoveries from an unfinished initial crawl. The UI appends up to eight rows per idle batch rather than rebuilding the list. Existing keyboard selection is not reset.
- Query generations suppress stale worker and Cinnamon-provider callbacks. Changing the filter, clearing the query, closing the menu or destroying the applet cancels old delivery and queued row construction. The IPC transport is bounded and teardown has an asynchronous, bounded force-exit fallback.
- At most **80 filesystem results** are displayed for one query. Narrow the query when this limit is reached. A per-page SQLite execution budget can also yield a partial result; the UI reports that the search was limited. This is not a claim that all possible matches have been listed.

## Scope and privacy

Search matches **basenames**, not file contents. All whitespace-separated terms must occur literally in the normalized name; case and diacritics are ignored. Quotes, percent signs, underscores and FTS/SQL punctuation are not executable query syntax. Files and directories are supported; directory symlinks are not traversed, including symlink ancestors of an explicit root.

Default traversal order is the user's home, eligible mounted local media under `/media` and `/mnt`, then `/`. Only locations accessible with the current user's permissions are visited; there is no `sudo` or permission escalation. `/proc/self/mountinfo` is read only to classify mounts, never traversed. `/proc`, `/sys`, `/dev`, `/run`, unknown/network/autofs/remote-FUSE mounts are excluded. Local NTFS `fuseblk` mounts backed by `/dev/...` remain eligible.

Ordinary hidden names are included, but generated/cache directory names are skipped: `.cache`, `.git`, `.hg`, `.svn`, `node_modules`, `__pycache__`, `.venv`, `venv`, `.npm`, `.cargo`, `.rustup`, `.gradle`, `.Trash`, `lost+found`. Consequently “computer-wide” means the accessible, eligible local filesystem, not every virtual, remote, generated or forbidden location.

The persistent index contains paths, names and directory metadata only, at `~/.cache/win11-menu/file-search/names.sqlite`. Its dedicated directory is mode `0700`; index/lock files are `0600`. It stays local and is not uploaded. Keep it out of backups/shared locations if filenames themselves are sensitive. It can be removed while the worker is stopped to force rebuilding.

## Index and responsiveness

SQLite FTS5's trigram tokenizer accelerates normalized substrings of three or more characters. Tokens are quoted as literal FTS phrases, followed by an explicit all-token substring check. Short queries and SQLite builds without trigram support use resumable 8,192-row pages: later pages are searched, not silently discarded. Each SQLite page has an 80 ms execution budget and obsolete queries are interrupted. Status events distinguish indexing from completed lookup; no final `done` is followed by further results for that query.

One process owns indexing through a nonblocking `flock`, while other applet instances can read the shared WAL database and committed discoveries. The crawler commits bounded batches, lowers its indexing-thread priority, and yields roughly twice the CPU time it spends in each batch. It does not run a recursive scan inside Cinnamon.

Every 30 seconds the active indexer checks directories again. Persisted device/inode/mtime/ctime stamps avoid enumerating or rewriting the files of unchanged directories; cached child-directory paths are still visited so deeper changes are found. Only successfully enumerated directories authorize stale-entry deletion. Removed/unreadable paths are also filtered before being returned. Updates are therefore eventual, not instantaneous filesystem notifications; newly mounted locations are discovered when an eligible root is revisited or the worker restarts.

## Recent-file history is separate

`recentFiles.js` reads GTK's recent-history metadata in a deferred refresh and validates local URIs through bounded asynchronous Gio requests. It uses `Gtk.RecentInfo.get_modified()` in Unix seconds: this is the history record's timestamp, **not the file's on-disk modification time**. Missing, private, hidden, remote, unreadable and duplicate entries are excluded. Results are merged with actual app-launch history newest-first; no filler apps are invented.

Cinnamon's `remember-recent-files` privacy preference and the applet's recent-files switch gate all history-derived snapshots. Disabling either also immediately removes history-only rows, previews and actions from an already-open search; same-URI results independently obtained from favorites or the filesystem stay available without restarting the scan. Retained row actors, selection and preview are preserved. Old Recent/All Recents/Search Home context menus are revoked as well. Removing an entry removes only its GTK history bookmark, never the file. General filesystem search does not depend on remembering recent files.

## Protocol and reproducible checks

```text
/usr/bin/python3 -u file-search-worker.py --database PRIVATE_DB --root FIXTURE_ROOT
stdin:  {"op":"search","id":1,"query":"relatorio anual","limit":80}
        {"op":"cancel","id":1}
        {"op":"shutdown"}
stdout: status / results / done / error JSON lines carrying the query id
```

```bash
node --test tests/*.test.js
/usr/bin/python3 -m unittest discover -s tests -p 'test_*.py'
/usr/bin/python3 tests/test_file_search_worker.py --benchmark
```

Fixture tests cover streaming before crawl completion, literal punctuation/Unicode, permissions, symlink cycles, cancellation and stale IDs, incremental rescans, corrupt-index recovery, concurrent applet readers, private modes, and searching past the first short-query page. No real user tree is indexed by the test suite; GTK/Gio history fixtures are isolated from the user's history.

### Measured fixture benchmark

One actual local run under `/usr/bin/python3`, SQLite **3.45.1**, with **50,001 files + 50 directories** (empty content fixtures, not the user's files):

| Measurement | Observed |
|---|---:|
| First result from a new worker/index | 92.5 ms |
| Complete initial crawl of 50,051 entries | 10.23 s |
| Warm query median / p95, 30 samples | 2.29 / 2.86 ms |
| Absent short query over the index | 110.7 ms |
| Burst of 30 replaced queries → latest done | 10.3 ms |
| First result after reopening persisted index | 31.9 ms |
| Worker peak RSS | 21,344 KiB |
| Index and associated files | 35,377,152 bytes |

The query plan used a trigram virtual-table index and primary-key row lookups. These measurements describe this fixture and machine, not a guarantee for millions of files, other disks or the first complete computer-wide crawl. UI/Cinnamon painting adds latency beyond worker timings. Live menu measurements and integration validation are documented separately in `layout-and-performance.md`.
