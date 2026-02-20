# Gmail Integration — Production Checklist

What you need to do in **Google Cloud Console** and elsewhere to make Gmail sync production-ready.

---

## 1. Google Cloud Console (required)

### 1.1 Enable Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select the **same project** you use for Supabase Google Auth (and Drive).
3. **APIs & Services** → **Library** → search **"Gmail API"** → **Enable**.

Without this, Gmail API calls will fail with "Gmail API has not been used in project before" (or 403).

### 1.2 OAuth consent screen (required for the new scope)

1. **APIs & Services** → **OAuth consent screen**.
2. Under **Scopes**:
   - Click **Add or remove scopes**.
   - Add: `https://www.googleapis.com/auth/gmail.readonly` (Read your email messages and settings).
   - Save.

Your app already requests this scope in code; Google must know the project is allowed to use it.

### 1.3 No new OAuth client needed

You keep using the **existing** OAuth 2.0 Client ID (Web application) that Supabase uses for Google login. Same Client ID and Secret in Supabase → Authentication → Providers → Google.

---

## 2. Supabase (no code change; optional check)

- **Authentication** → **Providers** → **Google**: Client ID and Client Secret from the same Google Cloud project.
- Supabase forwards the scopes your app sends in `signInWithOAuth` (Drive + Gmail readonly). No extra config required for scopes if the frontend already sends them (it does).

---

## 3. Production: “External” vs “Internal” (Gmail is sensitive)

`gmail.readonly` is a **restricted** scope. How you proceed depends on app type:

| App type | What to do |
|----------|------------|
| **Internal** (only your Google Workspace org) | No verification. Add the scope (step 1.2), enable Gmail API (1.1), and you’re good. |
| **External** (anyone with a Google account) | Until the app is verified, only **test users** (added in OAuth consent screen) can grant Gmail. Max **100 test users** in Testing mode. |

---

## 4. Google verification (for External apps, 2025–2026)

### Why you need to add user Gmails in Google Console

- Your app is **External** and in **Testing** mode.
- Restricted scopes (like Gmail) are only available to users you add as **Test users**: **APIs & Services → OAuth consent screen → Test users**.
- That list is capped at **100 users**. No verification needed while you stay in Testing and under 100.

### How to pass verification (when you need more than 100 or any Google user)

Verification is the process where Google approves your app to request Gmail from **any** Google user, without adding them as test users.

**Rough timeline (2024–2025):**

1. **Brand verification** — 2–3 business days: App name, logo, homepage, privacy policy, domain ownership (Search Console). [Submit](https://support.google.com/cloud/answer/13461325).
2. **Scope justification** — ~10 business days: Explain how you use Gmail (e.g. read-only sync, store in DB for RAG). Demo video (unlisted YouTube): consent flow + how the scope is used.
3. **Security assessment** (often required for Gmail) — up to ~6 weeks: Because your app **stores** email content (e.g. in Supabase), Google typically requires an **annual third-party security assessment** ([App Defense Alliance / CASA](https://appdefensealliance.dev/)). Done by a Google-approved assessor; there is a cost. After approval, **re-verify every 12 months** if you keep using restricted scopes.

**Links:** [OAuth App Verification](https://support.google.com/cloud/answer/9110914) · [Submitting for verification](https://support.google.com/cloud/answer/13461325) · [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)

### When it makes sense for you

| Situation | Recommendation |
|-----------|----------------|
| Only your team / one organization (Google Workspace) | Use **Internal** app. No test users, no verification, no 100-user limit. |
| External, under 100 users who need Gmail | Stay in **Testing**, add each user as **Test user**. No verification. |
| External, 100+ users or "anyone can sign up" | Plan **verification** (brand, scope justification, security assessment). Start ~2–3 months before you need to go beyond 100. |
| External, Gmail only for a few power users | Keep them as test users; don't verify until you need scale. |

**Practical path in 2026:** Enable Gmail API and add the scope (steps 1.1–1.2). Add the Gmail addresses of everyone who needs Gmail as **Test users** (up to 100). They sign out, sign in again, grant Gmail — no verification. When you outgrow 100 or want open signup, prepare branding, privacy policy, demo video, then submit for verification and (if asked) the security assessment.

---

1. **Short term:** Add each production user’s Google account as a **Test user** under OAuth consent screen (max 100). They will be able to grant Gmail access.
## 5. Environment / config (you already have most of this)

- **Frontend:** `VITE_GOOGLE_CLIENT_ID` (and optionally `VITE_GOOGLE_API_KEY` for Drive picker) — same as today.
- **Backend (ollama-converter):** No extra env vars for Gmail; it uses the **access token** that the frontend gets from Supabase (`provider_token`) and sends on each Gmail request.
- **Supabase:** Google provider Client ID + Secret (unchanged).

---

## 6. Quick checklist

- [ ] **Google Cloud:** Gmail API **enabled** in the project.
- [ ] **Google Cloud:** OAuth consent screen has scope `https://www.googleapis.com/auth/gmail.readonly` **added**.
- [ ] **Supabase:** Google provider uses the same Client ID/Secret (no change).
- [ ] **App type:** Decide Internal vs External; if External, add test users or plan verification for production.

After 1.1 and 1.2, existing users may need to **sign out and sign in again** once so Google can ask for the new Gmail permission.
