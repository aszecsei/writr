/** Resolve on the next idle callback (or macrotask), letting the UI breathe between chunks of main-thread work. */
export function idle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}
