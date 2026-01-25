import { Link, useMatches } from "@remix-run/react";
import HomeIcon from '@mui/icons-material/Home';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface BreadcrumbMatch {
  id: string;
  pathname: string;
  handle?: {
    breadcrumb?: (data: unknown) => React.ReactNode;
  };
  data: unknown;
}

export default function Breadcrumbs() {
  const matches = useMatches() as BreadcrumbMatch[];

  const breadcrumbs = matches
    .filter((match) => match.handle?.breadcrumb)
    .map((match) => ({
      id: match.id,
      breadcrumb: match.handle!.breadcrumb!(match.data),
    }));

  if (breadcrumbs.length === 0) {
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
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.id} className="flex items-center gap-1">
            <ChevronRightIcon fontSize="small" className="text-gray-400" />
            <span className={index === breadcrumbs.length - 1 ? "font-medium text-gray-900" : "hover:text-gray-900"}>
              {crumb.breadcrumb}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
