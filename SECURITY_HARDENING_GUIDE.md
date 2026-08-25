# 🛡️ PaintERP — Complete Production Security Hardening Guide

This guide provides the exact implementation steps, code snippets, and architectural changes required to fix all 6 identified security vulnerabilities before deploying to Vercel with a custom domain.

---

## 📋 Security Vulnerabilities & Fix Roadmap

```
┌────┬───────────────────────────────────────┬────────────┬───────────────────────────────────────┐
│ #  │ Vulnerability                         │ Severity   │ Solution                             │
├────┼───────────────────────────────────────┼────────────┼───────────────────────────────────────┤
│ 1  │ Unauthenticated API Routes (BOLA)     │ 🔴 CRITICAL│ JWT Session Cookies + API Middleware  │
│ 2  │ Plaintext Passwords                   │ 🔴 CRITICAL│ Bcrypt Password Hashing               │
│ 3  │ Client-Side Dev Panel PIN Bypass      │ 🟠 HIGH    │ Server-Side Dev Secret Key            │
│ 4  │ Login Brute-Force Attacks             │ 🟠 HIGH    │ In-Memory / Edge Rate Limiting        │
│ 5  │ Public Tenant Data Enumeration        │ 🟡 MEDIUM  │ Data Sanitization & Role Gating       │
│ 6  │ Missing Security Headers              │ 🟡 MEDIUM  │ next.config.ts Security Headers       │
└────┴───────────────────────────────────────┴────────────┴───────────────────────────────────────┘
```

---

## 1. 🔴 Fix: Bcrypt Password Hashing

### Step 1.1: Install Dependencies
Run in your terminal:
```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

### Step 1.2: Create Password Utility (`src/lib/auth-passwords.ts`)
Create a helper file `src/lib/auth-passwords.ts`:

```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password using bcrypt.
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a stored hash.
 * Supports legacy plain-text fallback during migration.
 */
export async function verifyPassword(plainText: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;

  // If already bcrypt hash ($2a$ or $2b$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    return bcrypt.compare(plainText, storedHash);
  }

  // Fallback for unmigrated plain-text passwords
  return plainText === storedHash;
}
```

### Step 1.3: Update Login Endpoint (`src/app/api/auth/login/route.ts`)
Replace direct string comparison with `verifyPassword`:

```typescript
import { verifyPassword, hashPassword } from '@/lib/auth-passwords';

// Verify password securely:
const isValidPassword = await verifyPassword(password, user.password_hash);
if (!isValidPassword) {
  return NextResponse.json({ success: false, error: 'Incorrect password' }, { status: 401 });
}

// Auto-upgrade plain-text password to bcrypt hash on successful login
if (!user.password_hash.startsWith('$2a$') && !user.password_hash.startsWith('$2b$')) {
  const newHash = await hashPassword(password);
  await supabaseAdmin
    .from('app_users')
    .update({ password_hash: newHash })
    .eq('id', user.id);
}
```

### Step 1.4: Update User Creation (`src/app/api/users/route.ts` & `/api/tenants/route.ts`)
When creating or editing users, always hash the password:

```typescript
import { hashPassword } from '@/lib/auth-passwords';

const secureHash = await hashPassword(password);
await supabaseAdmin.from('app_users').insert({
  username: cleanUsername,
  password_hash: secureHash,
  // ...
});
```

---

## 2. 🔴 Fix: JWT Authentication & API Route Protection

### Step 2.1: Install `jose` (Lightweight Edge-compatible JWT)
```bash
npm install jose
```

### Step 2.2: Create Session & Token Helper (`src/lib/session.ts`)
Create `src/lib/session.ts`:

```typescript
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'pyntflow-super-secret-key-change-in-production-min-32-chars!'
);

const COOKIE_NAME = 'pyntflow_session';

export interface UserSession {
  userId: string;
  username: string;
  role: 'developer' | 'ceo' | 'staff' | 'godown_staff';
  tenantId?: string;
  tenantSlug?: string;
}

/**
 * Creates an encrypted JWT session cookie.
 */
export async function createSessionCookie(payload: UserSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

/**
 * Validates session from incoming request.
 */
export async function getSession(req: NextRequest): Promise<UserSession | null> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');

  const token = cookie || authHeader;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}

/**
 * Helper to enforce tenant authorization on API routes.
 */
export async function requireTenantAuth(req: NextRequest, targetTenantId?: string | null) {
  const session = await getSession(req);

  if (!session) {
    return { authorized: false, error: 'Unauthorized: Login required', status: 401, session: null };
  }

  // Developer Super Admin has access to all branches
  if (session.role === 'developer') {
    return { authorized: true, session };
  }

  // Staff and CEO must match the tenant they are accessing
  if (targetTenantId && session.tenantId !== targetTenantId) {
    return { authorized: false, error: 'Forbidden: Access to this branch is denied', status: 403, session };
  }

  return { authorized: true, session };
}
```

### Step 2.3: Attach Session Cookie on Login (`/api/auth/login`)
```typescript
import { createSessionCookie } from '@/lib/session';

