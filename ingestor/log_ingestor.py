# ingestor/log_ingestor.py

from pathlib import Path
from ports.ILogSource import ILogSource
from ports.IRunLogger import IRunLogger
from ports.ILogRepository import ILogRepository


class LogIngestor:

    def __init__(self, source_host: str, source_type: str, folder_path: str,
                 log_repository: ILogRepository, run_logger: IRunLogger,
                 log_source: ILogSource) -> None:
        self._log_repository = log_repository
        self._run_logger = run_logger
        self._log_source = log_source
        self._source_type = source_type
        self._source_host = source_host
        self._folder = Path(folder_path)

    def run(self) -> None:
        """
        Orquestra a ingestão completa da pasta.
        Uma run por arquivo — cada arquivo tem seu próprio registro em ingestion_runs.
        """
        for file in sorted(self._folder.glob("*bkp.json")):
            self._ingest_file(file)

    def _ingest_file(self, file: Path) -> None:
        error_message = None
        records_inserted = 0
        files_failed = 0
        run_id = None

        # Verifica se o arquivo já foi processado
        if self._log_repository.already_processed(file.name):
            print(f"Arquivo '{file.name}' já foi processado. Ignorando.")
            return

        run_id = self._run_logger.start_run(self._source_type, self._source_host)
        try:
            # Lê só este arquivo
            records = self._log_source.read_single_file(file)
            records_inserted = self._log_repository.save(records, file.name, run_id=run_id)
            print(f"Ingestão concluída: {records_inserted} registros inseridos para '{file.name}'")

        except Exception as e:
            error_message = str(e)
            files_failed += 1
            print(f"Erro durante a ingestão do arquivo {file.name}: {e}")

        finally:
            if run_id is not None:
                self._run_logger.finish_run(
                    run_id=run_id,
                    files_processed=1,
                    files_failed=files_failed,
                    records_inserted=records_inserted,
                    error_message=error_message,
                )