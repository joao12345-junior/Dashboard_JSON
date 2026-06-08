import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json
import os
import threading
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import defaultdict


# ---------------------------------------------------------------------------
# Constantes de domínio
# ---------------------------------------------------------------------------

LEVELS_TO_KEEP: frozenset[str] = frozenset({"0", "1", "2", "3"})

LEVEL_LABELS: dict[str, str] = {
    "0": "LogAlways",
    "1": "Crítico",
    "2": "Erro",
    "3": "Aviso",
    "4": "Informação",
    "5": "Verbose",
}

DESCRIPTIONS_FILE = Path(__file__).parent / "event_descriptions.json"
_UNKNOWN_DESCRIPTION = "Evento sem descrição catalogada."
_UNKNOWN_CRITICALITY = "Low"

# ---------------------------------------------------------------------------
# Padrões do projeto — valores obrigatórios que a UI expõe como default
# ---------------------------------------------------------------------------

# Limite de registros por arquivo JSON antes de subdividir em partes.
# ~1000 registros ≈ 1–5 MB dependendo do tamanho das mensagens.
# O frontend carrega em lotes de 10 arquivos — manter nessa faixa é importante.
DEFAULT_RECORDS_PER_FILE: int = 1000

# Janela de tempo padrão: descartar eventos com mais de 8 meses.
# Valor definido pelo projeto como padrão operacional.
DEFAULT_CUTOFF_MONTHS: int = 8


# ---------------------------------------------------------------------------
# Repository de descrições
# ---------------------------------------------------------------------------

class EventDescriptionRepository:
    """
    Carrega e fornece descrições de EventIDs a partir de um arquivo JSON externo.

    Repository Pattern: isola o acesso aos dados de referência.
    O resto do código não sabe se os dados vêm de JSON, banco ou memória.
    """

    def __init__(self, data: dict[str, dict[str, dict]]):
        self._data = data

    @classmethod
    def load(cls, path: Path = DESCRIPTIONS_FILE) -> "EventDescriptionRepository":
        if not path.exists():
            return cls({})
        with open(path, encoding="utf-8") as f:
            return cls(json.load(f))

    def lookup(self, provider: str, event_id: str) -> dict[str, str]:
        provider_dict = self._data.get(provider, {})
        entry = provider_dict.get(event_id)
        if entry and isinstance(entry, dict):
            return entry
        return {"summary": _UNKNOWN_DESCRIPTION, "criticality": _UNKNOWN_CRITICALITY}


# ---------------------------------------------------------------------------
# Funções puras de transformação
# ---------------------------------------------------------------------------

def _strip_namespace(tag: str) -> str:
    """Remove namespace XML. Ex: '{ns}Level' → 'Level'."""
    return tag.split("}", 1)[1] if "}" in tag else tag


def _xml_elem_to_dict(elem: ET.Element) -> "dict | str":
    """Converte Element XML em dict recursivo."""
    children: dict = {}
    for child in elem:
        child_tag = _strip_namespace(child.tag)
        val = _xml_elem_to_dict(child)
        if child_tag in children:
            existing = children[child_tag]
            if not isinstance(existing, list):
                children[child_tag] = [existing]
            children[child_tag].append(val)
        else:
            children[child_tag] = val

    text = (elem.text or "").strip()
    attribs = dict(elem.attrib)

    if children:
        result = attribs | children
        if text:
            result["#text"] = text
        return result
    if attribs:
        return (attribs | {"#text": text}) if text else attribs
    return text if text else {}


def _extract_system_fields(event: dict) -> dict:
    """Extrai campos do bloco System em variáveis nomeadas."""
    system = event.get("System", {})
    provider = system.get("Provider", {})

    return {
        "provider_name": provider.get("Name", "") if isinstance(provider, dict) else "",
        "event_id":      str(system.get("EventID", "")),
        "level":         str(system.get("Level", "4")),
        "computer":      system.get("Computer", ""),
        "channel":       system.get("Channel", ""),
        "timestamp": (
            system.get("TimeCreated", {}).get("SystemTime", "")
            if isinstance(system.get("TimeCreated"), dict) else ""
        ),
        "record_id":     str(system.get("EventRecordID", "")),
    }


