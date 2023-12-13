
import { Form, Link } from "@remix-run/react";
import { useNavigate } from "@remix-run/react";
import { useState } from 'react';
import logo from "~/images/logo-alt.svg";

export default function Header() {

  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    navigate(`/search?query=${query}`);
  }

  return (
    <header className="w-full flex items-center justify-between">
      <h1 className="text-3xl font-bold">
        <Link to="/books">
          <img id="logo" src={logo}/>
        </Link>
      </h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      <button type="submit">Search</button>
    </form>
      <Form action="/logout" method="post">
        <button
          type="submit"
          className="rounded bg-slate-600 px-4 py-2 text-blue-100 hover:bg-blue-500 active:bg-blue-600"
        >
          Logout
        </button>
      </Form>
    </header>
)}