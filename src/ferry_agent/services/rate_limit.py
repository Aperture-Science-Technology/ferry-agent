"""Rate limiting simple en memoire (fenetre glissante).

Utilise pour `/opds/` : le jeton apparait dans l'URL (donc dans les logs
d'acces), la rotation/revocation + un plafond de requetes sont requis des
la v1. Pas de Redis : une seule replique core suffit pour commencer.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class SlidingWindowRateLimiter:
    """Compteur par cle : au plus `max_requests` dans `window_seconds`."""

    def __init__(self, max_requests: int = 120, window_seconds: float = 60.0) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            bucket = self._hits[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= self.max_requests:
                return False
            bucket.append(now)
            return True


# Instance module-level partagee par les routes OPDS.
opds_rate_limiter = SlidingWindowRateLimiter(max_requests=120, window_seconds=60.0)
