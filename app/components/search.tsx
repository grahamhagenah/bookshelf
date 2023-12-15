import { useNavigate } from "@remix-run/react";
import { useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';

export default function Search() {

  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    if(query !== ''){
      navigate(`/search?query=${query}`);
    }
  }
  
  return (
    <form className="primary-search rounded-lg" onSubmit={handleSubmit}>
      <SearchIcon />
      <input
        type="text"
        placeholder={"Search for books..."}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    <button type="submit" className="rounded-lg">Search</button>
  </form>
  )
}