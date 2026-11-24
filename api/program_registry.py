# program_registry.py
"""
Registro dos programas dos Logs Gerais (tabela optsislog.app_programs).

Seguindo o Repository Pattern: todo SQL desta feature mora aqui, as rotas
(routes/app_programs.py) so' traduzem HTTP <-> estas funcoes. Nenhuma funcao
abre conexao -- recebem um cursor, entao quem chama decide a transacao e os
testes usam um cursor falso, sem banco.

Este modulo nao importa `db` de proposito (db.py exige configuracao de
ambiente), para continuar importavel nos testes unitarios.
"""
from __future__ import annotations

from typing import Any

# "auto" e' como a API chama visibility NULL (o front nao precisa lidar com null).
VISIBILITIES = ("auto", "shown", "hidden")
MAX_PROGRAM_LENGTH = 200


class InvalidPayload(ValueError):
    """Corpo da requisicao invalido (a rota responde 400 com a mensagem)."""


def parse_program_name(body: Any) -> str:
    """
    Extrai `programa` do corpo. Nao faz strip: o nome precisa casar EXATAMENTE
    com o texto gravado em app_logs.programa (o front guarda o valor cru).
    """
    if not isinstance(body, dict):
        raise InvalidPayload("Body inválido")
    programa = body.get("programa")
    if not isinstance(programa, str) or not programa.strip():
        raise InvalidPayload("programa é obrigatório")
    if len(programa) > MAX_PROGRAM_LENGTH:
        raise InvalidPayload("programa muito longo")
    return programa


def parse_visibility_payload(body: Any) -> tuple[str, str]:
    """Devolve (programa, visibility) validados; visibility em VISIBILITIES."""
    programa = parse_program_name(body)
    visibility = body.get("visibility")
    if visibility not in VISIBILITIES:
        raise InvalidPayload("visibility deve ser auto, shown ou hidden")
    return programa, visibility


def list_programs(cur: Any) -> list[dict]:
    """
    Todos os programas conhecidos: os do registro + os que aparecem em app_logs
    e ainda nao foram registrados (FULL OUTER JOIN), sem escrever nada.

    `last_log_at` = o mais recente entre o registro (sobrevive a limpeza de 14
    dias) e o que existe agora em app_logs. GREATEST ignora NULL no PostgreSQL.
    `cur` deve ser RealDictCursor.
    """
    cur.execute(
        """
        WITH live AS (
            SELECT programa,
                   max(ocorrido_em) AS last_log_at,
                   count(*) AS log_count,
                   count(*) FILTER (WHERE ocorrido_em >= now() - interval '24 hours') AS logs_24h
            FROM optsislog.app_logs
            WHERE programa IS NOT NULL AND programa <> ''
            GROUP BY programa
        )
        SELECT coalesce(p.programa, l.programa) AS programa,
               coalesce(p.visibility, 'auto') AS visibility,
               p.visibility_changed_at,
               GREATEST(p.last_log_at, l.last_log_at) AS last_log_at,
               coalesce(l.log_count, 0) AS log_count,
               coalesce(l.logs_24h, 0) AS logs_24h
        FROM optsislog.app_programs p
        FULL OUTER JOIN live l ON l.programa = p.programa
        ORDER BY lower(coalesce(p.programa, l.programa))
        """
    )
    rows = cur.fetchall()
    for row in rows:
        for key in ("visibility_changed_at", "last_log_at"):
            if row.get(key) is not None:
                row[key] = row[key].isoformat()
        row["log_count"] = int(row["log_count"])
        row["logs_24h"] = int(row["logs_24h"])
    return rows


def set_visibility(cur: Any, programa: str, visibility: str) -> None:
    """
    Grava a escolha manual. Cria a linha se o programa ainda nao esta no registro
    (preenchendo last_log_at com o que existe em app_logs agora).
    """
    stored = None if visibility == "auto" else visibility
    cur.execute(
        """
        INSERT INTO optsislog.app_programs (programa, visibility, visibility_changed_at, last_log_at)
        VALUES (%s, %s, now(),
                (SELECT max(ocorrido_em) FROM optsislog.app_logs WHERE programa = %s))
        ON CONFLICT (programa) DO UPDATE
           SET visibility = EXCLUDED.visibility,
               visibility_changed_at = now()
        """,
        (programa, stored, programa),
    )


def delete_program(cur: Any, programa: str) -> int:
    """
    Apaga TODOS os logs do programa e tambem a linha do registro (inclusive a
    escolha de visibilidade). Se o programa voltar a logar, entra de novo como
    automatico -- decisao do usuario (2026-11-24). Devolve quantos logs foram apagados.
    """
    cur.execute("DELETE FROM optsislog.app_logs WHERE programa = %s", (programa,))
    deleted = cur.rowcount
    cur.execute("DELETE FROM optsislog.app_programs WHERE programa = %s", (programa,))
    return deleted


def sync_last_log_at(cur: Any) -> None:
    """
    Copia para o registro o ultimo log de cada programa. Roda no /api/logs/cleanup
    ANTES de apagar os logs antigos -- e' o que faz o registro lembrar do programa
    depois que seus logs saem da retencao.
    """
    cur.execute(
        """
        INSERT INTO optsislog.app_programs (programa, last_log_at)
        SELECT programa, max(ocorrido_em)
        FROM optsislog.app_logs
        WHERE programa IS NOT NULL AND programa <> ''
        GROUP BY programa
        ON CONFLICT (programa) DO UPDATE
           SET last_log_at = GREATEST(optsislog.app_programs.last_log_at, EXCLUDED.last_log_at)
        """
    )
