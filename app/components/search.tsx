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
    <form className="primary-search w-96 rounded-lg relative md:flex mt-4 md:mt-0 justify-between md:mr-3" onSubmit={handleSubmit}>
      <SearchIcon />
      <input
        className="w-full"
        type="text"
        placeholder={"Add books to your library..."}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    <button type="submit" className="rounded-lg">Search</button>
  </form>
  )
}