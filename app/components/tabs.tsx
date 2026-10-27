import { NavLink } from "react-router";

// A row of tabs over a rule, with room across from them for the page's own
// actions: My shelf's lists, the Friends page's views. Words only: the
// header's links carry the icons.

export interface Tab {
  to: string;
  label: string;
  // Left out when there's none to show
  count?: number | null;
  // Only the exact address, not the pages under it
  end?: boolean;
}

// The same weight either way, so switching tabs never nudges the others
const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 whitespace-nowrap border-b-2 px-1 pb-2.5 font-medium transition-colors ${
    isActive
      ? "border-stone-900 dark:border-stone-100 text-stone-900 dark:text-stone-100"
      : "border-transparent text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600 hover:text-stone-800 dark:hover:text-stone-200"
  }`;

export default function Tabs({
  label,
  tabs,
  children,
}: {
  label: string;
  tabs: Tab[];
  // Across from the tabs
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start gap-3 border-b border-stone-200 dark:border-stone-800">
      <nav
        aria-label={label}
        // Down over the rule, so the current tab's underline covers it
        className="-mb-px flex min-w-0 flex-1 gap-5 sm:gap-6 overflow-x-auto [scrollbar-width:none]"
      >
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClass}>
            {tab.label}
            {tab.count != null ? (
              <span className="font-normal text-stone-400 dark:text-stone-500">{tab.count}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      {children}
    </div>
  );
}
