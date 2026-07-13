from django.core.management.color import no_style
from django.db import connection


def reset_sequences(*models):
    """Advance Postgres PK sequences past the max existing id.

    Needed after seeding rows with explicit primary keys (e.g. to mirror the
    frontend ids) — otherwise the next auto-id insert collides at id=1.
    """
    statements = connection.ops.sequence_reset_sql(no_style(), list(models))
    if not statements:
        return
    with connection.cursor() as cursor:
        for sql in statements:
            cursor.execute(sql)
