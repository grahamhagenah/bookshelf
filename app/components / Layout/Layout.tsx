const Layout =({children, title}) =>{
    return(
      <main className="w-1/3 mx-auto">
        <h1 className="text-5xl font-bold mb-24">{title}</h1>
        {children}
      </main>
    )
}

export default Layout;