# ingestor/adapters/ProcessJsonSource.py

import json
from pathlib import Path
from ports.ILogSource import ILogSource

class ProcessJsonSource(ILogSource):
    """
    Adapter: lê arquivos bkp.json de uma pasta e retorna
    os registros normalizados como lista de dicionários.

    Lida com duas versões do formato:
      - Novo: Message (maiúsculo), data yyyy-mm-dd, Start inteiro
      - Antigo: message (minúsculo), data dd/mm/yy, Start string
    """

    def __init__(self, folder_path: str) -> None:
        self._folder = Path(folder_path)

    def read_records(self) -> list[dict]:
        """
        Varre a pasta, lê todos os bkp.json e retorna
        os registros normalizados.
        """
        records = []

        for file in sorted(self._folder.glob('*bkp.json')):
            try:
                raw = self._read_file(file)
                # Cada arquivo pode ter um único objeto ou uma lista
                entries = raw if isinstance(raw, list) else [raw]
                for entry in entries:
                    records.append(self._normalize(entry, source_file=file.name))
            except Exception as e:
                # Arquivo corrompido não derruba os outros
                print(f"[WARN] {file.name}: {e}")
        return records
    
    # ── Métodos privados ──────────────────────────────────────────

    def _read_file(self, path: Path) -> list | dict:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
        
    def _normalize(self, entry: dict, source_file: str) -> dict:
        """
        Transforma um registro bruto no formato esperado pelo banco.
        Lida com as inconsistências entre versões antigas e novas.
        """
        return {
            'message': self._parse_message(entry),
            'log_date': self._parse_date(entry.get('Data', '')),
            'log_time': self._parse_time(entry.get('Hora', '')),
            'start': self._parse_start(entry.get('Start', 0)),
            'source_name': source_file
        }
    
    def _parse_message(self, entry: dict) -> str:
        # Suporta "Message" (novo) e "message" (antigo)
        return str(entry.get('Message') or entry.get('message') or '')
    
    def _parse_date(self, raw: str) -> str:
        """
        Normaliza data para yyyy-mm-dd.
          "08/06/2026" → "2026-06-08"
          "22/12/25"   → "2025-12-22"
        """
        raw = raw.strip()
        if not raw:
            return ''
        
        parts = raw.split('/')
        if len(parts) != 3:
            return raw
        
        day, month, year = parts
        # Ano com 2 dígitos → assume século 21
        if len(year) == 2:
            year = f"20{year}"

        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    
    def _parse_time(self, raw: str) -> str:
        """
        Normaliza hora para HH:MM:SS.
          " 7:20"    → "07:20:00"
          "07:37:13" → "07:37:13"
        """
        raw = raw.strip()
        if not raw:
            return "00:00:00"
        
        parts = raw.split(':')
        hour = parts[0].zfill(2) if len(parts) > 0 else "00"
        minute = parts[1].zfill(2) if len(parts) > 1 else "00"
        second = parts[2].zfill(2) if len(parts) > 2 else "00"

        return f"{hour}:{minute}:{second}"
    
    def _parse_start(self, raw) -> int:
        """
        Garante que Start é sempre inteiro.
          "0" → 0
          "1" → 1
           0  → 0
        """
        try:
            value = int(raw)
            return value if value in (0,1,2) else 0
        except (ValueError, TypeError):
            return 0