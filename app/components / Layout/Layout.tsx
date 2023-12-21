const Layout =({children, title}) =>{
    return(
      <main className="w-1/2 mx-auto border p-8 rounded-xl shadow-sm mt-32">
        {title && 
          <h1 className="text-5xl font-bold mb-24">{title}</h1>
        }       
        {children}
      </main>
    )
}

export default Layout;