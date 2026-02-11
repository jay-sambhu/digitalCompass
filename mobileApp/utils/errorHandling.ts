type AnyError = Error | string | unknown;

const toErrorMessage = (err: AnyError) => {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}\n${err.stack ?? "No stack trace"}`;
  }

  if (typeof err === "string") {
    return err;
  }

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

export function installGlobalErrorHandlers() {
  const hasErrorUtils =
    typeof globalThis !== "undefined" &&
    "ErrorUtils" in globalThis &&
    (globalThis as any).ErrorUtils?.setGlobalHandler;

  if (hasErrorUtils) {
    const errorUtils = (globalThis as any).ErrorUtils;
    const originalHandler = errorUtils.getGlobalHandler?.();

    errorUtils.setGlobalHandler((error: AnyError, isFatal?: boolean) => {
      console.error(
        `[FATAL:${Boolean(isFatal)}] Uncaught JS error:\n${toErrorMessage(error)}`
      );

      if (typeof originalHandler === "function") {
        originalHandler(error, isFatal);
      }
    });
  }

  const hasUnhandledRejectionHook =
    typeof globalThis !== "undefined" &&
    typeof (globalThis as any).addEventListener === "function";

  if (hasUnhandledRejectionHook) {
    (globalThis as any).addEventListener(
      "unhandledrejection",
      (event: { reason?: unknown }) => {
        console.error(
          `[UNHANDLED_PROMISE_REJECTION]\n${toErrorMessage(event?.reason)}`
        );
      }
    );
  }
}
