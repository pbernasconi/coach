"""AES-256-GCM for the Garmin tokens that Coach stores.

Format: "v1." + base64url(nonce[12] || ciphertext || tag[16]), without "=" padding.
The key is 32 random bytes, base64. It is in the GitHub secret GARMIN_TOKEN_KEY and in
~/.garminconnect/token_key on Paolo's Mac. Coach never has it.
"""

from __future__ import annotations

import base64
import binascii
import os
from pathlib import Path

PREFIX = "v1."
AAD = b"coach/garmin_tokens/v1"
DEFAULT_KEY_FILE = Path("~/.garminconnect/token_key")


class TokenKeyError(ValueError):
    """The key is missing or is not 32 bytes of base64."""


class DecryptError(ValueError):
    """The ciphertext is damaged, or it was made with a different key."""


def new_key() -> str:
    return base64.b64encode(os.urandom(32)).decode()


def parse_key(text: str) -> bytes:
    text = (text or "").strip()
    if not text:
        raise TokenKeyError("GARMIN_TOKEN_KEY is empty")
    try:
        raw = base64.b64decode(text, validate=True)
    except (binascii.Error, ValueError):
        try:
            raw = base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))
        except (binascii.Error, ValueError):
            raise TokenKeyError("GARMIN_TOKEN_KEY is not base64") from None
    if len(raw) != 32:
        raise TokenKeyError("GARMIN_TOKEN_KEY must be 32 bytes")
    return raw


def load_key(env: dict[str, str] | None = None, key_file: str | os.PathLike[str] | None = None) -> bytes:
    """GARMIN_TOKEN_KEY from the environment, else the key file (default ~/.garminconnect/token_key)."""
    env = os.environ if env is None else env
    text = env.get("GARMIN_TOKEN_KEY", "").strip()
    if text:
        return parse_key(text)
    path = Path(key_file or DEFAULT_KEY_FILE).expanduser()
    try:
        return parse_key(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise TokenKeyError(f"GARMIN_TOKEN_KEY is not set and {path} does not exist") from None


def save_key_file(key_b64: str, key_file: str | os.PathLike[str] | None = None) -> Path:
    """Write the key with mode 0600 in a 0700 directory. Refuses to replace an existing file."""
    path = Path(key_file or DEFAULT_KEY_FILE).expanduser()
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(key_b64 + "\n")
    return path


def encrypt(key: bytes, plaintext: str) -> str:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = os.urandom(12)
    sealed = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), AAD)
    return PREFIX + base64.urlsafe_b64encode(nonce + sealed).decode().rstrip("=")


def decrypt(key: bytes, token: str) -> str:
    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if not isinstance(token, str) or not token.startswith(PREFIX):
        raise DecryptError("unknown ciphertext format")
    body = token[len(PREFIX) :]
    try:
        blob = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
    except (binascii.Error, ValueError):
        raise DecryptError("ciphertext is not base64url") from None
    if len(blob) < 12 + 16:
        raise DecryptError("ciphertext is too short")
    try:
        return AESGCM(key).decrypt(blob[:12], blob[12:], AAD).decode("utf-8")
    except InvalidTag:
        raise DecryptError("wrong key or damaged ciphertext") from None
