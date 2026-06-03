-- Add password hash storage to users for secure login

ALTER TABLE users
  ADD COLUMN password_hash TEXT;
