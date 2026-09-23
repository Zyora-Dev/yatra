import os
from pathlib import Path

import psycopg


def apply_schema():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required; no local database fallback is used.")
    schema = Path(__file__).with_name("schema.sql").read_text()
    try:
        with psycopg.connect(database_url, connect_timeout=10) as connection:
            connection.execute(schema)
    except psycopg.Error:
        raise SystemExit("Schema setup failed. Check database access and schema compatibility.") from None
    print("Schema setup completed.")


if __name__ == "__main__":
    apply_schema()