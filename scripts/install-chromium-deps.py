#!/usr/bin/env python3
"""Bounded fallback for hosted runners whose real Chromium launch failed."""
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import tempfile

sources = Path('/etc/apt/sources.list.d/ubuntu.sources')
original = sources.read_text()
archives = Path(os.environ.get('APT_ARCHIVES', '/var/cache/apt/archives'))
archives.mkdir(parents=True, exist_ok=True)
(archives / 'partial').mkdir(exist_ok=True)
configuration = tempfile.NamedTemporaryFile(mode='w', prefix='pencil-chromium-apt-', delete=False)
configuration.write(f'Dir::Cache::archives \"{archives}\";\nAcquire::Retries \"1\";\nAcquire::http::Timeout \"20\";\nAcquire::https::Timeout \"20\";\n')
configuration.close()
environment = {**os.environ, 'APT_CONFIG': configuration.name}
mirrors = [None, 'http://mirrors.edge.kernel.org/ubuntu', 'http://us-east-1.ec2.archive.ubuntu.com/ubuntu']
try:
    for attempt, mirror in enumerate(mirrors, 1):
        if mirror:
            sources.write_text(re.sub(r'(?m)^(URIs:\s*)(mirror\+file:/etc/apt/apt-mirrors\.txt|https?://(([a-z0-9.-]+\.)?archive\.ubuntu\.com|security\.ubuntu\.com|mirrors\.edge\.kernel\.org)/ubuntu/?)', lambda m: m[1] + mirror + '/', original))
        print(f'Chromium dependencies: attempt {attempt}/3 (90s deadline)', flush=True)
        result = subprocess.run(['timeout', '--kill-after=5s', '90s', 'bash', '-ec', 'dpkg --configure -a; pnpm exec playwright install-deps chromium'], env=environment)
        if result.returncode == 0:
            sys.exit(0)
        if attempt < len(mirrors):
            time.sleep(attempt * 2)
    sys.exit(result.returncode)
finally:
    sources.write_text(original)
    Path(configuration.name).unlink(missing_ok=True)
