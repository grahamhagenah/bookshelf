import { SearchIcon } from './icons';

export default function Search() {
  return (
    <a
      href="/search"
      aria-label="Search books"
      title="Search books"
      className="inline-flex items-center justify-center w-10 h-10 rounded-full text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <SearchIcon size={20} />
    </a>
  )
}
