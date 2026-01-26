import { SearchIcon } from './icons';

export default function Search() {
  return (
    <a
      href="/search"
      className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors mr-2"
    >
      <SearchIcon size={20} />
      <span>Search</span>
    </a>
  )
}