def _extract_rendered_message(event: dict) -> str:
    """Extrai mensagem do bloco RenderingInfo quando disponível."""
    rendering = event.get("RenderingInfo", {})
    if not isinstance(rendering, dict):
        return ""
    message = rendering.get("Message", "")
    return " ".join(str(message).split()) if message else ""


def _parse_event_timestamp(event: dict) -> "datetime | None":
    """
    Extrai e converte o timestamp do evento para datetime aware (UTC).

    Retorna None se o timestamp estiver ausente ou malformado —
    o caller decide o que fazer com eventos sem data.
    """
    system = event.get("System", {})
    time_created = system.get("TimeCreated", {})
    if not isinstance(time_created, dict):
        return None

    raw_ts: str = time_created.get("SystemTime", "")
    if not raw_ts:
        return None

    # Normaliza o timestamp do Windows:
    # "2024-03-15T18:30:00.1234567Z" → datetime UTC
    # "2024-03-15T18:30:00Z"         → datetime UTC
    normalized = raw_ts.rstrip("Z").split(".")[0]
    try:
        dt = datetime.fromisoformat(normalized)
        # Se não tem tzinfo, assume UTC (todos os timestamps do wevtutil são UTC)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _should_keep(event: dict, cutoff: "datetime | None" = None) -> bool:
    """
    Decide se o evento deve ser mantido.

    Critérios (ambos devem passar):
    1. Level: apenas Critical (1), Error (2), Warning (3), LogAlways (0)
    2. Data: o evento deve ser mais recente que o cutoff (se informado)

    Por que o cutoff é opcional?
    Se cutoff_months = 0, nenhuma data é descartada. O parâmetro None
    representa "sem filtro de data" — mais claro do que passar uma data
    arbitrária no passado distante.
    """
    system = event.get("System", {})
    level = str(system.get("Level", "4"))

    if level not in LEVELS_TO_KEEP:
        return False

    if cutoff is not None:
        event_dt = _parse_event_timestamp(event)
        # Evento sem timestamp: mantém por segurança (pode ser crítico)
        if event_dt is not None and event_dt < cutoff:
            return False

    return True


def _enrich_event(event: dict, repo: EventDescriptionRepository) -> dict:
    """Adiciona bloco _enriched com campos planos para o frontend."""
    fields = _extract_system_fields(event)
    rendered = _extract_rendered_message(event)
    db_entry = repo.lookup(fields["provider_name"], fields["event_id"])

    if rendered:
        description = rendered
        source = "rendered"
    elif db_entry["summary"] != _UNKNOWN_DESCRIPTION:
        description = db_entry["summary"]
        source = "dictionary"
    else:
        description = _UNKNOWN_DESCRIPTION
        source = "unknown"

    event["_enriched"] = {
        "provider":    fields["provider_name"],
        "eventId":     fields["event_id"],
        "recordId":    fields["record_id"],
        "level":       fields["level"],
        "levelLabel":  LEVEL_LABELS.get(fields["level"], f"Nível {fields['level']}"),
        "criticality": db_entry["criticality"],
        "description": description,
        "source":      source,
        "computer":    fields["computer"],
        "channel":     fields["channel"],
        "timestamp":   fields["timestamp"],
    }

    return event


# ---------------------------------------------------------------------------
# Divisão de arquivos grandes
# ---------------------------------------------------------------------------

def _save_chunk(
    records: list[dict],
    filepath: Path,
    indent: "int | None",
) -> None:
    """Salva um chunk de registros em disco."""
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=indent, default=str)


