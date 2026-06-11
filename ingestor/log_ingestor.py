# ingestor/log_ingestor.py

from ports.ILogSource import ILogSource
from ports.IRunLogger import IRunLogger
from ports.ILogRepository import ILogRepository

class LogIngestor:

    def __init__(self, source_host: str, source_type: str, log_repository: ILogRepository, run_logger: IRunLogger, log_source: ILogSource) -> None:
        self._log_repository = log_repository
        self._run_logger = run_logger
        self._log_source = log_source
        self._source_type = source_type
        self._source_host = source_host

    def ingest(self, source_file: str) -> None:
        
        error_message = None
        records_inserted = 0
        files_failed = 0
        run_id = None

        # Verifica se o arquivo já foi processado
        if self._log_repository.already_processed(source_file):
            print(f"Arquivo '{source_file}' já foi processado. Ignorando.")
            return

        # Inicia o log de execução
        run_id = self._run_logger.start_run(self._source_type, self._source_host)
        try:
            # Lê os registros do arquivo JSON
            records = self._log_source.read_records()

            # Salva os registros no banco
            records_inserted = self._log_repository.save(records, source_file, run_id)
            print(f"Ingestão concluída: {records_inserted} registros inseridos para '{source_file}'")

        except Exception as e:
            error_message = str(e)
            files_failed += 1
            print(f'Erro durante a ingestão do arquivo {source_file}: {e}')

        finally:
            if run_id is not None:
                # Finaliza o log de execução
                self._run_logger.finish_run(run_id=run_id, files_processed=1, files_failed=files_failed, records_inserted=records_inserted, error_message=error_message)