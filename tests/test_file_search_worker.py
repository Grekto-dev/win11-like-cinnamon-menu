"""Real subprocess/SQLite/temp-tree tests; never index the user's files."""
import importlib.util
import json
import os
from pathlib import Path
import queue
import sqlite3
import subprocess
import tempfile
import threading
import time
import unittest

WORKER = Path(__file__).resolve().parents[1] / 'file-search-worker.py'


class Client:
    def __init__(self, root, db):
        self.p = subprocess.Popen(['/usr/bin/python3', '-u', str(WORKER),
                                   '--database', str(db), '--root', str(root)],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, text=True)
        self.events = queue.Queue()
        def read():
            for line in self.p.stdout:
                self.events.put(json.loads(line))
        self.reader = threading.Thread(target=read, daemon=True)
        self.reader.start()

    def send(self, **command):
        self.p.stdin.write(json.dumps(command) + '\n')
        self.p.stdin.flush()

    def until(self, predicate, timeout=8):
        found = []
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            try:
                event = self.events.get(timeout=min(.2, end-time.monotonic()))
            except queue.Empty:
                if self.p.poll() is not None:
                    raise AssertionError('worker exited: ' + self.p.stderr.read())
                continue
            found.append(event)
            if predicate(event):
                return found
        raise AssertionError('event timeout: ' + repr(found[-10:]))

    def search(self, query, id=1, limit=80):
        self.send(op='search', id=id, query=query, limit=limit)
        events = self.until(lambda e: e.get('type') == 'done' and e.get('id') == id)
        return [i for e in events if e.get('type') == 'results' and e.get('id') == id
                for i in e['items']], events

    def close(self):
        if self.p.poll() is None:
            self.send(op='shutdown')
            try:
                self.p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.p.kill()
                self.p.wait()
        self.reader.join(1)
        self.p.stdin.close()
        self.p.stdout.close()
        self.p.stderr.close()


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.root = self.base / 'tree'
        self.root.mkdir()
        self.db = self.base / 'private' / 'files.sqlite3'
        self.clients = []

    def tearDown(self):
        for client in self.clients:
            client.close()
        self.temp.cleanup()

    def client(self):
        client = Client(self.root, self.db)
        self.clients.append(client)
        return client

    def test_search_indexes_names_not_contents(self):
        (self.root / 'needle.txt').write_text('private secret content')
        client = self.client()
        items, events = client.search('needle')
        self.assertEqual([i['name'] for i in items], ['needle.txt'])
        self.assertEqual(items[0]['path'], str(self.root / 'needle.txt'))
        self.assertFalse(items[0]['is_dir'])
        self.assertFalse(events[-1]['indexing'])
        self.assertEqual(client.search('private secret', id=2)[0], [])

    def test_private_persistent_trigram_index_and_literal_matching(self):
        names = ['CAFÉ résumé.txt', '100%_"quote".txt', '東京 notes.txt',
                 '.hidden café.txt', 'not-a-match.txt']
        for name in names:
            (self.root / name).touch()
        client = self.client()
        self.assertEqual({i['name'] for i in client.search('cafe resume')[0]},
                         {'CAFÉ résumé.txt'})
        for number, query in enumerate(['%_', '"quote"', '東京', '.hidden'], 2):
            items, _ = client.search(query, id=number)
            self.assertEqual(len(items), 1)
        client.close()
        self.assertEqual(self.db.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.db.parent.stat().st_mode & 0o777, 0o700)
        with sqlite3.connect(self.db) as db:
            schema = db.execute("SELECT sql FROM sqlite_master WHERE name='names'").fetchone()
            self.assertIsNotNone(schema)
            self.assertIn('trigram', schema[0])
        self.assertEqual(len(self.client().search('resume')[0]), 1)

    def test_streams_batches_before_crawl_completes_with_bounded_limit(self):
        for number in range(6000):
            (self.root / ('needle-%05d.txt' % number)).touch()
        client = self.client()
        client.send(op='search', id=10, query='needle', limit=80)
        first = client.until(lambda e: e['type'] == 'results')[-1]
        self.assertLessEqual(len(first['items']), 16)
        self.assertFalse(any(e.get('type') == 'done' for e in [first]))
        # A query must report a live crawl, not just buffer until it finishes.
        events = client.until(lambda e: e['type'] == 'done')
        self.assertTrue(events[-1]['indexing'])
        self.assertTrue(events[-1]['truncated'])
        self.assertEqual(len(first['items']) + sum(len(e.get('items', [])) for e in events), 80)

    def test_protocol_validation_cancellation_empty_and_stale_isolation(self):
        for number in range(2500):
            (self.root / ('needle-%05d' % number)).touch()
        client = self.client()
        client.p.stdin.write('not json\n[]\n{"op":"search","id":true,"query":"x"}\n')
        client.p.stdin.flush()
        events = client.until(lambda e: e.get('type') == 'error')
        self.assertEqual(events[-1]['type'], 'error')
        client.send(op='search', id=21, query='needle', limit=80)
        client.until(lambda e: e.get('type') == 'results' and e.get('id') == 21)
        client.send(op='search', id=22, query='never-in-tree')
        events = client.until(lambda e: e.get('type') == 'done' and e.get('id') == 22)
        started = next(i for i,e in enumerate(events) if e.get('id') == 22)
        self.assertFalse(any(e.get('id') == 21 for e in events[started:]))
        self.assertFalse(any(e.get('type') == 'results' and e.get('id') == 22 for e in events))
        items, _ = client.search('', id=23)
        self.assertEqual(items, [])
        client.send(op='search', id=24, query='missing')
        client.send(op='cancel', id=999)  # must not cancel 24
        client.until(lambda e: e.get('type') == 'done' and e.get('id') == 24)
        client.send(op='cancel', id=24)
        client.close()
        self.assertEqual(client.p.returncode, 0)

    def test_safe_walk_hidden_cache_symlinks_and_malformed_names(self):
        (self.root / '.ordinary-hidden-needle').touch()
        (self.root / '.cache').mkdir()
        (self.root / '.cache' / 'cache-needle').touch()
        (self.root / 'node_modules').mkdir()
        (self.root / 'node_modules' / 'generated-needle').touch()
        (self.root / 'loop').symlink_to(self.root, target_is_directory=True)
        outside = self.base / 'outside'
        outside.mkdir()
        (outside / 'outside-needle').touch()
        (self.root / 'escape').symlink_to(outside, target_is_directory=True)
        bad = os.fsencode(self.root) + b'/bad-needle-\xff'
        fd = os.open(bad, os.O_CREAT | os.O_WRONLY, 0o600)
        os.close(fd)
        client = self.client()
        items, _ = client.search('needle')
        self.assertEqual({i['name'] for i in items},
                         {'.ordinary-hidden-needle', 'bad-needle-�'})
        malformed = next(i for i in items if i['name'].startswith('bad-'))
        self.assertEqual(os.fsencode(malformed['path']), bad)

    def test_deletion_rename_and_successful_rescan_prunes_index(self):
        folder = self.root / 'folder'
        folder.mkdir()
        old = folder / 'old-needle.txt'
        old.touch()
        client = self.client()
        self.assertEqual(len(client.search('old-needle')[0]), 1)
        old.rename(folder / 'new-needle.txt')
        # Missing rows must be filtered even before the next scan.
        self.assertEqual(client.search('old-needle', id=2)[0], [])
        client.close()
        second = self.client()
        self.assertEqual([i['name'] for i in second.search('needle')[0]], ['new-needle.txt'])
        with sqlite3.connect(self.db) as db:
            paths = {os.fsdecode(row[0]) for row in db.execute('SELECT path FROM entries')}
        self.assertNotIn(str(old), paths)
        second.close()
        (folder / 'new-needle.txt').unlink()
        folder.rmdir()
        self.assertEqual(self.client().search('needle')[0], [])
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM entries').fetchone()[0], 0)

    def test_mount_policy_rejects_network_fuse_virtual_and_defaults_order(self):
        spec = importlib.util.spec_from_file_location('filename_worker', WORKER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertTrue(hasattr(module, 'MountPolicy'), 'safe mount policy is required')
        lines = ['1 0 8:1 / / rw - ext4 /dev/a rw',
                 '2 1 8:2 / /mnt/local rw - ext4 /dev/b rw',
                 '3 1 0:1 / /mnt/network rw - nfs server:/share rw',
                 '4 1 0:2 / /home/test/cloud rw - fuse.sshfs ssh rw',
                 '5 1 0:3 / /media/space\\040disk rw - vfat /dev/c rw',
                 '6 1 0:4 / /mnt/auto rw - autofs auto rw']
        policy = module.MountPolicy(lines)
        for path in ['/proc/x', '/sys/x', '/dev/x', '/run/x', '/mnt/network/x',
                     '/home/test/cloud/x', '/mnt/auto/x']:
            self.assertFalse(policy.allowed(path), path)
        for path in ['/home/test/file', '/mnt/local/file', '/mnt/networkish/file',
                     '/media/space disk/file']:
            self.assertTrue(policy.allowed(path), path)
        roots = module.default_roots(policy, '/home/test')
        self.assertEqual(roots, ['/home/test', '/mnt/local', '/media/space disk', '/'])

    def test_query_planner_uses_trigram_or_bounded_literal_fallback(self):
        spec = importlib.util.spec_from_file_location('planner_worker', WORKER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertTrue(hasattr(module, 'candidates'), 'bounded query planner is required')
        with sqlite3.connect(':memory:') as db:
            db.execute('CREATE TABLE entries(path BLOB,name TEXT,norm TEXT,is_dir INT)')
            db.executemany('INSERT INTO entries VALUES (?,?,?,0)',
                           [(b'/fixture/' + str(i).encode(), 'café "%.txt', 'cafe "%.txt')
                            for i in range(9000)])
            rows, bounded = module.candidates(db, ['ca'])
            self.assertTrue(bounded)
            self.assertLessEqual(len(list(rows)), 8192)
            rows, bounded = module.candidates(db, ['cafe'])
            self.assertTrue(bounded)  # runtime without FTS has a safe fallback
            self.assertLessEqual(len(list(rows)), 8192)
            db.execute("CREATE VIRTUAL TABLE names USING fts5(norm, tokenize='trigram')")
            db.execute('INSERT INTO names(rowid,norm) SELECT rowid,norm FROM entries')
            statements = []
            db.set_trace_callback(statements.append)
            rows, bounded = module.candidates(db, ['cafe', '"%'])
            self.assertFalse(bounded)
            self.assertEqual(len(list(rows)), 8192)
            self.assertTrue(any('MATCH' in statement for statement in statements))

    def test_concurrent_readers_share_one_live_indexer(self):
        for number in range(5000):
            (self.root / ('shared-needle-%05d' % number)).touch()
        first = self.client()
        first.send(op='search', id=30, query='shared-needle', limit=1)
        first.until(lambda e: e['type'] == 'results')
        lockpath = str(self.db) + '.lock'
        self.assertTrue(os.path.isfile(lockpath), 'indexer must hold a process-shared lock')
        import fcntl
        with open(lockpath, 'a') as lock:
            with self.assertRaises(BlockingIOError):
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        second = self.client()
        items, events = second.search('shared-needle-04999', id=31)
        self.assertEqual(len(items), 1)
        self.assertFalse(events[-1]['indexing'])
        with sqlite3.connect(self.db) as db:
            state = dict(db.execute('SELECT key,value FROM metadata'))
        self.assertEqual(int(state['owner']), first.p.pid)
        self.assertEqual(int(state['scanned']), 5000)
        first.close()
        self.assertEqual(len(second.search('shared-needle-04999', id=32)[0]), 1)

    def test_corrupt_database_recovers_without_disclosing_file_contents(self):
        self.db.parent.mkdir()
        self.db.write_bytes(b'not a database PRIVATE-CONTENT')
        (self.root / 'recovery-needle').touch()
        client = self.client()
        items, events = client.search('recovery-needle')
        self.assertEqual([i['name'] for i in items], ['recovery-needle'])
        self.assertNotIn('PRIVATE-CONTENT', json.dumps(events))
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        client.close()
        self.assertEqual(client.p.returncode, 0)

    def test_local_ntfs_fuseblk_remains_eligible_but_remote_fuse_does_not(self):
        spec = importlib.util.spec_from_file_location('mount_worker', WORKER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        policy = module.MountPolicy([
            '1 0 8:1 / / rw - ext4 /dev/root rw',
            '2 1 8:2 / /media/pedro/HD\\040Externo rw - fuseblk /dev/sdb1 rw',
            '3 1 0:3 / /mnt/fake rw - fuseblk remote:share rw',
            '4 1 0:4 / /mnt/cloud rw - fuse.rclone cloud: rw'])
        self.assertTrue(policy.allowed('/media/pedro/HD Externo/Reference/café.jpg'))
        self.assertIn('/media/pedro/HD Externo', module.default_roots(policy, '/home/test'))
        self.assertFalse(policy.allowed('/mnt/fake/file'))
        self.assertFalse(policy.allowed('/mnt/cloud/file'))

    def test_explicit_root_cannot_follow_a_symlink_directory_ancestor(self):
        outside = self.base / 'outside'
        (outside / 'subdir').mkdir(parents=True)
        (outside / 'subdir' / 'escape-needle').touch()
        (self.root / 'link').symlink_to(outside, target_is_directory=True)
        client = Client(self.root / 'link' / 'subdir', self.db)
        self.clients.append(client)
        self.assertEqual(client.search('escape-needle')[0], [])

    def test_unwritable_database_parent_reports_error_but_stays_responsive(self):
        self.db.parent.write_text('not a directory')
        client = self.client()
        client.send(op='search', id=60, query='needle')
        events = client.until(lambda e: e.get('type') == 'error' and e.get('id') == 60)
        self.assertEqual(events[-1]['message'], 'Filename index unavailable')
        self.assertEqual(client.search('', id=61)[0], [])
        client.p.stdin.close()
        client.p.wait(timeout=2)
        self.assertEqual(client.p.returncode, 0)
        self.assertEqual(client.p.stderr.read(), '')

    def test_live_discoveries_continue_until_crawl_finishes_without_post_done_results(self):
        (self.root / 'early-needle').touch()
        bulk = self.root / 'bulk'
        bulk.mkdir()
        for number in range(3500):
            (bulk / ('filler-%05d' % number)).touch()
        deep = bulk / 'deep'
        deep.mkdir()
        (deep / 'late-needle').touch()
        client = self.client()
        client.send(op='search', id=70, query='needle')
        events = client.until(lambda e: e['type'] == 'results' and e['id'] == 70)
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute("SELECT value FROM metadata WHERE key='indexing'").fetchone()[0], '1')
        events += client.until(lambda e: e['type'] == 'done' and e['id'] == 70)
        results = [i['name'] for e in events for i in e.get('items', [])]
        self.assertEqual(set(results), {'early-needle', 'late-needle'})
        self.assertFalse(events[-1]['indexing'])
        time.sleep(.1)
        self.assertTrue(client.events.empty())

    def test_denied_directory_does_not_prune_unvisited_children(self):
        if os.geteuid() == 0:
            self.skipTest('root bypasses Unix directory permissions')
        folder = self.root / 'denied'
        folder.mkdir()
        child = folder / 'permission-needle'
        child.touch()
        first = self.client()
        self.assertEqual(len(first.search('permission-needle')[0]), 1)
        first.close()
        folder.chmod(0)
        try:
            second = self.client()
            self.assertEqual(second.search('permission-needle')[0], [])
            with sqlite3.connect(self.db) as db:
                self.assertIsNotNone(db.execute('SELECT path FROM entries WHERE path=?',
                                               (os.fsencode(child),)).fetchone())
        finally:
            folder.chmod(0o700)

    def test_punctuation_sql_fts_metacharacters_and_control_names_are_literal(self):
        names = ['quote" OR café %_.txt', 'emoji-🦊-résumé.txt', "a'b;DROP TABLE entries;--.txt",
                 'newline\nneedle.txt', 'literal*caret^colon:minus-.txt']
        for name in names:
            (self.root / name).touch()
        client = self.client()
        for number, query in enumerate(['quote" %_', '🦊 resume', "a'b;DROP", 'newline needle',
                                         '*caret^colon:minus-'], 80):
            items, _ = client.search(query, id=number)
            self.assertEqual(len(items), 1, query)
        self.assertEqual(client.search('" OR nonexistent', id=90)[0], [])
        self.assertEqual(client.search('\u0301', id=93)[0], [])
        self.assertEqual(len(client.search('q', id=91)[0]), 1)
        self.assertEqual(len(client.search('qu', id=92)[0]), 1)

    def test_unchanged_directories_are_reused_and_nested_changes_are_rescanned(self):
        from unittest.mock import patch
        spec = importlib.util.spec_from_file_location('incremental_directory_worker', WORKER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        nested = self.root / 'nested'
        nested.mkdir()
        (nested / 'existing-needle').touch()
        engine = module.Engine(str(self.db), [str(self.root)])
        try:
            self.assertTrue(engine.ready.wait(2))
            until = time.monotonic() + 2
            while engine.indexing and time.monotonic() < until:
                time.sleep(.01)
            self.assertFalse(engine.indexing)
            engine.stop.set()
            engine.thread.join(2)
            engine.stop.clear()
            with engine.prepare() as db:
                calls = []
                original_scandir = module.os.scandir
                def tracked_scandir(fd):
                    calls.append(os.readlink('/proc/self/fd/' + str(fd)))
                    return original_scandir(fd)
                with patch.object(module.os, 'scandir', tracked_scandir):
                    engine.scan(db)
                    self.assertEqual(calls, [], 'unchanged trees must not enumerate/rewrite every filename again')
                    (nested / 'new-needle').touch()
                    engine.scan(db)
                self.assertEqual(calls, [str(nested)], 'a changed descendant must be found even when root mtime is unchanged')
                self.assertEqual(db.execute('SELECT count(*) FROM entries WHERE name=?', ('new-needle',)).fetchone()[0], 1)
        finally:
            engine.stop.set()
            engine.thread.join(2)

    def test_short_query_reaches_matches_after_the_first_candidate_page(self):
        spec = importlib.util.spec_from_file_location('paged_worker', WORKER)
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        engine = module.Engine(str(self.db), [str(self.root)])
        events, finished = [], threading.Event()
        def collect(event, cancel=None):
            if cancel is None or not cancel.is_set():
                events.append(event)
                if event['type'] == 'done':
                    finished.set()
        engine.emit = collect
        try:
            self.assertTrue(engine.ready.wait(2))
            until = time.monotonic() + 2
            while engine.indexing and time.monotonic() < until:
                time.sleep(.01)
            target = self.root / 'only-zq-match.txt'
            target.touch()
            with sqlite3.connect(self.db) as db:
                db.executemany('INSERT INTO entries VALUES (?,?,?,?,?,?)',
                    [(os.fsencode(self.root / ('absent-%05d' % n)), 'filler-%05d' % n, 'filler-%05d' % n, 0,
                      os.fsencode(self.root), 1) for n in range(9000)])
                db.execute('INSERT INTO entries VALUES (?,?,?,?,?,?)',
                           (os.fsencode(target), target.name, target.name, 0, os.fsencode(self.root), 1))
            engine.search(333, 'zq', 80)
            self.assertTrue(finished.wait(3))
            self.assertEqual([i['name'] for e in events for i in e.get('items', [])], [target.name],
                             'bounded batches must continue through the index, not silently discard later filenames')
            self.assertFalse(events[-1]['truncated'])
        finally:
            engine.stop.set()
            if engine.active:
                engine.active[1].set()
            engine.thread.join(2)

    def test_periodic_incremental_rescan_discovers_additions_and_prunes_deletions(self):
        spec = importlib.util.spec_from_file_location('rescan_worker', WORKER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.RESCAN_SECONDS = .1
        (self.root / 'before-needle').touch()
        engine = module.Engine(str(self.db), [str(self.root)])
        def indexed(name):
            try:
                with sqlite3.connect(self.db) as db:
                    return db.execute('SELECT count(*) FROM entries WHERE name=?', (name,)).fetchone()[0]
            except sqlite3.Error:
                return 0
        try:
            end = time.monotonic() + 2
            while not indexed('before-needle') and time.monotonic() < end:
                time.sleep(.01)
            self.assertEqual(indexed('before-needle'), 1)
            (self.root / 'before-needle').unlink()
            (self.root / 'after-needle').touch()
            end = time.monotonic() + 1
            while not indexed('after-needle') and time.monotonic() < end:
                time.sleep(.01)
            self.assertEqual(indexed('after-needle'), 1)
            self.assertEqual(indexed('before-needle'), 0)
            with sqlite3.connect(self.db) as db:
                self.assertEqual(db.execute('SELECT count(*) FROM names').fetchone()[0],
                                 db.execute('SELECT count(*) FROM entries').fetchone()[0])
        finally:
            engine.stop.set()
            engine.thread.join(2)

    def test_query_budget_interrupt_finishes_instead_of_retrying_forever(self):
        import io
        from contextlib import redirect_stdout
        spec = importlib.util.spec_from_file_location('budget_worker', WORKER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.QUERY_SECONDS = 0
        for number in range(1200):
            (self.root / ('filler-%05d' % number)).touch()
        output = io.StringIO()
        with redirect_stdout(output):
            engine = module.Engine(str(self.db), [str(self.root)])
            try:
                end = time.monotonic() + 3
                while engine.indexing and time.monotonic() < end:
                    time.sleep(.01)
                engine.search(101, 'zz', 80)
                end = time.monotonic() + 1
                while '"type": "done"' not in output.getvalue() and time.monotonic() < end:
                    time.sleep(.01)
                events = [json.loads(line) for line in output.getvalue().splitlines()]
                done = [e for e in events if e['type'] == 'done']
                self.assertEqual(len(done), 1)
                self.assertTrue(done[0]['truncated'])
            finally:
                engine.stop.set()
                if engine.active:
                    engine.active[1].set()
                engine.thread.join(2)

    def test_malformed_unicode_query_reports_error_and_subsequent_search_works(self):
        (self.root / 'valid-needle').touch()
        client = self.client()
        client.send(op='search', id=110, query='bad-\udcff-string')
        events = client.until(lambda e: e.get('type') == 'error' and e.get('id') == 110)
        self.assertEqual(events[-1]['message'], 'Invalid command')
        self.assertEqual(len(client.search('valid-needle', id=111)[0]), 1)


    def test_indexing_throttle_bounds_duty_cycle(self):
        spec = importlib.util.spec_from_file_location('throttle_worker', WORKER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertTrue(hasattr(module, 'throttle_delay'), 'indexing needs a CPU duty-cycle budget')
        self.assertEqual(module.throttle_delay(.001), .005)
        self.assertAlmostEqual(module.throttle_delay(.02), .04)
        self.assertGreaterEqual(module.throttle_delay(.1), .2)


    def test_active_changed_query_never_emits_old_id_after_new_status(self):
        (self.root / 'early-needle').touch()
        bulk = self.root / 'bulk'
        bulk.mkdir()
        for number in range(4000):
            (bulk / ('filler-%05d' % number)).touch()
        (bulk / 'deep').mkdir()
        (bulk / 'deep' / 'late-needle').touch()
        client = self.client()
        client.send(op='search', id=120, query='needle')
        client.until(lambda e: e['type'] == 'results' and e['id'] == 120)
        client.send(op='search', id=121, query='late-needle')
        client.until(lambda e: e['type'] == 'status' and e['id'] == 121)
        events = client.until(lambda e: e['type'] == 'done' and e['id'] == 121)
        self.assertFalse(any(e.get('id') == 120 for e in events), events)
        self.assertEqual([i['name'] for e in events for i in e.get('items', [])], ['late-needle'])

    def test_explicit_cancel_stops_active_query_without_replacement_search(self):
        (self.root / 'early-needle').touch()
        bulk = self.root / 'bulk'
        bulk.mkdir()
        for number in range(4000):
            (bulk / ('filler-%05d' % number)).touch()
        client = self.client()
        client.send(op='search', id=122, query='needle')
        client.until(lambda e: e['type'] == 'results' and e['id'] == 122)
        client.send(op='cancel', id=122)
        client.send(op='invalid', id=123)  # non-search barrier; must not replace/cancel
        client.until(lambda e: e['type'] == 'error' and e['id'] == 123)
        end = time.monotonic() + 5
        while time.monotonic() < end:
            with sqlite3.connect(self.db) as db:
                indexing = db.execute("SELECT value FROM metadata WHERE key='indexing'").fetchone()[0]
            if indexing == '0':
                break
            time.sleep(.02)
        self.assertEqual(indexing, '0')
        time.sleep(.1)
        remaining = []
        while not client.events.empty():
            remaining.append(client.events.get_nowait())
        self.assertFalse(any(e.get('id') == 122 for e in remaining), remaining)


    def test_database_symlink_is_rejected_without_modifying_its_target(self):
        self.db.parent.mkdir()
        target = self.base / 'protected'
        target.write_text('PRIVATE-CONTENT')
        target.chmod(0o640)
        self.db.symlink_to(target)
        (self.root / 'needle').touch()
        client = self.client()
        items, events = client.search('needle')
        self.assertEqual(items, [])
        self.assertTrue(any(e['type'] == 'error' for e in events))
        self.assertEqual(target.stat().st_mode & 0o777, 0o640)
        self.assertEqual(target.read_text(), 'PRIVATE-CONTENT')


def benchmark():
    """Reproducible real-filesystem benchmark, opt-in; temp tree only."""
    import resource
    import statistics
    report = {'python': '/usr/bin/python3', 'sqlite': sqlite3.sqlite_version,
              'fixture_files': 50001, 'fixture_directories': 50}
    with tempfile.TemporaryDirectory(prefix='filename-benchmark-') as temp:
        base = Path(temp)
        root, database = base / 'tree', base / 'private' / 'names.sqlite'
        root.mkdir()
        (root / 'reference-early-café_100%.png').touch()
        for group in range(50):
            folder = root / ('album-%03d' % group)
            folder.mkdir()
            for number in range(1000):
                (folder / ('reference-%03d-%05d-café_100%%.png' % (group, number))).touch()
        client = Client(root, database)
        usage_before = resource.getrusage(resource.RUSAGE_CHILDREN)
        started = time.monotonic()
        try:
            client.send(op='search', id=1, query='reference')
            client.until(lambda e: e['type'] == 'results', timeout=60)
            report['cold_first_result_ms'] = (time.monotonic() - started) * 1000
            client.send(op='search', id=2, query='nonexistent-crawl-completion-probe')
            client.until(lambda e: e['type'] == 'done' and e['id'] == 2, timeout=60)
            report['initial_crawl_seconds'] = time.monotonic() - started
            with sqlite3.connect(database) as db:
                report['indexed_entries'] = db.execute('SELECT count(*) FROM entries').fetchone()[0]
                sql = ('SELECT e.path,e.name,e.norm,e.is_dir FROM names JOIN entries e '
                       'ON e.rowid=names.rowid WHERE names MATCH ? LIMIT 8192')
                report['explain_query_plan'] = db.execute('EXPLAIN QUERY PLAN ' + sql,
                    ('"reference-049-00999-cafe_100%"',)).fetchall()
                raw = []
                for _ in range(30):
                    begin = time.monotonic()
                    self_rows = db.execute(sql, ('"reference-049-00999-cafe_100%"',)).fetchall()
                    assert len(self_rows) == 1
                    raw.append((time.monotonic() - begin) * 1000)
                report['sqlite_literal_match_median_ms'] = statistics.median(raw)
            timings = []
            for id in range(10, 40):
                begin = time.monotonic()
                items, _ = client.search('reference-049-00999-cafe_100%', id=id)
                assert len(items) == 1
                timings.append((time.monotonic() - begin) * 1000)
            report['warm_query_median_ms'] = statistics.median(timings)
            report['warm_query_p95_ms'] = sorted(timings)[int(.95 * (len(timings)-1))]
            begin = time.monotonic()
            client.search('zz', id=50)
            report['short_absent_query_ms'] = (time.monotonic() - begin) * 1000
            begin = time.monotonic()
            for id in range(60, 90):
                client.send(op='search', id=id, query='reference-zzzz-' + str(id))
            client.send(op='search', id=90, query='reference-049-00999-cafe_100%')
            client.until(lambda e: e['type'] == 'done' and e['id'] == 90)
            report['thirty_query_burst_to_latest_done_ms'] = (time.monotonic() - begin) * 1000
            with open('/proc/%d/status' % client.p.pid) as status:
                report['worker_peak_rss_kib'] = next(int(line.split()[1]) for line in status
                                                     if line.startswith('VmHWM:'))
            report['database_bytes'] = sum(path.stat().st_size for path in database.parent.iterdir())
        finally:
            client.close()
        usage_after = resource.getrusage(resource.RUSAGE_CHILDREN)
        report['worker_cpu_seconds'] = (usage_after.ru_utime + usage_after.ru_stime -
                                       usage_before.ru_utime - usage_before.ru_stime)
        begin = time.monotonic()
        warm = Client(root, database)
        try:
            warm.send(op='search', id=100, query='reference-049-00999-cafe_100%')
            warm.until(lambda e: e['type'] == 'results' and e['id'] == 100)
            report['persisted_restart_first_result_ms'] = (time.monotonic() - begin) * 1000
        finally:
            warm.close()
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    import sys
    if '--benchmark' in sys.argv:
        benchmark()
    else:
        unittest.main()
