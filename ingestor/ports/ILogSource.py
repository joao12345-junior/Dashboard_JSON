# ingestor/ports/ILogSource.py

from abc import ABC, abstractmethod

class ILogSource(ABC):
    """
    Port: contrato que toda fonte de log deve implementar.

    Ports and Adapters (Alistair Cockburn): este arquivo define
    o "o quê" — qualquer fonte que queira alimentar o ingestor
    precisa implementar read_records(). O ingestor não sabe,
    e não precisa saber, se a fonte é .evtx, .json, ou outra coisa.
    """

    @abstractmethod
    def read_records(self) -> list[dict]:
        """
        Lê registros da fonte e retorna como lista de dicionários.
        Cada dicionário representa um registro bruto — sem transformação.
        """
        ...