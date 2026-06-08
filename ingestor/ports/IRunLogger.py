# ingestor/ports/IRunLogger.py

from abc import ABC, abstractmethod
from datetime import datetime

class IRunLogger(ABC):
    """
    Port: contrato para registrar execuções do ingestor.
    Cada run abre com start_run() e fecha com finish_run().
    """

    @abstractmethod
    def start_run(self, source_type: str, source_host: str | None = None) -> int:
        """
        Registra o início de uma execução.
        Retorna o ID da run criada.
        """
        ...

    @abstractmethod
    def finish_run(self, run_id: int, files_processed: int, files_failed: int, records_inserted: int, error_message: str | None = None) -> None:
        """
        Registra o fim de uma execução com os totais.
        """
        ...