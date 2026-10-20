#!/usr/bin/env python3
"""Garmin Connect login for the Coach sync. Run it on your own Mac.

  login.py --new-key     one time: make the encryption key, store it as the GitHub
                         secret GARMIN_TOKEN_KEY and in ~/.garminconnect/token_key
  login.py               log in (email, password, MFA) and store the tokens in Coach,
                         encrypted with that key
  login.py --from-local  store the tokens of ~/.garminconnect in Coach, with no new login

The password is used once and is never stored. The tokens are never printed. Coach
gets only ciphertext (AES-256-GCM); the key stays in GitHub and on this Mac.

Environment: CRON_SECRET (else the script asks for it), COACH_URL (default
https://coach.paolobernasconi.com), GARMIN_TOKEN_KEY (else --key-file).
"""

from __future__ import annotations

import argparse
import getpass
import os
import shutil
import subprocess
import sys

import tokencrypt

REPO = "pbernasconi/coach"
COACH_URL = "https://coach.paolobernasconi.com"


def gh_secret_set(name: str, value: str, repo: str) -> bool:
    """`gh secret set` reads the value from stdin when --body is not given. Nothing is echoed."""
    result = subprocess.run(["gh", "secret", "set", name, "--repo", repo], input=value, text=True, capture_output=True)
    if result.returncode != 0:
        print(f"`gh secret set {name}` failed: {result.stderr.strip()}", file=sys.stderr)
        return False
    print(f"Set the GitHub secret {name} on {repo}.")
    return True


def make_new_key(args: argparse.Namespace) -> int:
    path = os.path.expanduser(args.key_file or str(tokencrypt.DEFAULT_KEY_FILE))
    if os.path.exists(path):
        print(
            f"{path} exists already. A new key makes the tokens stored in Coach unreadable.\n"
            "To replace it on purpose, delete the file and run --new-key again, then run login.py.",
            file=sys.stderr,
        )
        return 3
    key = tokencrypt.new_key()
    if not gh_secret_set("GARMIN_TOKEN_KEY", key, args.repo):
        return 1
    tokencrypt.save_key_file(key, path)
    print(f"Saved the key to {path} (mode 0600).")
    print("The next Garmin workflow run moves the tokens from GARMIN_TOKENS into Coach. No new login is needed.")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--new-key", action="store_true", help="make the key, set GARMIN_TOKEN_KEY on GitHub, save it locally")
    p.add_argument("--key-file", default=None, help="key file (default ~/.garminconnect/token_key)")
    p.add_argument("--repo", default=REPO, help=f"GitHub repo for secrets (default {REPO})")
    p.add_argument("--coach-url", default=os.environ.get("COACH_URL", COACH_URL))
    p.add_argument("--from-local", action="store_true", help="store the tokens in ~/.garminconnect in Coach; no new login")
    p.add_argument("--no-coach", action="store_true", help="do not store the tokens in Coach")
    p.add_argument("--github-secret", action="store_true", help="also store the plain token JSON as the GitHub secret GARMIN_TOKENS (the old path)")
    p.add_argument("--keep-local", action="store_true", help="also save the tokens to ~/.garminconnect for local dry runs")
    args = p.parse_args(argv)

    needs_gh = args.new_key or args.github_secret
    if needs_gh and not shutil.which("gh"):
        print("gh CLI not found. Install it and run `gh auth login` first.", file=sys.stderr)
        return 3
    if args.new_key:
        return make_new_key(args)

    key = None
    secret = ""
    if not args.no_coach:
        try:
            key = tokencrypt.load_key(key_file=args.key_file)
        except tokencrypt.TokenKeyError as e:
            print(f"{e}. Run `login.py --new-key` first.", file=sys.stderr)
            return 3
        secret = os.environ.get("CRON_SECRET", "").strip() or getpass.getpass("Coach CRON_SECRET (not stored): ").strip()
        if not secret:
            print("CRON_SECRET is required to store the tokens in Coach (or use --no-coach).", file=sys.stderr)
            return 3

    if args.from_local and args.no_coach:
        print("--from-local stores the tokens in Coach, so it cannot be used with --no-coach.", file=sys.stderr)
        return 3

    import garminconnect

    if args.from_local:
        api = garminconnect.Garmin()
        try:
            # Checks the tokens against Garmin (and refreshes them if they are near expiry).
            api.login(os.path.expanduser("~/.garminconnect"))
        except Exception as e:  # noqa: BLE001
            print(f"The local tokens do not work ({type(e).__name__}). Run login.py without --from-local.", file=sys.stderr)
            return 2
        return store(args, api.client.dumps(), key, secret, api.display_name)

    # The library also reads GARMINTOKENS; ignore it so this is a fresh login.
    os.environ.pop("GARMINTOKENS", None)
    email = input("Garmin email: ").strip()
    password = getpass.getpass("Garmin password (not stored): ")
    api = garminconnect.Garmin(email=email, password=password, prompt_mfa=lambda: input("Garmin MFA code: ").strip())
    del password
    try:
        api.login()
    except garminconnect.GarminConnectTooManyRequestsError:
        print("Garmin rate-limited the login. Wait 15-30 minutes and try again.", file=sys.stderr)
        return 2
    except Exception as e:  # noqa: BLE001
        print(f"Login failed: {type(e).__name__}: {e}", file=sys.stderr)
        return 2
    if args.keep_local:
        api.client.dump(os.path.expanduser("~/.garminconnect"))
        print("Saved the tokens to ~/.garminconnect/garmin_tokens.json (mode 0600).")
    return store(args, api.client.dumps(), key, secret, api.display_name)


def store(args: argparse.Namespace, tokens: str, key: bytes | None, secret: str, name: str | None) -> int:
    print(f"Logged in as {name or 'unknown'}.")
    code = 0
    if key is not None:
        from coach_api import Coach, CoachError

        try:
            Coach(args.coach_url, secret).put_state(
                tokens_ciphertext=tokencrypt.encrypt(key, tokens), status="ok", last_error=None
            )
            print(f"Stored the tokens in Coach ({args.coach_url}), encrypted.")
        except CoachError as e:
            print(f"Could not store the tokens in Coach: {e}", file=sys.stderr)
            code = 1
    if args.github_secret and not gh_secret_set("GARMIN_TOKENS", tokens, args.repo):
        code = 1
    return code


if __name__ == "__main__":
    sys.exit(main())
