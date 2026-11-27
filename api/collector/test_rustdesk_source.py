# api/collector/test_rustdesk_source.py
import unittest

from .rustdesk_source import FileState, head_hash, read_new_lines


class MemoryFiles:
    """Arquivos remotos em memoria (o VPS de mentira)."""

    def __init__(self, **files: bytes) -> None:
        self.files = {k.replace("_1", ".1").replace("_jsonl", ".jsonl"): v for k, v in files.items()}

    def size(self, name):
        data = self.files.get(name)
        return None if data is None else len(data)

    def read(self, name, offset, length=None):
        data = self.files[name][offset:]
        return data if length is None else data[:length]


def lines(*items):
    return "".join(f'{{"n": {i}}}\n' for i in items).encode()


class ReadNewLinesTests(unittest.TestCase):
    def test_first_read_takes_last_week_and_the_current_file(self):
        files = MemoryFiles(avisos_jsonl=lines(3, 4), avisos_jsonl_1=lines(1, 2))
        result = read_new_lines(files, None)
        self.assertEqual(result.lines, ['{"n": 1}', '{"n": 2}', '{"n": 3}', '{"n": 4}'])
        self.assertEqual(result.state.offset, len(lines(3, 4)))
        self.assertEqual(result.state.head_hash, head_hash(files, "avisos.jsonl")[0])

    def test_incremental_read_only_returns_what_is_new(self):
        files = MemoryFiles(avisos_jsonl=lines(1, 2))
        state = read_new_lines(files, None).state
        files.files["avisos.jsonl"] += lines(3)
        result = read_new_lines(files, state)
        self.assertEqual(result.lines, ['{"n": 3}'])
        self.assertFalse(result.rotated)

    def test_partial_last_line_waits_for_the_next_cycle(self):
        files = MemoryFiles(avisos_jsonl=lines(1) + b'{"n": 2')
        result = read_new_lines(files, None)
        self.assertEqual(result.lines, ['{"n": 1}'])
        files.files["avisos.jsonl"] += b"}\n"
        self.assertEqual(read_new_lines(files, result.state).lines, ['{"n": 2}'])

    def test_rotation_finishes_the_old_file_then_restarts_the_new_one(self):
        files = MemoryFiles(avisos_jsonl=lines(1, 2))
        state = read_new_lines(files, None).state
        # Depois do ultimo ciclo chegou o 3, e entao o logrotate trocou o arquivo.
        files.files["avisos.jsonl.1"] = lines(1, 2, 3)
        files.files["avisos.jsonl"] = lines(4)
        result = read_new_lines(files, state)
        self.assertTrue(result.rotated)
        self.assertEqual(result.lines, ['{"n": 3}', '{"n": 4}'])
        self.assertEqual(result.state.offset, len(lines(4)))

    def test_rotation_detected_by_the_head_even_if_the_new_file_is_bigger(self):
        files = MemoryFiles(avisos_jsonl=lines(1))
        state = read_new_lines(files, None).state
        files.files["avisos.jsonl.1"] = lines(1)
        files.files["avisos.jsonl"] = lines(7, 8, 9)  # maior que o offset antigo
        result = read_new_lines(files, state)
        self.assertTrue(result.rotated)
        self.assertEqual(result.lines, ['{"n": 7}', '{"n": 8}', '{"n": 9}'])

    def test_missing_file_reads_nothing(self):
        result = read_new_lines(MemoryFiles(), FileState(10, "x"))
        self.assertEqual(result.lines, [])
        self.assertEqual(result.state, FileState(0, None, 0))

    def test_small_file_growing_is_not_a_rotation(self):
        files = MemoryFiles(avisos_jsonl=lines(1))
        state = read_new_lines(files, None).state
        files.files["avisos.jsonl"] += lines(*range(2, 60))  # passa de HEAD_BYTES
        result = read_new_lines(files, state)
        self.assertFalse(result.rotated)
        self.assertEqual(len(result.lines), 58)

    def test_nothing_new(self):
        files = MemoryFiles(avisos_jsonl=lines(1))
        state = read_new_lines(files, None).state
        result = read_new_lines(files, state)
        self.assertEqual((result.lines, result.state), ([], state))


if __name__ == "__main__":
    unittest.main()
