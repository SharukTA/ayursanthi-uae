import { after } from "next/server";

/**
 * Run a non-critical email send *after* the response has been flushed.
 *
 * On a serverless host the function can be frozen the instant the response is
 * sent, so a bare `sendSomething()` with no await is not merely non-blocking —
 * it may never run at all. `after()` from next/server schedules the work as
 * part of the request's lifetime without making the customer wait for it.
 *
 * Falls back to running inline when there is no request context (seed scripts,
 * tests), and swallows every failure: nothing here is worth breaking a
 * checkout or a status update over. sendEmail() has already logged the cause.
 *
 * @param {() => Promise<unknown>} task
 */
export function queueEmail(task) {
  const guarded = async () => {
    try {
      await task();
    } catch (error) {
      console.error("[email] queued send failed:", error?.message || error);
    }
  };

  try {
    after(guarded);
  } catch {
    // Not inside a request scope — just run it.
    void guarded();
  }
}
