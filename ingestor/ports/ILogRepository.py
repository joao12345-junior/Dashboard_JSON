# ingestor/ports/ILogRepository.py

from abc import ABC, abstractmethod

class ILogRepository(ABC):
    """
    Port: contrato para gravação de registros no banco.
    O ingestor não sabe se está gravando em PostgreSQL,
    SQLite, ou arquivo — só sabe que pode chamar save().
    """

    @abstractmethod
    def save(self, records: list[dict], source_file: str | None = None, run_id: int | None = None) -> int:
        """
        Grava os registros e retorna quantos foram inseridos.
        source_file: caminho do arquivo de origem, para deduplicação.
        """
        ...

    @abstractmethod
    def already_processed(self, source_file: str) -> bool:
        """
        Verifica se um arquivo já foi processado anteriormente.
        Usado pelo ingestor para evitar duplicatas.
        """
        ...