# Puts the firmware version (the git commit, "+dirty" with local changes) in FW_VERSION, so the status page and
# Coach's Settings show which build a board runs.
import subprocess

Import("env")  # noqa: F821 (PlatformIO's SCons global)


def git(*args):
    try:
        return subprocess.check_output(["git", *args], cwd=env.subst("$PROJECT_DIR"), stderr=subprocess.DEVNULL).decode().strip()  # noqa: F821
    except Exception:
        return ""


version = git("rev-parse", "--short", "HEAD") or "dev"
if git("status", "--porcelain", "--", "src", "lib", "platformio.ini"):
    version += "+dirty"
env.Append(CPPDEFINES=[("FW_VERSION", env.StringifyMacro(version))])  # noqa: F821
