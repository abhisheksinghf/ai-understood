"""The same provider error type is shared by the CLI and both adapters."""
class ProviderError(Exception):
    def __init__(self, code, retryable=False, retry_after=1.0):
        super().__init__(code)
        self.code, self.retryable, self.retry_after = code, retryable, retry_after
