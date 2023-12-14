import { useNavigate } from "@remix-run/react";
import { useState } from 'react';

export default function Search() {

  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    navigate(`/search?query=${query}`);
  }

  return (
    <form className="primary-search rounded-lg" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Search for books..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    <button type="submit" className="rounded-lg">Search</button>
  </form>
  )
}