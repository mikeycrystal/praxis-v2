-- Build 117: guest notifications — tokens can exist before an account does.
-- A guest device registers with user_id NULL; signing in claims the token.

ALTER TABLE public.push_tokens ALTER COLUMN user_id DROP NOT NULL;

-- NULL user_ids are distinct under the UNIQUE(user_id, token) constraint,
-- so guest tokens need their own uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_guest_token_key
  ON public.push_tokens (token) WHERE user_id IS NULL;

-- Guests (anon role) may register and drop their own device token,
-- but never touch rows that belong to an account.
CREATE POLICY "Guests register device tokens" ON public.push_tokens
  FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "Guests remove device tokens" ON public.push_tokens
  FOR DELETE TO anon USING (user_id IS NULL);

-- Signing in claims the device's guest token.
CREATE POLICY "Users claim guest tokens" ON public.push_tokens
  FOR UPDATE TO authenticated
  USING (user_id IS NULL)
  WITH CHECK (user_id = auth.uid());
