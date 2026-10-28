// The shared looks: a green button for the one main thing on a page, a
// quiet outlined one for everything beside it, both in three sizes; the
// text field every form uses; and a section's heading

const sizes = {
  sm: "px-2.5 py-1",
  md: "px-3 py-1.5",
  lg: "px-4 py-2",
} as const;
export type ButtonSize = keyof typeof sizes;

export const primaryButton = (size: ButtonSize = "lg") =>
  `rounded-md bg-forest-600 ${sizes[size]} text-sm font-medium text-white hover:bg-forest-700 transition-colors disabled:opacity-50`;

export const quietButton = (size: ButtonSize = "lg") =>
  `rounded-md border border-stone-200 dark:border-stone-700 ${sizes[size]} text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors disabled:opacity-50`;

export const textField =
  "w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors";

export const sectionHeading = "text-lg font-semibold text-stone-900 dark:text-stone-100";

// The page you're on, in the header: a soft wash of the app's green
// behind it, the icon and name in green
export const hereIcon =
  "bg-forest-600/10 text-forest-700 hover:bg-forest-600/15 dark:bg-forest-400/15 dark:text-forest-400 dark:hover:bg-forest-400/20 [&_svg]:text-forest-600 dark:[&_svg]:text-forest-400";