def save_records(
    records: list[dict],
    base_name: str,
    out_path: Path,
    pretty: bool,
    records_per_file: int,
) -> list[str]:
    """
    Decide como salvar os registros com base no volume.

    - Arquivo pequeno (≤ records_per_file): salva como base_name.json
    - Arquivo grande: divide por mês (YYYY-MM) usando o timestamp do _enriched
    - Eventos sem timestamp válido: agrupados em base_name_sem-data.json

    records_per_file é passado como parâmetro (não mais constante global)
    para respeitar o valor configurado pelo operador na UI.
    """
    indent = 2 if pretty else None
    generated: list[str] = []

    if len(records) <= records_per_file:
        filepath = out_path / f"{base_name}.json"
        _save_chunk(records, filepath, indent)
        return [filepath.name]

    by_month: dict[str, list[dict]] = defaultdict(list)

    for record in records:
        enriched = record.get("_enriched", {})
        timestamp = str(enriched.get("timestamp", ""))
        month = timestamp[:7] if len(timestamp) >= 7 else "sem-data"
        by_month[month].append(record)

    for month, month_records in sorted(by_month.items()):
        if month == "sem-data":
            generated += _save_with_parts(
                month_records,
                f"{base_name}_sem-data",
                out_path,
                indent,
                records_per_file,
            )
        elif len(month_records) <= records_per_file:
            filepath = out_path / f"{base_name}_{month}.json"
            _save_chunk(month_records, filepath, indent)
            generated.append(filepath.name)
        else:
            generated += _save_with_parts(
                month_records,
                f"{base_name}_{month}",
                out_path,
                indent,
                records_per_file,
            )

    return generated


def _save_with_parts(
    records: list[dict],
    base_name: str,
    out_path: Path,
    indent: "int | None",
    records_per_file: int,
) -> list[str]:
    """Subdivide uma lista de registros em arquivos de records_per_file itens."""
    generated: list[str] = []

    for part_num, start in enumerate(range(0, len(records), records_per_file), 1):
        chunk = records[start : start + records_per_file]
        filepath = out_path / f"{base_name}_parte{part_num}.json"
        _save_chunk(chunk, filepath, indent)
        generated.append(filepath.name)

    return generated


# ---------------------------------------------------------------------------
# Core: leitura de EVTX via wevtutil
# ---------------------------------------------------------------------------

def parse_evtx_file(
    evtx_path: Path,
    repo: EventDescriptionRepository,
    cutoff: "datetime | None",
) -> tuple[list[dict], int, int]:
    """
    Exporta o EVTX para XML, converte, filtra e enriquece.

    cutoff: datetime mínimo permitido. Eventos anteriores são descartados.
    Retorna: (eventos_filtrados, total_lido, total_descartado)
    """
    proc = subprocess.run(
        [
            "wevtutil", "qe", str(evtx_path),
            "/lf:true",
            "/f:xml",
            "/rd:true",
            "/uni:true",
        ],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
    )

    raw = proc.stdout.strip()

    if not raw:
        stderr = proc.stderr.strip()
        if "No events" in stderr or proc.returncode == 0:
            return [], 0, 0
        if stderr:
            raise RuntimeError(stderr)
        return [], 0, 0

    try:
        root = ET.fromstring(f"<Root>{raw}</Root>")
    except ET.ParseError:
        cleaned = "".join(c for c in raw if c >= " " or c in "\t\n\r")
        root = ET.fromstring(f"<Root>{cleaned}</Root>")

    total_read = 0
    total_discarded = 0
    kept: list[dict] = []

    for child in root:
        event_dict = _xml_elem_to_dict(child)
        total_read += 1

        # _should_keep agora recebe o cutoff e verifica data + level
        if not _should_keep(event_dict, cutoff):
            total_discarded += 1
            continue

        kept.append(_enrich_event(event_dict, repo))

    return kept, total_read, total_discarded


