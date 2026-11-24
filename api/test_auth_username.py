# test_auth_username.py
"""current_username(): usuario do token para a trilha de auditoria."""
import os
import sys
import types
import unittest

os.environ.setdefault("JWT_SECRET", "segredo-so-para-teste-com-mais-de-32-bytes")

# `db` abre o pool de conexoes ja no import; aqui nao queremos banco nenhum.
sys.modules.setdefault(
    "db",
    types.SimpleNamespace(get_connection=lambda: None, release_connection=lambda *a, **k: None),
)

from flask import Flask  # noqa: E402

from routes import auth  # noqa: E402


class CurrentUsernameTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)

    def _username_with(self, header):
        headers = {"Authorization": header} if header is not None else {}
        with self.app.test_request_context("/", headers=headers):
            return auth.current_username()

    def test_returns_sub_of_valid_token(self):
        token = auth._generate_access_token("joao")
        self.assertEqual(self._username_with(f"Bearer {token}"), "joao")

    def test_none_without_header(self):
        self.assertIsNone(self._username_with(None))

    def test_none_with_wrong_scheme(self):
        token = auth._generate_access_token("joao")
        self.assertIsNone(self._username_with(f"Basic {token}"))

    def test_none_with_garbage_token(self):
        self.assertIsNone(self._username_with("Bearer isto-nao-e-um-jwt"))

    def test_none_with_token_signed_by_other_secret(self):
        import jwt
        forged = jwt.encode({"sub": "intruso"}, "outro-segredo-tambem-com-mais-de-32-bytes", algorithm="HS256")
        self.assertIsNone(self._username_with(f"Bearer {forged}"))


if __name__ == "__main__":
    unittest.main()
