// The page a request is for. React Router's data requests carry its own
// additions (a ".data" suffix, ?_routes, a bare ?index), which it no
// longer takes off request.url; this takes them off, as it used to.
export function pageUrl(request: Request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith(".data")) {
    let path = url.pathname.slice(0, -".data".length);
    // "/_root.data" and "/_.data" are the home page; "/a/b/_.data" is "/a/b/"
    if (path === "/_root" || path === "/_") path = "/";
    else if (path.endsWith("/_")) path = path.slice(0, -1);
    url.pathname = path;
  }
  url.searchParams.delete("_routes");
  if (url.searchParams.get("index") === "") url.searchParams.delete("index");
  return url;
}