# ---------------------------------------------------------------------------
# GUI
# ---------------------------------------------------------------------------

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("EVTX → JSON Converter")
        self.resizable(False, False)
        self.configure(bg="#1e1e2e")
        self._processing = False
        self._repo = EventDescriptionRepository.load()
        self._build_ui()

    def _build_ui(self):
        PAD = 16
        BG, CARD, ACCENT, FG, MUTED, BTN_FG = (
            "#1e1e2e", "#2a2a3e", "#7c6af7", "#cdd6f4", "#6c7086", "#ffffff"
        )

        # ── Título ──────────────────────────────────────────────────────────
        tk.Label(self, text="EVTX → JSON Converter",
                 font=("Segoe UI", 16, "bold"), bg=BG, fg=FG).grid(
            row=0, column=0, columnspan=3, pady=(PAD, 4), padx=PAD, sticky="w")

        db_count = sum(len(v) for v in self._repo._data.values())
        db_status = (
            f"Base de dados: {db_count} EventIDs catalogados"
            if db_count > 0
            else "⚠ event_descriptions.json não encontrado — descrições desativadas"
        )
        tk.Label(self, text=db_status, font=("Segoe UI", 8),
                 bg=BG, fg="#a6e3a1" if db_count > 0 else "#f38ba8").grid(
            row=1, column=0, columnspan=3, padx=PAD, sticky="w")

        tk.Label(
            self,
            text="Filtro ativo: Crítico · Erro · Aviso  (Information e Verbose descartados)",
            font=("Segoe UI", 8), bg=BG, fg=MUTED,
        ).grid(row=2, column=0, columnspan=3, padx=PAD, sticky="w")

        tk.Frame(self, height=1, bg=CARD).grid(
            row=3, column=0, columnspan=3, sticky="ew", padx=PAD, pady=(8, PAD))

        # ── Pasta de Entrada ─────────────────────────────────────────────────
        tk.Label(self, text="Pasta de Entrada (EVTX):",
                 font=("Segoe UI", 9, "bold"), bg=BG, fg=FG).grid(
            row=4, column=0, padx=PAD, sticky="w")

        self.input_var = tk.StringVar()
        tk.Entry(self, textvariable=self.input_var, width=54,
                 font=("Segoe UI", 9), bg=CARD, fg=FG,
                 insertbackground=FG, relief="flat", bd=6).grid(
            row=5, column=0, columnspan=2, padx=(PAD, 4), pady=(2, PAD), sticky="ew")
        tk.Button(self, text="Escolher", font=("Segoe UI", 9),
                  bg=ACCENT, fg=BTN_FG, relief="flat", cursor="hand2", padx=10,
                  command=self._choose_input).grid(row=5, column=2, padx=(0, PAD), pady=(2, PAD))

        # ── Pasta de Saída ───────────────────────────────────────────────────
        tk.Label(self, text="Pasta de Saída (JSON):",
                 font=("Segoe UI", 9, "bold"), bg=BG, fg=FG).grid(
            row=6, column=0, padx=PAD, sticky="w")

        self.output_var = tk.StringVar()
        tk.Entry(self, textvariable=self.output_var, width=54,
                 font=("Segoe UI", 9), bg=CARD, fg=FG,
                 insertbackground=FG, relief="flat", bd=6).grid(
            row=7, column=0, columnspan=2, padx=(PAD, 4), pady=(2, PAD), sticky="ew")
        tk.Button(self, text="Escolher", font=("Segoe UI", 9),
                  bg=ACCENT, fg=BTN_FG, relief="flat", cursor="hand2", padx=10,
                  command=self._choose_output).grid(row=7, column=2, padx=(0, PAD), pady=(2, PAD))

        # ── Separador ────────────────────────────────────────────────────────
        tk.Frame(self, height=1, bg=CARD).grid(
            row=8, column=0, columnspan=3, sticky="ew", padx=PAD, pady=(4, PAD))

        # ── Configurações do Projeto ─────────────────────────────────────────
        tk.Label(
            self,
            text="Configurações do Projeto",
            font=("Segoe UI", 9, "bold"), bg=BG, fg=FG,
        ).grid(row=9, column=0, columnspan=3, padx=PAD, sticky="w")

        config_frame = tk.Frame(self, bg=BG)
        config_frame.grid(row=10, column=0, columnspan=3, padx=PAD, pady=(6, PAD), sticky="ew")

        # ── Registros por arquivo ────────────────────────────────────────────
        tk.Label(
            config_frame,
            text="Registros por arquivo JSON:",
            font=("Segoe UI", 9), bg=BG, fg=FG,
        ).grid(row=0, column=0, sticky="w", pady=(0, 4))

        self.records_per_file_var = tk.IntVar(value=DEFAULT_RECORDS_PER_FILE)
        records_frame = tk.Frame(config_frame, bg=BG)
        records_frame.grid(row=0, column=1, sticky="w", padx=(12, 0), pady=(0, 4))

        tk.Spinbox(
            records_frame,
            from_=100, to=10000, increment=100,
            textvariable=self.records_per_file_var,
            width=8,
            font=("Segoe UI", 9), bg=CARD, fg=FG,
            insertbackground=FG, relief="flat",
            buttonbackground=CARD,
        ).pack(side="left")

        tk.Label(
            records_frame,
            text=f"  (padrão do projeto: {DEFAULT_RECORDS_PER_FILE})",
            font=("Segoe UI", 8), bg=BG, fg=MUTED,
        ).pack(side="left")

        # ── Intervalo de tempo ────────────────────────────────────────────────
        tk.Label(
            config_frame,
            text="Descartar eventos mais antigos que:",
            font=("Segoe UI", 9), bg=BG, fg=FG,
        ).grid(row=1, column=0, sticky="w", pady=(4, 0))

        cutoff_frame = tk.Frame(config_frame, bg=BG)
        cutoff_frame.grid(row=1, column=1, sticky="w", padx=(12, 0), pady=(4, 0))

        self.cutoff_months_var = tk.IntVar(value=DEFAULT_CUTOFF_MONTHS)
        tk.Spinbox(
            cutoff_frame,
            from_=0, to=120, increment=1,
            textvariable=self.cutoff_months_var,
            width=5,
            font=("Segoe UI", 9), bg=CARD, fg=FG,
            insertbackground=FG, relief="flat",
            buttonbackground=CARD,
        ).pack(side="left")

        tk.Label(
            cutoff_frame,
            text=f"  meses  (0 = sem filtro de data · padrão: {DEFAULT_CUTOFF_MONTHS})",
            font=("Segoe UI", 8), bg=BG, fg=MUTED,
        ).pack(side="left")

        # Label dinâmica que mostra a data de corte calculada
        self.cutoff_label_var = tk.StringVar()
        self._update_cutoff_label()
        tk.Label(
            config_frame,
            textvariable=self.cutoff_label_var,
            font=("Segoe UI", 8, "italic"), bg=BG, fg=MUTED,
        ).grid(row=2, column=1, sticky="w", padx=(12, 0))

        # Atualiza o label quando o valor muda
        self.cutoff_months_var.trace_add("write", lambda *_: self._update_cutoff_label())

        # ── Separador ────────────────────────────────────────────────────────
        tk.Frame(self, height=1, bg=CARD).grid(
            row=11, column=0, columnspan=3, sticky="ew", padx=PAD, pady=(4, PAD))

        # ── Opções gerais ────────────────────────────────────────────────────
        opt = tk.Frame(self, bg=BG)
        opt.grid(row=12, column=0, columnspan=3, padx=PAD, sticky="w", pady=(0, PAD))

        self.pretty_var = tk.BooleanVar(value=True)
        tk.Checkbutton(opt, text="JSON indentado", variable=self.pretty_var,
                       font=("Segoe UI", 9), bg=BG, fg=FG, selectcolor=CARD,
                       activebackground=BG, activeforeground=FG).pack(side="left")

        self.overwrite_var = tk.BooleanVar(value=True)
        tk.Checkbutton(opt, text="Sobrescrever existentes", variable=self.overwrite_var,
                       font=("Segoe UI", 9), bg=BG, fg=FG, selectcolor=CARD,
                       activebackground=BG, activeforeground=FG).pack(side="left", padx=(16, 0))

        # ── Progresso ────────────────────────────────────────────────────────
        self.progress = ttk.Progressbar(self, length=500, mode="determinate")
        self.progress.grid(row=13, column=0, columnspan=3, padx=PAD, pady=(0, 4), sticky="ew")

        self.status_var = tk.StringVar(value="Pronto.")
        tk.Label(self, textvariable=self.status_var,
                 font=("Segoe UI", 8), bg=BG, fg=MUTED, anchor="w").grid(
            row=14, column=0, columnspan=3, padx=PAD, sticky="w")

        # ── Log ──────────────────────────────────────────────────────────────
        log_frame = tk.Frame(self, bg=CARD)
        log_frame.grid(row=15, column=0, columnspan=3, padx=PAD, pady=(4, 0), sticky="nsew")

        self.log_widget = tk.Text(
            log_frame, height=11, width=72,
            font=("Cascadia Code", 8), bg=CARD, fg=FG,
            insertbackground=FG, relief="flat", state="disabled", wrap="word")
        scr = tk.Scrollbar(log_frame, command=self.log_widget.yview, bg=CARD)
        self.log_widget.configure(yscrollcommand=scr.set)
        self.log_widget.pack(side="left", fill="both", expand=True, padx=6, pady=6)
        scr.pack(side="right", fill="y")

        # ── Botões ────────────────────────────────────────────────────────────
        btns = tk.Frame(self, bg=BG)
        btns.grid(row=16, column=0, columnspan=3, pady=PAD)

        self.run_btn = tk.Button(
            btns, text="  Converter  ",
            font=("Segoe UI", 10, "bold"), bg=ACCENT, fg=BTN_FG,
            relief="flat", cursor="hand2", padx=16, pady=6,
            command=self._start)
        self.run_btn.pack(side="left", padx=8)

        tk.Button(btns, text="Limpar Log", font=("Segoe UI", 9),
                  bg=CARD, fg=FG, relief="flat", cursor="hand2",
                  padx=12, pady=6, command=self._clear_log).pack(side="left", padx=8)

    def _update_cutoff_label(self):
        """Atualiza o label que mostra a data de corte calculada em tempo real."""
        try:
            months = self.cutoff_months_var.get()
        except tk.TclError:
            # Spinbox temporariamente vazio durante edição
            self.cutoff_label_var.set("")
            return

        if months == 0:
            self.cutoff_label_var.set("→ Nenhuma data será descartada")
        else:
            cutoff_date = _compute_cutoff(months)
            self.cutoff_label_var.set(
                f"→ Descartará eventos anteriores a {cutoff_date.strftime('%d/%m/%Y')}"
            )

    def _choose_input(self):
        path = filedialog.askdirectory(title="Selecione a pasta com arquivos EVTX")
        if path:
            self.input_var.set(path)
            if not self.output_var.get():
                self.output_var.set(str(Path(path) / "json_output"))

    def _choose_output(self):
        path = filedialog.askdirectory(title="Selecione a pasta de saída para os JSONs")
        if path:
            self.output_var.set(path)

    def _log(self, msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        self.log_widget.configure(state="normal")
        self.log_widget.insert("end", f"[{ts}] {msg}\n")
        self.log_widget.see("end")
        self.log_widget.configure(state="disabled")

    def _clear_log(self):
        self.log_widget.configure(state="normal")
        self.log_widget.delete("1.0", "end")
        self.log_widget.configure(state="disabled")

    def _start(self):
        if self._processing:
            return

        input_dir = self.input_var.get().strip()
        output_dir = self.output_var.get().strip()

        if not input_dir or not os.path.isdir(input_dir):
            messagebox.showerror("Erro", "Selecione uma pasta de entrada válida.")
            return
        if not output_dir:
            messagebox.showerror("Erro", "Selecione uma pasta de saída.")
            return

        try:
            records_per_file = self.records_per_file_var.get()
            if records_per_file < 100:
                messagebox.showerror("Erro", "Registros por arquivo deve ser no mínimo 100.")
                return
        except tk.TclError:
            messagebox.showerror("Erro", "Valor inválido para registros por arquivo.")
            return

        try:
            cutoff_months = self.cutoff_months_var.get()
        except tk.TclError:
            messagebox.showerror("Erro", "Valor inválido para intervalo de tempo.")
            return

        self._processing = True
        self.run_btn.configure(state="disabled", text="  Processando...")
        threading.Thread(
            target=self._run,
            args=(input_dir, output_dir, records_per_file, cutoff_months),
            daemon=True,
        ).start()

    def _run(
        self,
        input_dir: str,
        output_dir: str,
        records_per_file: int,
        cutoff_months: int,
    ):
        try:
            out_path = Path(output_dir)
            out_path.mkdir(parents=True, exist_ok=True)

            # Calcula a data de corte uma vez, antes de processar os arquivos
            cutoff: "datetime | None" = (
                _compute_cutoff(cutoff_months) if cutoff_months > 0 else None
            )

            if cutoff:
                self._log(
                    f"Filtro de data ativo: descartando eventos anteriores a "
                    f"{cutoff.strftime('%d/%m/%Y')} ({cutoff_months} meses)"
                )
            else:
                self._log("Filtro de data desativado — todos os eventos serão incluídos.")

            self._log(f"Limite por arquivo: {records_per_file} registros.")

            evtx_files = sorted(
                f for f in Path(input_dir).iterdir()
                if f.suffix.lower() == ".evtx" and f.is_file()
            )

            total = len(evtx_files)
            if total == 0:
                self._log("Nenhum arquivo .evtx encontrado na pasta selecionada.")
                return

            self._log(f"Encontrados {total} arquivo(s) EVTX.")
            self._log("Iniciando conversão com /rd:true + dicionário de EventIDs...")
            self.progress["maximum"] = total
            self.progress["value"] = 0

            ok = erros = total_read = total_discarded = 0
            pretty = self.pretty_var.get()

            for i, evtx_file in enumerate(evtx_files, 1):
                safe_stem = (
                    evtx_file.stem
                    .replace("@", "-")
                    .replace(" ", "_")
                    .replace("%", "-")
                )

                self.status_var.set(f"[{i}/{total}] {evtx_file.name}")
                self.update_idletasks()

                try:
                    records, n_read, n_discarded = parse_evtx_file(
                        evtx_file, self._repo, cutoff
                    )
                    total_read += n_read
                    total_discarded += n_discarded

                    if not records:
                        self._log(f"[SKIP] {evtx_file.name} — nenhum evento relevante")
                        self.progress["value"] = i
                        continue

                    first_candidate = out_path / f"{safe_stem}.json"
                    if first_candidate.exists() and not self.overwrite_var.get():
                        self._log(f"[SKIP] {evtx_file.name} — já existe")
                        self.progress["value"] = i
                        continue

                    generated_files = save_records(
                        records, safe_stem, out_path, pretty, records_per_file
                    )

                    for fname in generated_files:
                        fpath = out_path / fname
                        fsize_mb = fpath.stat().st_size / (1024 * 1024)
                        self._log(f"[OK] {fname} — {fsize_mb:.1f}MB")

                    self._log(
                        f"     {evtx_file.name}: {len(records)} relevantes, "
                        f"{n_discarded} descartados de {n_read} lidos, "
                        f"{len(generated_files)} arquivo(s) gerado(s)"
                    )
                    ok += 1

                except Exception as exc:
                    self._log(f"[ERRO] {evtx_file.name}: {exc}")
                    erros += 1

                self.progress["value"] = i

            summary = (
                f"Concluído! {ok} arquivo(s) EVTX, {erros} erro(s). "
                f"Lidos: {total_read} | Descartados: {total_discarded} | "
                f"Mantidos: {total_read - total_discarded}"
            )
            self._log(f"\n{summary}")
            self._log(f"JSONs salvos em: {out_path}")
            self.status_var.set(summary)
            messagebox.showinfo(
                "Concluído",
                f"{ok} EVTX convertido(s).\n{erros} erro(s).\n\n"
                f"Eventos lidos:      {total_read}\n"
                f"Descartados:        {total_discarded}\n"
                f"Mantidos:           {total_read - total_discarded}\n\n"
                f"Saída: {out_path}"
            )
        finally:
            self._processing = False
            self.run_btn.configure(state="normal", text="  Converter  ")


# ---------------------------------------------------------------------------
# Utilitário de data
# ---------------------------------------------------------------------------

def _compute_cutoff(months: int) -> datetime:
    """
    Calcula a data de corte subtraindo N meses da data atual.

    Por que não usar timedelta(days=months*30)?
    Meses têm 28–31 dias — timedelta com dias fixos seria impreciso.
    A abordagem de subtrair meses do mês atual é a correta para períodos
    de retenção de dados (ex: "8 meses atrás" = mesmo dia, 8 meses antes).
    """
    now = datetime.now(tz=timezone.utc)
    # Subtrai meses: ajusta ano se o mês ficar negativo
    month = now.month - months
    year = now.year + (month - 1) // 12
    month = (month - 1) % 12 + 1
    # Usa o dia 1 do mês calculado como ponto de corte
    return now.replace(year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0)


if __name__ == "__main__":
    app = App()
    app.mainloop()