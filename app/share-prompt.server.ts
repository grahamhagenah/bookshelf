// Whether to show the "Share your bookshelf" prompt is remembered in a
// cookie, so a dismissed prompt stays gone from the very first render

export const SHARE_PROMPT_COOKIE = "share-prompt=dismissed";

// The same for the welcome steps on a new account's home page
export const WELCOME_COOKIE = "welcome=dismissed";

function hasCookie(request: Request, cookie: string) {
  return (request.headers.get("Cookie") ?? "").split(/;\s*/).includes(cookie);
}

export function sharePromptDismissed(request: Request) {
  return hasCookie(request, SHARE_PROMPT_COOKIE);
}

export function welcomeDismissed(request: Request) {
  return hasCookie(request, WELCOME_COOKIE);
}

// A year-long cookie that puts a prompt away for good
export function dismissCookie(cookie: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookie}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${secure}`;
}
