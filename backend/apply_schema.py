import os
import re
from pathlib import Path

import psycopg


def apply_schema():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required; no local database fallback is used.")
    schema = Path(__file__).with_name("schema.sql").read_text()
    stage = "database connection"
    try:
        with psycopg.connect(database_url, connect_timeout=10) as connection:
            stage = "schema execution"
            connection.execute(schema)
            stage = "transaction commit"
    except psycopg.Error as error:
        sqlstate = error.sqlstate or ""
        safe_sqlstate = sqlstate if re.fullmatch(r"[0-9A-Z]{5}", sqlstate) else "unavailable"
        raise SystemExit(
            f"Schema setup failed during {stage}: {type(error).__name__}; "
            f"SQLSTATE={safe_sqlstate}. "
            "Check the Render database status and DATABASE_URL binding for connection failures; "
            "check database permissions and existing schema for execution failures."
        ) from None
    print("Schema setup completed.")


if __name__ == "__main__":
    apply_schema()