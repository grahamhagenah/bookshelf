const Layout =({children, title}) =>{
    return(
      <main className="w-full p-0 mt-16 md:w-1/2 mx-auto md:p-8 md:mt-12">
        {title && 
          <h1 className="text-4xl p-4 mb-8 md:text-5xl font-bold md:mb-12"><span className="underline underline-offset-4 decoration-8 decoration-blue-400 dark:decoration-blue-100">{title}</span></h1>
        }       
        <div className="block gap-16">
          {children}
        </div>
      </main>
    )
}

export default Layout;