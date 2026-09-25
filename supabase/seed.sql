-- HALIYA menu — run: npm run menu:seed
-- Or apply full setup: npm run db:setup

UPDATE profiles
SET role = 'owner', full_name = 'HALIYA Admin'
WHERE email = 'jandominiksamaranos1231@gmail.com';
