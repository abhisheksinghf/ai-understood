"""Optional live Responses API adapter; imported only by explicit --live.

The default transport is HTTPS. Tests inject a fake transport, never credentials.
"""
import json
import math
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from app import load_json
from errors import ProviderError

ENDPOINT = "https://api.openai.com/v1/responses"


class OpenAIProvider:
    def __init__(self, api_key, model, transport=urlopen):
        self.api_key, self.model, self.transport = api_key, model, transport

    @classmethod
    def from_environment(cls):
        key = os.environ.get("OPENAI_API_KEY", "").strip()
        model = os.environ.get("OPENAI_MODEL", "").strip()
        if not key or not model:
            raise ValueError("Set OPENAI_API_KEY and OPENAI_MODEL locally before --live.")
        return cls(key, model)

    def generate(self, payload):
        request = Request(ENDPOINT, data=json.dumps(payload).encode("utf-8"),
                          headers={"Authorization": "Bearer " + self.api_key,
                                   "Content-Type": "application/json"}, method="POST")
        try:
            with self.transport(request, timeout=30) as response:
                return load_json(response.read().decode("utf-8"))
        except HTTPError as error:
            # Do not log error bodies: they may echo sensitive inputs.
            code = ""
            try:
                body = load_json(error.read().decode("utf-8"))
                if isinstance(body, dict) and isinstance(body.get("error"), dict):
                    code = body["error"].get("code", "")
            except (ValueError, UnicodeError):
                pass
            transient = error.code in (500, 502, 503, 504) or (
                error.code == 429 and code in ("rate_limit_exceeded", "slow_down"))
            delay = 1.0
            header = error.headers.get("Retry-After") if error.headers else None
            if header is not None:
                try:
                    delay = float(header)
                    if not math.isfinite(delay) or not 0 <= delay <= 10:
                        transient = False
                except ValueError:
                    transient = False  # date-form/unknown delay: let caller retry later
            raise ProviderError("http_" + str(error.code), transient, delay) from None
        except (TimeoutError, URLError):
            raise ProviderError("connection_or_timeout", True) from None
        except (ValueError, UnicodeError):
            raise ProviderError("bad_api_json") from None
