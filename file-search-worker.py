#!/usr/bin/python3
"""Private filename-only JSONL search worker (no third-party dependencies)."""
import argparse
from contextlib import contextmanager
import fcntl
import json
import os
import re
from pathlib import Path
import sqlite3
import sys
import threading
import time
import unicodedata

RESCAN_SECONDS = 30
QUERY_SECONDS = .08


def normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', text.casefold())
                   if not unicodedata.combining(c))


def below(path, parent):
    return path == parent or path.startswith(parent.rstrip('/') + '/')


def throttle_delay(cpu_seconds):
    """Yield twice the indexing CPU time (at most ~1/3 of one core)."""
    return max(.005, cpu_seconds * 2)


class MountPolicy:
    LOCAL = {'ext2', 'ext3', 'ext4', 'btrfs', 'xfs', 'zfs', 'vfat', 'exfat',
             'ntfs', 'ntfs3', 'overlay', 'tmpfs', 'ramfs', 'squashfs', 'iso9660', 'udf'}

    def __init__(self, lines=None):
        if lines is None:
            try:
                # Metadata only: never traverse these virtual filesystems.
                with open('/proc/self/mountinfo', encoding='utf-8', errors='replace') as file:
                    lines = file.readlines()
            except OSError:
                lines = []
        self.mounts = []
        for line in lines:
            try:
                left, right = line.split(' - ', 1)
                mount = re.sub(r'\\([0-7]{3})', lambda m: chr(int(m[1], 8)), left.split()[4])
                fields = right.split()
                safe = fields[0] in self.LOCAL or (fields[0] == 'fuseblk' and
                                                   fields[1].startswith('/dev/'))
                self.mounts.append((mount, safe))
            except (ValueError, IndexError):
                continue
        self.mounts.sort(key=lambda item: len(item[0]), reverse=True)

    def allowed(self, path):
        path = os.path.abspath(os.fsdecode(path))
        if any(below(path, root) for root in ('/proc', '/sys', '/dev', '/run')):
            return False
        return next((safe for mount, safe in self.mounts if below(path, mount)), False)


def default_roots(policy, home=None):
    home = home or str(Path.home())
    media = [mount for mount, safe in reversed(policy.mounts) if safe and
             any(below(mount, root) for root in ('/media', '/mnt'))]
    return list(dict.fromkeys([home] + media + ['/']))


@contextmanager
def open_directory(path, policy, create=False):
    """Open each component without following symlinks (including ancestors)."""
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    fd = os.open('/', flags)
    current = ''
    try:
        for part in os.path.abspath(path).split('/'):
            if not part:
                continue
            current += '/' + part
            if not policy.allowed(current):
                raise PermissionError('Excluded mount')
            try:
                child = os.open(part, flags, dir_fd=fd)
            except FileNotFoundError:
                if not create:
                    raise
                try:
                    os.mkdir(part, 0o700, dir_fd=fd)
                except FileExistsError:
                    pass  # another applet may have created this component
                child = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = child
        yield fd
    finally:
        os.close(fd)


def present(path, policy):
    try:
        path = os.fsdecode(path)
        with open_directory(os.path.dirname(path), policy) as fd:
            os.stat(os.path.basename(path), dir_fd=fd, follow_symlinks=False)
        return True
    except OSError:
        return False


def candidates(connection, tokens, after_rowid=0, include_rowid=False):
    """Quoted trigram candidates, or literal fallback, in bounded resumable pages."""
    phrases = ['"' + token.replace('"', '""') + '"' for token in tokens if len(token) >= 3]
    prefix = 'names.rowid,' if include_rowid else ''
    if phrases:
        try:
            return connection.execute('SELECT ' + prefix + 'e.path,e.name,e.norm,e.is_dir FROM names '
                'JOIN entries e ON e.rowid=names.rowid WHERE names MATCH ? AND names.rowid>? '
                'ORDER BY names.rowid LIMIT 8192', (' AND '.join(phrases), after_rowid)), False
        except sqlite3.OperationalError as error:
            if 'no such' not in str(error):
                raise
    prefix = 'rowid,' if include_rowid else ''
    return connection.execute('SELECT ' + prefix + 'path,name,norm,is_dir FROM entries '
                              'WHERE rowid>? ORDER BY rowid LIMIT 8192', (after_rowid,)), True


