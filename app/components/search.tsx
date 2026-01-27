import { SearchIcon } from './icons';

export default function Search() {
  return (
    <a
      href="/search"
      className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors mr-2"
    >
      <SearchIcon size={20} />
      <span>Search</span>
    </a>
  )
}