const token = await createSessionCookie({
  userId: user.id,
  username: user.username,
  role: user.role,
  tenantId: user.tenant_id,
  tenantSlug: target_slug || user.tenants?.slug,
});

const response = NextResponse.json({ success: true, user: sanitizedUser });

// Set HTTP-only secure cookie
response.cookies.set('pyntflow_session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
});

return response;
```

---

## 3. 🟠 Fix: Server-Side Dev Admin Authentication

### Step 3.1: Environment Variable Setup
In `.env.local` and in your **Vercel Project Settings > Environment Variables**:
```env
DEV_ADMIN_PIN="1234"
DEV_ADMIN_SECRET="secret_dev_key_change_this_to_a_long_random_string_881923"
```

### Step 3.2: Create Developer PIN Verification Endpoint (`src/app/api/auth/dev-pin/route.ts`)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const DEV_SECRET = new TextEncoder().encode(process.env.DEV_ADMIN_SECRET || 'fallback-secret');

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    const correctPin = process.env.DEV_ADMIN_PIN || '1234';

    if (!pin || String(pin) !== String(correctPin)) {
      return NextResponse.json({ success: false, error: 'Invalid Developer Access PIN' }, { status: 401 });
    }

    // Sign a temporary developer authorization token (valid for 8 hours)
    const token = await new SignJWT({ role: 'developer', access: 'dev-panel' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(DEV_SECRET);

    const res = NextResponse.json({ success: true, token });
    res.cookies.set('dev_admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8,
      path: '/',
    });

    return res;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

---

## 4. 🟠 Fix: Rate Limiting & Anti-Brute-Force Protection

### Step 4.1: Edge Rate Limiter (`src/lib/rate-limit.ts`)
Create `src/lib/rate-limit.ts` to prevent automated dictionary attacks:

```typescript
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const tracker = new Map<string, RateLimitRecord>();

/**
 * In-memory sliding window rate limiter for login attempts.
 * Max 5 attempts per 5 minutes per IP address.
 */
export function checkRateLimit(ip: string, maxAttempts = 5, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const record = tracker.get(ip);

  if (!record || now > record.resetAt) {
    tracker.set(ip, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxAttempts - 1 };
  }

  if (record.count >= maxAttempts) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    return { success: false, remaining: 0, retryAfterSec };
  }

  record.count += 1;
  return { success: true, remaining: maxAttempts - record.count };
}
```

### Step 4.2: Add Rate Limiter to Login Route
```typescript
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const limitCheck = checkRateLimit(ip);

  if (!limitCheck.success) {
    return NextResponse.json(
      { success: false, error: `Too many login attempts. Please try again in ${limitCheck.retryAfterSec} seconds.` },
      { status: 429, headers: { 'Retry-After': String(limitCheck.retryAfterSec) } }
    );
  }
  
  // Proceed with authentication...
}
```

---

## 5. 🟡 Fix: Sanitize Public `/api/tenants`

### Step 5.1: Prevent Global Tenant Enumeration
In `src/app/api/tenants/route.ts`:

```typescript
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  // 1. Single Shop Query by Slug (Public / Counter Login Screen)
  if (slug) {
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug, type, city, address, is_active, commission_enabled, commission_rate')
      .eq('slug', slug.trim().toLowerCase())
      .single();

    if (error || !tenant) {
      return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
    }

    // Only return public counter identifiers (omit owner private phone/email)
    return NextResponse.json({ success: true, tenant });
  }

  // 2. Global Tenant List — Must require Developer Authentication
  const session = await getSession(req);
  if (session?.role !== 'developer') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Return full developer branch list...
}
```

---

## 6. 🟡 Fix: Next.js Security Headers (`next.config.ts`)

Update `next.config.ts` to enforce HTTPS, disable clickjacking, and inject security headers:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Hides "X-Powered-By: Next.js"
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY", // Prevents UI clickjacking in iframes
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

## 🚀 Final Vercel & Domain Deployment Checklist

1. **Environment Variables in Vercel:**
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ignspvajzblmsbertmmv.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *(Supabase Anon Key)*
   - `SUPABASE_SERVICE_ROLE_KEY` = *(Secret Service Key - **NEVER** prefix with NEXT_PUBLIC)*
   - `SESSION_SECRET` = *(Generate 64-char random hex)*
   - `DEV_ADMIN_PIN` = *(Your Super Admin PIN)*
   - `DEV_ADMIN_SECRET` = *(Generate 64-char random hex)*

2. **Custom Domain Setup (Cloudflare / Namecheap / GoDaddy):**
   - In DNS Settings, create `CNAME` `@` / `www` pointing to `cname.vercel-dns.com`.
   - Enable **Always Use HTTPS** and **SSL/TLS Mode: Full (Strict)**.
   - Enable **DNSSEC** on your domain registrar.

3. **Supabase Database Row-Level Security (RLS):**
   - Ensure all tables have RLS enabled.
   - All backend API routes using `supabaseAdmin` will securely authenticate on the server side using the session tokens before performing operations.