class Engine:
    def __init__(self, database, roots):
        self.database, self.roots = os.path.abspath(database), roots
        self.policy = MountPolicy()
        self.lock = threading.RLock()
        self.stop = threading.Event()
        self.active = None
        self.indexing, self.scanned = True, 0
        self.ready = threading.Event()
        self.owns_indexer = False
        self.failure = None
        self.thread = threading.Thread(target=self.index_loop, daemon=True)
        self.thread.start()

    def emit(self, event, cancel=None):
        with self.lock:
            if cancel is None or not cancel.is_set():
                print(json.dumps(event, ensure_ascii=True), flush=True)

    def connect(self):
        try:
            with open_directory(os.path.dirname(self.database), self.policy):
                if os.path.islink(self.database):
                    raise PermissionError('Symlink database')
        except OSError:
            raise sqlite3.OperationalError('Filename index unavailable') from None
        return sqlite3.connect(self.database, timeout=.2)

    def index_loop(self):
        try:
            self._index_loop()
        except (OSError, sqlite3.Error):
            self.failure = 'Filename index unavailable'
            self.indexing = False
            self.ready.set()

    def _index_loop(self):
        os.umask(0o077)
        try:
            os.nice(10)  # indexing thread only; queries keep normal priority
        except OSError:
            pass
        with open_directory(os.path.dirname(self.database), self.policy, create=True) as directory_fd:
            os.fchmod(directory_fd, 0o700)
        fd = os.open(self.database + '.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        os.fchmod(fd, 0o600)
        try:
            while not self.stop.is_set():
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    self.owns_indexer = True
                    break
                except BlockingIOError:
                    self.ready.set()
                    self.stop.wait(.2)
            if self.stop.is_set():
                return
            recoveries = 0
            while not self.stop.is_set():
                self.indexing, self.scanned = True, 0
                connection = None
                try:
                    connection = self.prepare()
                    self.write_state(connection)
                    connection.commit()
                    self.ready.set()
                    self.scan(connection)
                    recoveries = 0
                except sqlite3.DatabaseError as error:
                    if connection:
                        connection.close()
                        connection = None
                    code = getattr(error, 'sqlite_errorcode', 0) & 255
                    if code in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):
                        self.stop.wait(.2)
                        continue
                    if code not in (sqlite3.SQLITE_CORRUPT, sqlite3.SQLITE_NOTADB,
                                    sqlite3.SQLITE_SCHEMA, sqlite3.SQLITE_ERROR) or recoveries >= 2:
                        self.failure = 'Filename index unavailable'
                        self.indexing = False
                        return
                    # Only the flock owner may quarantine/rebuild. Readers reopen
                    # each polling cycle, so no process continues using an old DB.
                    suffix = '.corrupt-' + str(time.time_ns())
                    for ending in ('', '-wal', '-shm'):
                        try:
                            source = self.database + ending
                            os.chmod(source, 0o600)
                            os.replace(source, self.database + suffix + ending)
                        except FileNotFoundError:
                            pass
                    recoveries += 1
                    continue
                finally:
                    if connection:
                        connection.close()
                self.stop.wait(RESCAN_SECONDS)
        finally:
            os.close(fd)

    def write_state(self, connection):
        connection.executemany('INSERT OR REPLACE INTO metadata VALUES (?,?)',
            [('indexing', str(int(self.indexing))), ('scanned', str(self.scanned)),
             ('owner', str(os.getpid()))])

    def refresh_state(self, connection):
        if self.ready.is_set() and not self.owns_indexer:
            state = dict(connection.execute('SELECT key,value FROM metadata'))
            self.indexing = state.get('indexing', '1') == '1'
            self.scanned = int(state.get('scanned', 0))

    def prepare(self):
        connection = self.connect()
        os.chmod(self.database, 0o600)
        connection.execute('PRAGMA journal_mode=WAL')
        connection.execute('CREATE TABLE IF NOT EXISTS entries '
                           '(path BLOB PRIMARY KEY, name TEXT, norm TEXT, is_dir INT, '
                           'parent BLOB, seen INTEGER)')
        connection.execute('CREATE INDEX IF NOT EXISTS entries_parent ON entries(parent)')
        connection.execute('CREATE TABLE IF NOT EXISTS directory_stamps(path BLOB PRIMARY KEY,stamp TEXT)')
        connection.execute('CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT)')
        try:
            connection.execute("CREATE VIRTUAL TABLE IF NOT EXISTS names USING fts5(norm, tokenize='trigram')")
            connection.executescript('''
                CREATE TRIGGER IF NOT EXISTS entries_insert AFTER INSERT ON entries BEGIN
                  INSERT INTO names(rowid,norm) VALUES (new.rowid,new.norm); END;
                CREATE TRIGGER IF NOT EXISTS entries_delete AFTER DELETE ON entries BEGIN
                  DELETE FROM names WHERE rowid=old.rowid; END;
                CREATE TRIGGER IF NOT EXISTS entries_update AFTER UPDATE ON entries
                WHEN old.norm IS NOT new.norm BEGIN
                  DELETE FROM names WHERE rowid=old.rowid;
                  INSERT INTO names(rowid,norm) VALUES (new.rowid,new.norm); END;
            ''')
        except sqlite3.OperationalError:
            pass
        connection.commit()
        return connection

    def scan(self, connection):
        self.policy = MountPolicy()
        policy_checked = time.monotonic()
        batch_cpu = time.thread_time()
        generation = time.time_ns()
        visited = set()
        excluded = {'.cache', '.git', '.hg', '.svn', 'node_modules', '__pycache__',
                    '.venv', 'venv', '.npm', '.cargo', '.rustup', '.gradle',
                    '.Trash', 'lost+found'}
        for root in self.roots:
            stack = [os.path.abspath(root)]
            while stack and not self.stop.is_set():
                parent = stack.pop()
                if parent in visited or not self.policy.allowed(parent):
                    continue
                visited.add(parent)
                try:
                    with open_directory(parent, self.policy) as directory_fd:
                        stat = os.fstat(directory_fd)
                        stamp = f'{stat.st_dev}:{stat.st_ino}:{stat.st_mtime_ns}:{stat.st_ctime_ns}'
                        saved = connection.execute('SELECT stamp FROM directory_stamps WHERE path=?',
                                                   (os.fsencode(parent),)).fetchone()
                        if saved and saved[0] == stamp:
                            # An unchanged parent does not imply unchanged descendants. Visit
                            # cached child directories without re-enumerating all their files.
                            stack.extend(os.fsdecode(row[0]) for row in connection.execute(
                                'SELECT path FROM entries WHERE parent=? AND is_dir=1',
                                (os.fsencode(parent),)))
                            if len(visited) % 128 == 0:
                                self.stop.wait(throttle_delay(time.thread_time() - batch_cpu))
                                batch_cpu = time.thread_time()
                            continue
                        with os.scandir(directory_fd) as entries:
                            for entry in entries:
                                if self.stop.is_set():
                                    break
                                entry_path = os.path.join(parent, entry.name)
                                if entry.name in excluded or not self.policy.allowed(entry_path):
                                    continue
                                try:
                                    is_dir = entry.is_dir(follow_symlinks=False)
                                except OSError:
                                    continue
                                path = os.fsencode(entry_path)
                                name = os.fsencode(entry.name).decode('utf-8', 'replace')
                                connection.execute('INSERT INTO entries VALUES (?,?,?,?,?,?) '
                                    'ON CONFLICT(path) DO UPDATE SET name=excluded.name, '
                                    'norm=excluded.norm,is_dir=excluded.is_dir, '
                                    'parent=excluded.parent,seen=excluded.seen',
                                    (path, name, normalize(name), int(is_dir), os.fsencode(parent), generation))
                                if is_dir:
                                    stack.append(entry_path)
                                self.scanned += 1
                                if self.scanned % 128 == 0:
                                    if time.monotonic() - policy_checked > 1:
                                        self.policy = MountPolicy()
                                        policy_checked = time.monotonic()
                                    self.write_state(connection)
                                    connection.commit()
                                    self.stop.wait(throttle_delay(time.thread_time() - batch_cpu))
                                    batch_cpu = time.thread_time()
                        if not self.stop.is_set():
                            # Only a successfully exhausted directory authorizes deletions.
                            stale = connection.execute('SELECT path,is_dir FROM entries '
                                'WHERE parent=? AND seen<>?', (os.fsencode(parent), generation)).fetchall()
                            for path, is_dir in stale:
                                connection.execute('DELETE FROM entries WHERE path=?', (path,))
                                if is_dir:
                                    prefix = path + b'/'
                                    connection.execute('DELETE FROM entries WHERE substr(path,1,?)=?',
                                                       (len(prefix), prefix))
                                    connection.execute('DELETE FROM directory_stamps WHERE path=? OR substr(path,1,?)=?',
                                                       (path, len(prefix), prefix))
                            final = os.fstat(directory_fd)
                            final_stamp = f'{final.st_dev}:{final.st_ino}:{final.st_mtime_ns}:{final.st_ctime_ns}'
                            if final_stamp == stamp:
                                connection.execute('INSERT OR REPLACE INTO directory_stamps VALUES (?,?)',
                                                   (os.fsencode(parent), stamp))
                            else:
                                # The tree changed during enumeration; do not cache an incomplete view.
                                connection.execute('DELETE FROM directory_stamps WHERE path=?', (os.fsencode(parent),))
                        connection.commit()
                except OSError:
                    continue
        self.write_state(connection)
        connection.execute("UPDATE metadata SET value='0' WHERE key='indexing'")
        connection.commit()
        self.indexing = False  # only after the final rows are visible to readers

    def search(self, id, query, limit):
        with self.lock:
            if self.active:
                self.active[1].set()
            cancel = threading.Event()
            self.active = (id, cancel)
            self.emit(dict(type='status', id=id, indexing=self.indexing, scanned=self.scanned), cancel)
            if not normalize(query).split():
                self.emit(dict(type='done', id=id, truncated=False, indexing=self.indexing), cancel)
                return
        def run():
            self.policy = MountPolicy()
            seen = set()
            tokens = normalize(query).split()
            last_status = 0
            last_rowid = 0
            was_indexing = self.indexing
            while not cancel.is_set() and not self.stop.is_set():
                if self.failure:
                    self.emit(dict(type='error', id=id, message=self.failure), cancel)
                    self.emit(dict(type='done', id=id, truncated=True, indexing=False), cancel)
                    return
                connection = None
                items = []
                page_full = False
                try:
                    connection = self.connect()
                    deadline = time.monotonic() + QUERY_SECONDS
                    connection.set_progress_handler(
                        lambda: int(cancel.is_set() or self.stop.is_set() or time.monotonic() > deadline), 2000)
                    # Read shared progress before taking the candidate snapshot.
                    self.refresh_state(connection)
                    indexing = self.indexing
                    if was_indexing and not indexing:
                        # Final pass catches rows updated or rowids reused during the crawl.
                        last_rowid = 0
                    was_indexing = indexing
                    rows, bounded = candidates(connection, tokens, last_rowid, include_rowid=True)
                    items, inspected = [], 0
                    for rowid, path, name, norm, is_dir in rows:
                        last_rowid = rowid
                        if cancel.is_set() or self.stop.is_set():
                            return
                        inspected += 1
                        if (path not in seen and all(t in norm for t in tokens)
                                and self.policy.allowed(path) and present(path, self.policy)):
                            seen.add(path)
                            items.append(dict(path=os.fsdecode(path), name=name,
                                              is_dir=bool(is_dir)))
                            if len(items) == (1 if len(seen) == 1 else 16):
                                self.emit(dict(type='results', id=id, items=items), cancel)
                                items = []
                            if len(seen) >= limit:
                                break
                    if items:
                        self.emit(dict(type='results', id=id, items=items), cancel)
                    page_full = inspected >= 8192
                    if (not indexing and not page_full) or len(seen) >= limit:
                        self.emit(dict(type='done', id=id,
                            truncated=len(seen) >= limit,
                            indexing=self.indexing), cancel)
                        return
                    if not page_full:
                        last_rowid = 0
                    if time.monotonic() - last_status >= .5:
                        self.emit(dict(type='status', id=id, indexing=self.indexing,
                                       scanned=self.scanned), cancel)
                        last_status = time.monotonic()
                except sqlite3.Error as error:
                    if cancel.is_set() or self.stop.is_set():
                        return
                    if getattr(error, 'sqlite_errorcode', 0) == sqlite3.SQLITE_INTERRUPT:
                        if items:
                            self.emit(dict(type='results', id=id, items=items), cancel)
                        self.emit(dict(type='done', id=id, truncated=True,
                                       indexing=self.indexing), cancel)
                        return
                finally:
                    if connection:
                        connection.close()
                cancel.wait(.005 if page_full else .06)
        threading.Thread(target=run, daemon=True).start()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--database', default=str(Path.home() / '.cache/win11-menu/file-search/names.sqlite'))
    parser.add_argument('--root', action='append')
    args = parser.parse_args()
    engine = Engine(args.database, args.root or default_roots(MountPolicy()))
    try:
        for line in sys.stdin:
            command = None
            try:
                command = json.loads(line)
                if not isinstance(command, dict):
                    raise ValueError()
                op = command.get('op')
                if op == 'shutdown':
                    break
                id = command.get('id')
                if type(id) is not int:
                    raise ValueError()
                if op == 'cancel':
                    with engine.lock:
                        if engine.active and engine.active[0] == id:
                            engine.active[1].set()
                elif op == 'search':
                    query, limit = command.get('query'), command.get('limit', 80)
                    if not isinstance(query, str) or len(query) > 4096 or type(limit) is not int:
                        raise ValueError()
                    query.encode('utf-8')  # reject lone JSON surrogates, not filesystem paths
                    engine.search(id, query, min(80, max(1, limit)))
                else:
                    raise ValueError()
            except (ValueError, TypeError):
                id = command.get('id') if isinstance(command, dict) else None
                engine.emit(dict(type='error', id=id if type(id) is int else None,
                                 message='Invalid command'))
    finally:
        engine.stop.set()
        with engine.lock:
            if engine.active:
                engine.active[1].set()
        engine.thread.join(timeout=.5)


if __name__ == '__main__':
    main()
