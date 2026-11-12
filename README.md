# BeVo — React + TypeScript

BeVo is the academic portal for students and authorized staff. The editable application source is in `src/src/app` and `src/src/components`; it is a Next.js App Router app written in React and TypeScript.

## Included in this rebuild
- Supabase email/password authentication, email OTP verification, password recovery, and Google OAuth.
- Student academic profile completion and course registration/change-request flows.
- Academic administration for colleges, years, levels, terms, courses, course offerings and lectures.
- Group/section scoped administration for A–D and a1–d6 using the existing Supabase RPCs and row-level security.
- Tasks, educational links/resources, requests, in-app notifications and an interactive onboarding guide.
- Responsive RTL Arabic layout.

## Local development
1. Copy `src/.env.example` to `src/.env.local`.
2. Add the Supabase URL and public publishable/anon key used by the project.
3. Run `cd src && npm install && npm run dev`.

Never put a Supabase service-role key in browser code. Permissions are enforced by the existing database policies and RPCs.

## Deployment notes
The Vercel project root is `src`. The production alias was intentionally not switched during this rebuild; preview deployments should be tested before promoting new code. The earlier compiled runtime snapshot is not used by this React/TypeScript application.
