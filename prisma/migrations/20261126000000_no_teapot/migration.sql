-- The teapot picture is gone: anyone who chose it keeps their color, as a
-- bookplate of their initials
UPDATE "User" SET "profileEmoji" = 'plate:' || substr("profileEmoji", 8) WHERE "profileEmoji" LIKE 'teapot:%';
UPDATE "User" SET "profileEmoji" = NULL WHERE "profileEmoji" = 'teapot';
