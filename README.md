# Pure Castle / Job Site X

Mobile-first PWA — Resscott's **Job-Site Digital Forms & Reporting Platform**.

- **Personnel** self-register; a manager approves the account and grants per-form access. They start a job by capturing mandatory **Section 1** start evidence (photo/video + notes), then complete one of the assigned **digital forms** (Section 2), attaching photos/videos and saving drafts. Before submitting they must add **final completion evidence**.
- **Manager** sees submissions in **per-form-type folders**, reviews each one, approves/rejects with a signature, **converts** an approved submission into a customer-facing **Inspection Report PDF** (re-convert / re-download supported), and can **export the whole database to Excel**.

## Stack

React 18 + Vite + TypeScript · Tailwind CSS · React Router · `react-signature-canvas` · `vite-plugin-pwa` · **[Convex](https://convex.dev)** (reactive database + server functions + file storage) with **[Convex Auth](https://labs.convex.dev/auth)** (email/password) · **pdf-lib** (server-side report PDFs) · **xlsx** (Excel export).

## The six forms

`Site Visit — Lighting`, `Site Visit — Solar Systems`, `Site Visit — Solar Water Heaters`, `Inspection`, `Job Ticket`, and `New Job Task`. Their definitions live in **`convex/formDefs.ts`** (one source of truth, imported by both server and client). The four document-backed forms are reconciled with `sample forms/`; historical submissions retain their snapshotted definitions.

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

# 3. One-time: open /setup and create the first manager.

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
6. Manager → **Dashboard** → the form's folder shows the submission flagged **needs converting** → **Review**. Managers and admins can use **Edit Form** to correct a submitted or approved form; each correction is recorded and the original submitter is notified. An approved form remains approved, but any existing report is removed and must be regenerated.
7. Draw a signature → **Approve** for a pending submission.
8. **Convert to PDF Report** → **Download PDF**. **Convert Again** prompts for confirmation; **Download PDF** re-downloads.
9. Manager → **Dashboard** → **Export Excel** downloads `resscott-submissions.xlsx`.

## Architecture notes

- **Onboarding & access** (`convex/users.ts`): public `registerRequest` creates a *pending* personnel profile and notifies managers; `approveUser`/`declineUser` gate access and set per-form `allowedForms`. The app shell shows a "pending/declined" screen until approved. No account self-activates.
- **One submission = Section 1 + Section 2 + final evidence** (`convex/schema.ts → formSubmissions`). The form field definitions are snapshotted onto each submission so historical records render faithfully even if a form changes.
- **Gates** (`convex/submissions.ts → submit`): start media + notes, required Section-2 fields, and final completion media are all enforced server-side.
- **Approval and corrections** (`convex/approvals.ts → decide`, `convex/submissions.ts → editSubmission`): staff can approve/reject pending work and correct submitted or approved field values/in-form attachments. Corrections are audited, notify the submitter, preserve approval status, and invalidate the generated report.
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

In the Convex dashboard create a **production deploy key** with deploy permission. Import the repository into Netlify; `netlify.toml` deploys Convex, explicitly injects `VITE_CONVEX_URL`, publishes `dist`, and preserves the SPA rewrite. Add **`CONVEX_DEPLOY_KEY`** for the production context. For deploy previews, configure a separate Convex preview deploy key in Netlify's Deploy Preview context. After the first production deploy, set `SITE_URL`:

```bash
npx convex env set SITE_URL https://YOUR-SITE.netlify.app --prod
```

After deploying, open `/setup` once to create the production manager. Verify that `CONVEX_SITE_URL`, `SITE_URL`, `JWT_PRIVATE_KEY`, and `JWKS` are set on the production Convex deployment and that the Netlify log injects the production URL as `VITE_CONVEX_URL`.

## Project layout

```
convex/
├── schema.ts            # profiles (+status/allowedForms), formSubmissions, approvals, notifications
├── validators.ts        # shared validators (roles, status, form types, media, fields)
├── formDefs.ts          # the 5 form definitions (shared by server + client)
├── forms.ts             # server-side required-field validation
├── auth.ts · auth.config.ts · http.ts
├── helpers.ts           # requireProfile / requireApproved / requireManager / manager lookups
├── users.ts             # me, register/approve/decline, setup, per-form access
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
