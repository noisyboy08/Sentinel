"""Pytest configuration — test-wide settings for the Sentinel backend suite."""
import pytest


def pytest_configure(config):
    """Suppress deprecation warnings that originate inside library internals,
    not in our own code.  Both are known upstream issues in starlette/anyio:

    1. StarletteDeprecationWarning — starlette.testclient checking for httpx vs httpx2
    2. DeprecationWarning (anyio)  — starlette.testclient using anyio.abc.BlockingPortal
       instead of anyio.from_thread.BlockingPortal (fixed in newer starlette).
    """
    config.addinivalue_line(
        "filterwarnings",
        "ignore::starlette.testclient.StarletteDeprecationWarning",
    )
    config.addinivalue_line(
        "filterwarnings",
        "ignore:The anyio.abc.BlockingPortal alias is deprecated:DeprecationWarning",
    )
