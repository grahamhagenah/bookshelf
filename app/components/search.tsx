import { SearchIcon } from './icons';

export default function Search() {
  return (
    <a
      href="/search"
      aria-label="Search books"
      title="Search books"
      className="inline-flex items-center justify-center w-9 h-9 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
    >
      <SearchIcon size={20} />
    </a>
  )
}
