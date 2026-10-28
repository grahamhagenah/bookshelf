-- A loan can be hidden from the lender's History or the borrower's, each
-- on its own. Added as columns, so the table isn't rebuilt.
ALTER TABLE "LendingHistory" ADD COLUMN "hiddenByLender" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LendingHistory" ADD COLUMN "hiddenByBorrower" BOOLEAN NOT NULL DEFAULT false;
