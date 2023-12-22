const Layout =({children, title}) =>{
    return(
      <main className="w-full p-0 md:w-8/12 mx-auto md:p-8 md:mt-24">
        {title && 
          <h1 className="text-3xl md:text-5xl font-bold mb-24">{title}</h1>
        }       
        {children}
      </main>
    )
}

export default Layout;