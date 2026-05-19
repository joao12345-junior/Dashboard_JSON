# generate_index.py
from pathlib import Path
import json
from datetime import datetime


def generate_index(data_folder: Path) -> None:
    """
    Varre a pasta public/data/ e gera index.json.

    Por que um script separado do conversor EVTX?
    Responsabilidade Única: o conversor converte .evtx → .json.
    O indexador apenas cataloga o que já existe.
    Você pode rodar o indexador a qualquer momento:
      - Depois de adicionar novos logs de backup manualmente
      - Depois de converter novos arquivos EVTX
      - Sem precisar re-converter nada

    Estrutura do index.json gerado:
    {
      "generated_at": "2024-03-15T18:30:00",
      "total_files": 42,
      "files": [
        {
          "name": "Security-2024-03_parte1.json",
          "size_bytes": 1048576,
          "size_mb": 1.0
        }
      ]
    }
    """
    if not data_folder.exists():
        print(f"[ERRO] Pasta não encontrada: {data_folder}")
        return

    entries = []

    for f in sorted(data_folder.glob("*.json")):
        # Exclui o próprio index.json para não criar referência circular
        if f.name == "index.json":
            continue

        size_bytes = f.stat().st_size

        # Ignora arquivos vazios — não têm dados úteis
        if size_bytes == 0:
            print(f"[SKIP] {f.name} — arquivo vazio")
            continue

        entries.append({
            "name": f.name,
            "size_bytes": size_bytes,
            "size_mb": round(size_bytes / (1024 * 1024), 2),
        })
        print(f"[OK] {f.name} — {size_bytes / (1024 * 1024):.1f}MB")

    index = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "total_files": len(entries),
        "files": entries,
    }

    output_path = data_folder / "index.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f"\n[INDEX] Concluído — {len(entries)} arquivo(s) catalogados")
    print(f"[INDEX] Salvo em: {output_path}")


if __name__ == "__main__":
    # Caminho relativo ao script — ajuste se necessário
    # O script deve ficar na raiz do projeto (junto com package.json)
    BASE = Path(__file__).parent
    data_folder = BASE / "public" / "data"

    generate_index(data_folder)