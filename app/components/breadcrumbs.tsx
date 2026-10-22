import { Link, useMatches } from "@remix-run/react";

interface BreadcrumbItem {
  label: React.ReactNode;
  href?: string;
}

interface BreadcrumbMatch {
  id: string;
  pathname: string;
  handle?: {
    breadcrumb?: (data: unknown) => React.ReactNode;
    breadcrumbs?: (data: unknown) => BreadcrumbItem[];
  };
  data: unknown;
}

function useBreadcrumbs() {
  const matches = useMatches() as BreadcrumbMatch[];
  const crumbs: { id: string; label: React.ReactNode; href?: string }[] = [];

  matches.forEach((match) => {
    // Support array of breadcrumbs
    if (match.handle?.breadcrumbs) {
      match.handle.breadcrumbs(match.data).forEach((crumb, index) => {
        crumbs.push({ id: `${match.id}-${index}`, label: crumb.label, href: crumb.href });
      });
    }
    // Support single breadcrumb
    else if (match.handle?.breadcrumb) {
      crumbs.push({ id: match.id, label: match.handle.breadcrumb(match.data) });
    }
  });

  return crumbs;
}

// "Friends / Priya Patel / Jonathan Strange & Mr Norrell", in a quiet row
// of its own under the header, where a long book title has room. The
// current page is the darkest; on phones, earlier steps give way to it.
export default function Breadcrumbs() {
  const crumbs = useBreadcrumbs();
  // A lone page name isn't a trail; top-level pages say where you are
  // themselves
  if (crumbs.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className="px-4 md:px-8 pt-4 md:pt-5 -mb-2 md:-mb-4">
      <ol className="flex min-w-0 items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li
              key={crumb.id}
              className={`flex min-w-0 items-center gap-2 ${isLast ? "" : "max-w-[40%] flex-shrink-0 sm:max-w-none"}`}
            >
              {index > 0 ? (
                <span aria-hidden="true" className="text-stone-300 dark:text-stone-600">/</span>
              ) : null}
              {isLast ? (
                <span aria-current="page" className="truncate font-medium text-stone-900 dark:text-stone-100">
                  {crumb.label}
                </span>
              ) : crumb.href ? (
                <Link to={crumb.href} className="truncate hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate [&_a]:hover:text-stone-900 dark:[&_a]:hover:text-stone-100">{crumb.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
