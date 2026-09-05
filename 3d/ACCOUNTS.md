# Turning on accounts

Without this, the journal saves what you write on the device you wrote it on.
That is why it works with no internet, and it is also why writing on a laptop
does not appear on a phone — nothing is storing it anywhere else.

Accounts need a database. This uses [Supabase](https://supabase.com), whose free
tier is far more than this needs. **The project should belong to the journal's
owner, not to me** — it holds people's private journals, and the owner should be
able to take it elsewhere at any time.

## 1. Make the project

1. Sign up at supabase.com, click **New Project**, any name, any nearby region.
2. When it has finished building, open **Project Settings → API**.
3. Copy the **Project URL** and the key labelled **anon public**.

> The `anon public` key is meant to be published — it is what the web page uses,
> and the policy in step 2 is what actually protects the data.
> The **`service_role`** key on that same page is the master key. It must never
> be put in a web page, emailed, or committed.

## 2. Make the table

**SQL Editor → New query**, paste this, Run:

```sql
create table if not exists public.entries (
  user_id    uuid        not null references auth.users on delete cascade,
  page       int         not null,
  body       text        not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, page)
);

alter table public.entries enable row level security;

-- One policy, and it is the whole of the security model: a signed-in reader can
-- see and change their own rows and nothing else. `with check` matters as much
-- as `using` — without it somebody could write a row under another user's id.
create policy "own entries" on public.entries
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## 3. Point the journal at it

In `3d/config.js`:

```js
window.JOURNAL_CLOUD = window.JOURNAL_CLOUD || {
  url: 'https://YOURPROJECT.supabase.co',
  anonKey: 'the anon public key'
};
```

That is the whole switch. With those two values empty the sign-in screen never
appears and nothing changes; with them filled in it appears on load.

## 4. Allow the journal's address back in

**Authentication → URL Configuration**:

- **Site URL**: `https://becomingyourself.github.io/journey-to-me/3d/`
- **Redirect URLs**: add the same address.

This matters for the "forgotten your password" link. Supabase will only send
someone back to an address on that list — leave it out and it falls back to the
Site URL instead, silently. Add every address the journal is served from,
including a custom domain later on.

> **Type the address, or copy it from the browser's address bar. Never paste a
> link copied out of a chat window.**
>
> Freelancer (and Slack, and most chat tools) rewrite outbound links to point at
> their own redirector. Pasting one of those in here set the Site URL to
> `https://www.freelancer.com/users/l.php?url=…&sig=…`, so every reset link went
> Supabase → Freelancer's "you'll be redirected in 5 seconds" page → the
> journal. That page **drops the `#fragment`**, which is where the token lives,
> so the reader always arrived with nothing and saw a plain sign-in screen.
>
> It cost two rounds of guessing to find, because from the outside it looks
> exactly like clicking the wrong email. The one command that settles it:
>
> ```
> curl -sD - -o /dev/null \
>   "https://PROJECT.supabase.co/auth/v1/verify?token=bogus&type=recovery&redirect_to=YOUR_URL" \
>   | grep -i '^location'
> ```
>
> Whatever that `location:` header says is where every reset link really goes.

## 5. Decide about confirmation emails

**Authentication → Providers → Email** has *Confirm email* on by default. Leave
it on and people must click a link before they can sign in — safer, but it needs
email delivery set up before it is reliable. Turn it off and they are signed in
the moment they register. The journal handles both: if signing up returns no
token it says so and asks them to check their email.

## How it behaves

- Writing is saved to the device on every keystroke, and queued to the account,
  which is sent after a short pause. Losing the connection loses nothing.
- **Signing in on a device that already has writing on it merges rather than
  overwrites.** A page the account has not seen is uploaded; a page the account
  already has wins, because it may have been written elsewhere since. Where the
  local copy is the account's copy with more added to the end, the longer one
  wins. Nothing is ever silently dropped.
- **Signing out wipes the local copy**, because by then it lives in the account
  and the next person to open the journal on a shared computer must not find it.
- Someone who would rather not have an account can choose *Just use this device*
  and get exactly the old behaviour. **That choice is remembered** — otherwise
  the journal asks the same question every single time it is opened, which is
  the fastest way to make somebody stop opening it. A *Sign in* link stays in
  the corner so it is never a one-way door.
- **Which email to open.** The reset mail arrives from Supabase with the
  subject **"Reset Your Password"**. An inbox will hold other mail carrying the
  journal's name — notification emails and so on — whose links are just the
  journal's ordinary address with no token on the end, and clicking one of those
  lands on a plain sign-in screen with no explanation. The app now names the
  subject line when it sends, so there is nothing to guess at.
- **Forgotten passwords**: the reset email comes back to this page with the new
  session in the URL *fragment* (`#access_token=…&type=recovery`). A fragment
  never reaches a server and is not in `location.search`; the journal reads it,
  keeps it, and scrubs it out of the address bar so the token is not left in
  browser history. The form then asks for a new password instead of an old one.
  The reply is always "if there is an account for that address…", whether or not
  there is one — otherwise the form becomes a way of finding out who has
  registered.
