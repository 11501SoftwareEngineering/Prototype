"""HTTP method sets shared across middleware and auth."""

# RFC 9110 safe methods — no request body side effects expected.
SAFE_HTTP_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})

# Methods allowed to silent-renew via refresh cookie (subset of safe).
SAFE_RENEW_METHODS = frozenset({"GET", "HEAD"})
