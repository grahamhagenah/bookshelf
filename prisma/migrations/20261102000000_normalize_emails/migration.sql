-- Emails were stored as typed at signup but looked up lowercased and
-- trimmed at login, so "Jane@Gmail.com" could never log in again. Store
-- every address that way. Accounts that would collide with another once
-- normalized are left alone, rather than failing the migration; they need
-- a person to decide which account to keep.
UPDATE "User"
SET "email" = lower(trim("email"))
WHERE "email" <> lower(trim("email"))
  AND NOT EXISTS (
    SELECT 1 FROM "User" AS "other"
    WHERE "other"."id" <> "User"."id"
      AND lower(trim("other"."email")) = lower(trim("User"."email"))
  );
