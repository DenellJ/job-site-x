# Pure Castle / Job Site X

Mobile-first PWA — Resscott's **Job-Site Digital Forms & Reporting Platform**.

- **Personnel** self-register; a manager approves the account and grants per-form access. They start a job by capturing mandatory **Section 1** start evidence (photo/video + notes), then complete one of the assigned **digital forms** (Section 2), attaching photos/videos and saving drafts. Before submitting they must add **final completion evidence**.
- **Manager** sees submissions in **per-form-type folders**, reviews each one, approves/rejects with a signature, **converts** an approved submission into a customer-facing **Inspection Report PDF** (re-convert / re-download supported), and can **export the whole database to Excel**.

## Stack

React 18 + Vite + TypeScript · Tailwind CSS · React Router · `react-signature-canvas` · `vite-plugin-pwa` · **[Convex](https://convex.dev)** (reactive database + server functions + file storage) with **[Convex Auth](https://labs.convex.dev/auth)** (email/password) · **pdf-lib** (server-side report PDFs) · **xlsx** (Excel export).

## The five forms

`Site Visit`, `Job Inspections`, `Solar Water Heater`, `Job Ticket`, `New Job Task`. Their definitions live in **`convex/formDefs.ts`** (one source of truth, imported by both server and client). Site Visit and Solar Water Heater are digital replicas of the sample documents; the other three carry a reasonable draft field set to be confirmed during Resscott's form sign-off.

## Local development

Requires Node 18+.

```bash
npm install

# 1. Provision your Convex backend. First run logs you in (browser) and creates a
#    project. Writes CONVEX_DEPLOYMENT + VITE_CONVEX_URL to .env.local, pushes the
#    functions in convex/, and keeps watching for changes. Leave it running.
npx convex dev

# 2. One-time: set up Convex Auth keys (JWT_PRIVATE_KEY, JWKS, SITE_URL) on the
#    dev deployment. When prompted for the web server URL, use http://127.0.0.1:5173.
npx @convex-dev/auth

# 3. One-time: seed the manager account manager@test.com / 1234.
npx convex run users:seedDevManager '{}'

# 4. In a second terminal, start the frontend.
npm run dev
```

Open http://127.0.0.1:5173 and sign in as `manager@test.com` / `1234`.

> A convenience script `npm run dev:backend` is an alias for `npx convex dev`.
> The old Firebase `.env` (with `VITE_FIREBASE_*` keys) is unused and can be deleted.
> Instead of the seed in step 3 you can use `/setup` to create the first manager interactively.

## First-run + end-to-end test

1. Sign in as the manager (`manager@test.com` / `1234`).
2. In an incognito window, open `/register` and request an account (`emp1`). It lands as **pending**.
3. Manager → **Users** → **Pending Requests** → grant a couple of forms → **Approve**. (`emp1` gets a realtime "approved" toast.)
4. As `emp1`: **Start a Job** — capture a start photo/video + notes (Section 1 gate), then pick a form.
5. Fill the form → **Save Draft** → reopen from **My Forms** → confirm **Submit is locked** until you add **final completion evidence**, then submit. Manager gets a realtime toast.
6. Manager → **Dashboard** → the form's folder shows the submission flagged **needs converting** → **Review** → draw a signature → **Approve**.
7. **Convert to PDF Report** → **Download PDF**. **Convert Again** prompts for confirmation; **Download PDF** re-downloads.
8. Manager → **Dashboard** → **Export Excel** downloads `resscott-submissions.xlsx`.

## Architecture notes

- **Onboarding & access** (`convex/users.ts`): public `registerRequest` creates a *pending* personnel profile and notifies managers; `approveUser`/`declineUser` gate access and set per-form `allowedForms`. The app shell shows a "pending/declined" screen until approved. No account self-activates.
- **One submission = Section 1 + Section 2 + final evidence** (`convex/schema.ts → formSubmissions`). The form field definitions are snapshotted onto each submission so historical records render faithfully even if a form changes.
- **Gates** (`convex/submissions.ts → submit`): start media + notes, required Section-2 fields, and final completion media are all enforced server-side.
- **Approval** (`convex/approvals.ts → decide`): one mutation writes the approval (with signature), flips the status, and notifies the submitter.
- **Report PDF** (`convex/reports.ts`, Node runtime): pdf-lib builds the Resscott-letterhead Inspection Report (form data + embedded photo evidence) and stores it; `reportVersion` tracks convert/re-convert.
- **Excel export** (`convex/exportExcel.ts`, Node runtime): xlsx builds a workbook of all submissions and returns a download URL.
- **Notifications** are a reactive `useQuery(api.notifications.listMine)` over the `notifications` table.
- **Files**: photos/videos/signatures upload via `storage.generateUploadUrl`; review screens resolve URLs with `ctx.storage.getUrl`. Capture uses `<input type="file" accept="image/*,video/*" capture="environment">`.
- **Single tenant**: one company, one (or few) managers; managers see all non-draft submissions.

## Deploy: GitHub + Netlify

Unchanged from the standard Convex + Netlify flow:

```bash
# Production Convex deployment + auth keys
npx @convex-dev/auth --prod
```

In the Convex dashboard create a **production deploy key** (Settings → Deploy keys). New Netlify site → import the repo (`netlify.toml` sets build `npx convex deploy --cmd 'npm run build'`, publish `dist`, SPA redirect). Add Netlify env var **`CONVEX_DEPLOY_KEY`** = the prod deploy key. After first deploy, set `SITE_URL`:

```bash
npx convex env set SITE_URL https://YOUR-SITE.netlify.app --prod
```

After deploying, seed the production manager once: `npx convex run users:seedDevManager '{}' --prod` (or use `/setup`).

## Project layout

```
convex/
├── schema.ts            # profiles (+status/allowedForms), formSubmissions, approvals, notifications
├── validators.ts        # shared validators (roles, status, form types, media, fields)
├── formDefs.ts          # the 5 form definitions (shared by server + client)
├── forms.ts             # server-side required-field validation
├── auth.ts · auth.config.ts · http.ts
├── helpers.ts           # requireProfile / requireApproved / requireManager / manager lookups
├── users.ts             # me, register/approve/decline, per-form access, seedDevManager
├── submissions.ts       # saveDraft, submit, listMine, listForManager, getDetail
├── approvals.ts         # decide (approve/reject + notify)
├── reportData.ts        # internal: report data + saveReport
├── reports.ts           # "use node": convert → Inspection Report PDF (pdf-lib)
├── exportData.ts        # internal: rows for export
├── exportExcel.ts       # "use node": exportDatabase → .xlsx (xlsx)
├── notifications.ts · storage.ts
└── _generated/          # `npx convex dev` output (committed)

src/
├── App.tsx · main.tsx
├── lib/{types,cn}.ts
├── forms/index.ts       # re-exports convex/formDefs
├── hooks/{useRealtimeNotifications,useUpload}.ts
├── components/{AppShell,NotificationBar,StatusPill,FormRenderer,MediaGallery,MediaThumbs,SignaturePad}.tsx
└── routes/
    ├── Setup · Login · Register · PendingApproval · StartJob · FormFill · MyDrafts
    └── manager/{ManagerDashboard,ManagerFolder,ManagerReview,ManagerUsers}.tsx
```
