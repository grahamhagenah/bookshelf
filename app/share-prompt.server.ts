// Whether to show the "Share your bookshelf" prompt is remembered in a
// cookie, so a dismissed prompt stays gone from the very first render

export const SHARE_PROMPT_COOKIE = "share-prompt=dismissed";

export function sharePromptDismissed(request: Request) {
  return (request.headers.get("Cookie") ?? "")
    .split(/;\s*/)
    .includes(SHARE_PROMPT_COOKIE);
}
