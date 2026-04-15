# Security Notes — Prototipalo

## Webhook Signature Verification

| Route | Protected? | Method |
|-------|-----------|--------|
| `/api/stripe/webhook` | Yes | `stripe.webhooks.constructEvent()` |
| `/api/webhooks/whatsapp` | Yes | `apikey` header check |
| `/api/webhooks/gmail-push` | Yes | Google Pub/Sub token decode |
| `/api/webhooks/email-received` | Yes (optional) | Query param secret |
| `/api/crm/webhook` | Yes | `safeCompare()` timing-safe |
| `/api/holded/webhook` | Yes | Timing-safe comparison |
| `/api/cabify/webhook` | Partial | Simple `===` comparison (NOT timing-safe) |
| `/api/packlink/webhook` | **No** | No verification at all |

### Issues

**`/api/packlink/webhook/route.ts`**
- No signature verification — anyone can POST forged shipment status updates
- Can manipulate project delivery states
- **Fix**: Implement IP whitelisting or contact Packlink for webhook signatures

**`/api/cabify/webhook/route.ts` (line 15)**
```typescript
if (signature !== webhookSecret)  // ← vulnerable to timing attacks
```
- Should use `timingSafeEqual()` like `/api/crm/webhook` does
- **Fix**: `crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(webhookSecret))`

---

## Public API Routes Without Authentication

### `/api/cotizador/lead/route.ts`
- **Severity**: Medium (intentionally public — website quote form)
- Accepts: email, name, message, stlUrl
- **Risk**: Spam lead injection, no rate limiting
- **Mitigation**: Add CAPTCHA or rate limiting (5 req/hour per IP)

### `/api/crm/utm/route.ts`
- **Severity**: Medium (intentionally public — UTM tracking pixel)
- Accepts: email + arbitrary UTM fields
- **Risk**: UTM data injection on existing leads
- **Mitigation**: Validate email format, rate limit per IP

---

## Rate Limiting

**No routes implement explicit rate limiting.** Vercel provides implicit DDoS protection but no application-level limits.

**Priority routes for rate limiting:**
1. `/api/cotizador/lead` — 5 req/hour per IP
2. `/api/crm/utm` — 10 req/hour per IP
3. `/api/track/verify` — already has 5 codes/15min per project+email (good)

---

## Input Validation

### `/api/webhooks/email-received/route.ts` (line 130)
```typescript
.or(`email.ilike.${from},email.ilike.@${fromDomain}`)
```
- Email address from request body interpolated into Supabase `.or()` filter string
- Supabase parameterizes the final SQL, so actual SQL injection is unlikely
- But crafted emails could manipulate filter syntax
- **Fix**: Use `.ilike("email", from)` on separate calls instead of string interpolation

---

## Unhandled Fetch Errors in Client Components

| File | Line | Issue |
|------|------|-------|
| `src/app/cotizador/quote-calculator.tsx` | 123-154 | Upload + lead creation silently fail |
| `src/app/track/[token]/client-portal.tsx` | 148-150 | File loading silently fails |
| `src/app/track/[token]/client-portal.tsx` | 168-174 | File upload silently fails |

All have `try/catch` but swallow errors without user feedback. The user gets no indication that an action failed.

---

## Secrets Management

- All API keys in environment variables (not committed)
- SMTP passwords encrypted in DB (`src/lib/encryption.ts`)
- Supabase service role key used server-side only
- No secrets in client-side code (verified)
- `NEXT_PUBLIC_*` vars contain only public Supabase URL + anon key

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| High | 2 | Packlink webhook unverified, Cabify timing-unsafe |
| Medium | 3 | Public endpoints without rate limiting, `.or()` interpolation |
| Low | 3 | Silent fetch failures in client components |
