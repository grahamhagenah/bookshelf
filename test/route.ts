// Calling a route's loader or action straight from a test

// The arguments React Router hands a loader or action for a request
export function routeArgs(request: Request, params: Record<string, string> = {}) {
  return { request, params, context: {}, url: new URL(request.url), pattern: "" };
}

// What a loader or action returned: a Response, or data() with its own
// status (200 when it set none)
export function statusOf(result: unknown) {
  if (result instanceof Response) return result.status;
  const init = (result as { init?: ResponseInit | null } | null)?.init;
  return init?.status ?? 200;
}

export async function bodyOf(result: unknown) {
  if (result instanceof Response) return result.json();
  return (result as { data: unknown }).data;
}
