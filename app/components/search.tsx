import { useNavigate } from "@remix-run/react";
import { useState } from 'react';
import { SearchIcon } from './icons';

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    if(query !== ''){
      navigate(`/search?q=${query}`);
    }
  }

  return (
    <form className="relative w-96 flex mt-4 md:mt-0 md:mr-3" onSubmit={handleSubmit}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <SearchIcon size={20} />
      </div>
      <input
        className="w-full rounded-lg border-2 p-2 pl-10 pr-20"
        type="text"
        placeholder="Add books to your library..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-blue-600 font-medium">
        Search
      </button>
    </form>
  )
}
