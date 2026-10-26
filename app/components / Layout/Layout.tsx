interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  // Beside the sections on wide screens
  aside?: React.ReactNode;
  // Above everything, across the page: a row of tabs
  header?: React.ReactNode;
}

const Layout = ({ children, title, aside, header }: LayoutProps) => {
  return (
    <main
      className={`w-full max-w-[var(--page-max,64rem)] mx-auto px-4 py-8 md:px-8 md:py-10 ${
        aside ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] lg:gap-x-14" : ""
      }`}
    >
      {/* The header breadcrumb already shows the page title */}
      {title ? <h1 className="sr-only">{title}</h1> : null}
      {header ? <div className="lg:col-span-2">{header}</div> : null}
      {/* Open sections split by hairlines rather than boxed cards */}
      <div className="min-w-0 divide-y divide-stone-100 dark:divide-stone-800 *:py-8 *:first:pt-0 *:last:pb-0">
        {children}
      </div>
      {aside}
    </main>
  );
};

export default Layout;
