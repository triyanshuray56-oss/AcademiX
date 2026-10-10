"""Load local environment files before application settings are read."""

from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent

# Explicit backend settings take priority over the optional project root file.
# Values already exported by the process are never overwritten.
load_dotenv(PROJECT_ROOT / ".env", override=False)
load_dotenv(BACKEND_ROOT / ".env", override=False)

