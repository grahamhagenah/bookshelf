interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const Layout = ({ children, title }: LayoutProps) => {
  return (
    <main className="w-full max-w-4xl mx-auto px-4 py-8 md:px-8 md:py-10">
      {/* The header breadcrumb already shows the page title */}
      {title ? <h1 className="sr-only">{title}</h1> : null}
      {/* Open sections split by hairlines rather than boxed cards */}
      <div className="divide-y divide-stone-100 dark:divide-stone-800 *:py-8 *:first:pt-0 *:last:pb-0">
        {children}
      </div>
    </main>
  );
};

export default Layout;
