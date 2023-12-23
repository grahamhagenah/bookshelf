import { useNavigate } from "@remix-run/react";
import { useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';

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
    <form className="primary-search relative w-96 relative md:flex mt-4 md:mt-0 justify-between md:mr-3" onSubmit={handleSubmit}>
      <SearchIcon />
      <input
        className="w-full rounded-lg border-2 p-2 pl-10 pr-20"
        type="text"
        placeholder={"Add books to your library..."}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    <button type="submit" className="h-full hover:text-cyan-800 rounded-r-lg active:bg-sky-100 absolute right-0 my-auto">Search</button>
  </form>
  )
}