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

// Renders "/ Friends / Maya Chen" next to the logo. On phones only the
// current page is shown so the header stays on one line.
export default function Breadcrumbs() {
  const crumbs = useBreadcrumbs();
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-2 text-sm sm:text-base text-stone-400 dark:text-stone-500 min-w-0">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li
              key={crumb.id}
              className={`items-center gap-2 min-w-0 ${isLast ? "flex" : "hidden md:flex"}`}
            >
              <span aria-hidden="true" className="text-stone-300 dark:text-stone-700">/</span>
              {isLast ? (
                <span aria-current="page" className="truncate text-stone-900 dark:text-stone-100">
                  {crumb.label}
                </span>
              ) : crumb.href ? (
                <Link to={crumb.href} className="truncate hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate hover:text-stone-900 dark:hover:text-stone-100 transition-colors">{crumb.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
