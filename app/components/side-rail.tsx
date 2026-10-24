import { Link } from "@remix-run/react";

import Avatar from "./avatar";
import { LoanList } from "./home";
import type { HomeBook, Person } from "./home";

// Beside a page's main column on wide screens: who you're following, then
// your loans both ways. The same shape as the home page, mirrored. Hidden
// on phones, where the column has the whole width.

export interface Friend {
  id: string;
  firstname: string;
  surname: string;
  profileEmoji: string | null;
}

type Loan = HomeBook & { owner?: Person | null; borrower?: Person | null };

export interface SideRailProps {
  // Left out on pages where the loans would be noise
  loans?: { borrowed: Loan[]; lent: Loan[] };
  friends: Friend[];
  // A page's own section, after the loans
  children?: React.ReactNode;
}

// A glance, not the whole ledger: the home page has every loan
const FEW = 4;

export default function SideRail({ loans, friends, children }: SideRailProps) {
  const heading = "text-lg font-semibold text-stone-900 dark:text-stone-100";
  const link =
    "text-sm text-stone-500 dark:text-stone-400 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100 hover:underline";
  const anyLoans = loans ? loans.borrowed.length + loans.lent.length > 0 : false;
  const more = loans
    ? Math.max(0, loans.borrowed.length - FEW) + Math.max(0, loans.lent.length - FEW)
    : 0;

  return (
    <aside className="hidden space-y-10 self-start lg:block">
      <section aria-labelledby="rail-friends">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="rail-friends" className={heading}>
            Friends
            <span className="ml-1.5 text-sm font-normal text-stone-400 dark:text-stone-500">
              {friends.length}
            </span>
          </h2>
          <Link to="/friends" className={link}>
            {friends.length > 0 ? "See all" : "Find friends"}
          </Link>
        </div>
        {friends.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {friends.slice(0, 12).map((friend) => (
              <li key={friend.id}>
                <Link
                  to={`/friend/${friend.id}`}
                  title={`${friend.firstname} ${friend.surname}`}
                  className="block rounded-full ring-2 ring-transparent hover:ring-stone-300 dark:hover:ring-stone-600 transition-shadow"
                >
                  <Avatar
                    firstname={friend.firstname}
                    surname={friend.surname}
                    icon={friend.profileEmoji}
                    size="md"
                  />
                  <span className="sr-only">
                    {friend.firstname} {friend.surname}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-400 dark:text-stone-500">
            Friends&apos; books show up here once you have some.
          </p>
        )}
      </section>

      {loans && anyLoans ? (
        <section aria-labelledby="rail-loans">
          <h2 id="rail-loans" className={`${heading} mb-3`}>
            Loans
          </h2>
          <div className="space-y-6">
            {loans.borrowed.length > 0 ? (
              <LoanList
                id="rail-borrowing"
                title="Borrowing"
                books={loans.borrowed
                  .slice(0, FEW)
                  .map((book) => ({ book, person: book.owner ?? null }))}
                personLabel="From"
                empty=""
              />
            ) : null}
            {loans.lent.length > 0 ? (
              <LoanList
                id="rail-lent"
                title="Lent out"
                books={loans.lent
                  .slice(0, FEW)
                  .map((book) => ({ book, person: book.borrower ?? null }))}
                personLabel="To"
                empty=""
              />
            ) : null}
          </div>
          {more > 0 ? (
            <Link to="/#loans" className={`mt-3 inline-block ${link}`}>
              {more} more on your home page
            </Link>
          ) : null}
        </section>
      ) : null}
      {children}
    </aside>
  );
}
