interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const Layout = ({ children, title }: LayoutProps) => {
    return(
      <main className="w-full max-w-4xl mx-auto px-4 py-8 md:px-8 md:py-12">
        {title &&
          <h1 className="text-3xl md:text-4xl font-bold mb-8">{title}</h1>
        }
        <div className="space-y-8">
          {children}
        </div>
      </main>
    )
}

export default Layout;