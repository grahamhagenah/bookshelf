import { Link, useMatches } from "@remix-run/react";
import HomeIcon from '@mui/icons-material/Home';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

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

export default function Breadcrumbs() {
  const matches = useMatches() as BreadcrumbMatch[];

  const allBreadcrumbs: { id: string; label: React.ReactNode; href?: string }[] = [];

  matches.forEach((match) => {
    // Support array of breadcrumbs
    if (match.handle?.breadcrumbs) {
      const crumbs = match.handle.breadcrumbs(match.data);
      crumbs.forEach((crumb, index) => {
        allBreadcrumbs.push({
          id: `${match.id}-${index}`,
          label: crumb.label,
          href: crumb.href,
        });
      });
    }
    // Support single breadcrumb
    else if (match.handle?.breadcrumb) {
      allBreadcrumbs.push({
        id: match.id,
        label: match.handle.breadcrumb(match.data),
      });
    }
  });

  if (allBreadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="px-4 md:px-8 py-3">
      <ol className="flex items-center gap-1 text-sm text-gray-600">
        <li>
          <Link
            to="/books"
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
          >
            <HomeIcon fontSize="small" />
            <span className="sr-only">Home</span>
          </Link>
        </li>
        {allBreadcrumbs.map((crumb, index) => {
          const isLast = index === allBreadcrumbs.length - 1;
          return (
            <li key={crumb.id} className="flex items-center gap-1">
              <ChevronRightIcon fontSize="small" className="text-gray-400" />
              {isLast ? (
                <span className="font-medium text-gray-900">{crumb.label}</span>
              ) : crumb.href ? (
                <Link to={crumb.href} className="hover:text-gray-900">
                  {crumb.label}
                </Link>
              ) : (
                <span className="hover:text-gray-900">{crumb.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
