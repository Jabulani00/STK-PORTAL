# STK College portal

Student and staff portal for STK College. This build is a working frontend prototype: screens, roles, and workflows run on JSON seed data in the browser. Sign-in, files, email, and certificates are simulated so the college can click through the product before a backend is connected.

The local store is the running system. Firebase is documented below as the integration path. It is not connected in this build.

## Tech stack

| Layer | Choice |
| --- | --- |
| App | React 19, TypeScript, Vite |
| Routing | React Router |
| Server state | TanStack Query, reading one in-memory database |
| Styling | Tailwind CSS 4, navy `#0F2B5B`, gold `#F4C542`, ember `#E85D04`, signal red `#C1121F` |
| Components | Hand-built controls on Radix UI |
| Forms | React Hook Form and Zod |
| Tables | TanStack Table |
| Charts | Recharts |
| Motion | Short route transitions with Framer Motion |
| Tests | Vitest |

Brand mark: `src/assets/STKLogo2.png` (lightbulb, book, and circuit). It is shown on the sign-in page and in both shells.

## Run it

From the `portal` folder:

```bash
npm install
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`.

- `npm test` checks marking, weighted results, certificate numbers, file checks, and CSV import validation
- `npm run build` typechecks and builds the app
- `npm run preview` serves the production build

Copy `.env.example` to `.env` only when you start a Firebase or Supabase project. The prototype runs with every value empty.

## Demo sign-in

Every sample account uses the password `stk-demo`. The sign-in page lists the accounts and can fill the form.

| Person | Role | Email | Student number |
| --- | --- | --- | --- |
| Lerato Khumalo | Student | lerato.khumalo@stkcollege.org | STK2026001 |
| Michael Daniels | Student | michael.daniels@stkcollege.org | STK2026002 |
| Nomsa Dlamini | Student with a Computer Literacy certificate | nomsa.dlamini@stkcollege.org | STK2026003 |
| Kyle Petersen | Student, Python enrolment suspended | kyle.petersen@stkcollege.org | STK2026004 |
| Zane Jacobs | Inactive student, cannot sign in | zane.jacobs@stkcollege.org | STK2026005 |
| Ayesha Patel | Facilitator for Python and Web Development | ayesha.patel@stkcollege.org | — |
| Sipho Ndlovu | Administrator | sipho.ndlovu@stkcollege.org | — |
| Thandi Mokoena | Super Admin | thandi.mokoena@stkcollege.org | — |

Courses: Computer Literacy (`CL`), Python Programming (`PY`), Web Development (`WEB`), Database Management (`DB`).

Changes are stored in this browser under `stk-portal-db-v1`. Restore demo data from the staff dashboard. Raising `seedVersion` in `src/data/settings.json` also discards the saved browser copy on the next load so new collections appear.

## What you can do

- A student sees only active or completed enrolments. A suspended enrolment does not open the course.
- Objective questions are marked in the service layer. The answer key is hidden until the result is released. Staff mark open responses.
- Course results use each course's assessment weights and pass mark.
- Certificate numbers follow `STK-{CODE}-{YEAR}-{SEQ}`. Public verification is `/verify/{certificate-number}`.
- Analytics (`/staff/analytics`) charts enrolments, result bands, attendance, released assessment averages, and ticket status. Export downloads those series as CSV.
- Messages are course conversations between a student and the assigned facilitator.
- Email records a message in the student inbox. No mail server is connected.
- Support tickets let a student report an issue. Staff reply, set Open / In progress / Resolved, export the list, and import new tickets from CSV.
- Reports export the current student, course, assessment, certificate, or attendance view. Student import and certificate import validate a file, show errors, and save only valid rows.

A student who opens a staff URL, or a facilitator who opens the audit log or another facilitator's course, sees access denied.

## File structure

```text
portal/
  index.html                 fonts and app shell
  .env.example               public Firebase and Supabase names, plus server-only keys
  public/templates/          CSV templates for student and ticket import
  docs/data-model.md         entity list and access rules
  src/
    main.tsx                 React entry
    index.css                navy, gold, ember, and signal tokens
    assets/STKLogo2.png
    app/                     router, guards, providers
    layouts/                 student shell, staff shell, menus
    pages/                   thin route files
    features/                screens: auth, courses, assessments, certificates,
                             analytics, messages, email, tickets, reports
    components/              logo, tables, import wizard, UI controls
    services/
      store.ts               JSON clone in memory, saved to localStorage
      access.ts              who may see which record
      api.ts                 create, import, mark, chat, email, tickets
      session.ts             demo sign-in
    data/                    one JSON file per entity, assembled in seed.ts
    lib/                     marking, results, CSV, certificate numbers
    types/index.ts           the database shape
```

## Routes

Student area, after sign-in: `/app`, `/app/courses`, `/app/results`, `/app/certificates`, `/app/attendance`, `/app/announcements`, `/app/messages`, `/app/support`, `/app/inbox`, `/app/profile`.

Staff area: `/staff` plus students, enrolments, courses, materials, assessments, results, certificates, attendance, announcements, analytics, messages, email, tickets, and reports. Users and the audit log are Super Admin only. Settings is Super Admin and Administrator.

Public: `/login`, `/forgot-password`, `/verify/:certificateNumber`.

## CSV

Student import columns: Student Number, First Name, Last Name, Email, Phone, Course, Enrolment Date. Template: `/templates/students-import-template.csv`.

Certificate import columns: Student Number, Student Name, Course, Completion Date, Result, Certificate Number.

Ticket import columns: Student Number, Subject, Category, Course, Details. Category is `access`, `assessment`, `certificate`, `technical`, or `other`. Course may be a code such as `PY`. Template: `/templates/tickets-import-template.csv`.

Exports from Analytics, Tickets, and Reports download the rows currently on screen.

## Prototype boundaries

- Files are metadata. Download gives a text copy of the record. Production files belong in private storage with signed URLs.
- Certificates print from the browser (`window.print`). Production PDFs should be generated on a server.
- Sign-in is a demo session. It is not Firebase Auth or Supabase Auth.
- Access checks live in `src/services/access.ts`. A production database must enforce the same rules in security rules or row level security.
- Email status is `recorded`. Nothing leaves the browser.

## How to integrate Firebase

Do this when the college is ready to leave the local store. Keep the service account off the client. Values prefixed with `VITE_` are visible in the built JavaScript.

1. Create a Firebase project and a web app. Copy the web config into `.env` using the `VITE_FIREBASE_*` names in `.env.example`.
2. Install the client SDK in `portal` and initialise it from those variables. Leave `FIREBASE_SERVICE_ACCOUNT` for Cloud Functions or a trusted script only.
3. Turn on Email/Password authentication. Store the role (`student`, `facilitator`, `administrator`, `super_admin`) as a custom claim set by the Admin SDK. Replace `src/services/session.ts` so sign-in calls Firebase Auth and the portal reads that claim. Inactive users should be disabled in Auth as well as in Firestore.
4. Create a Firestore collection for each table in `docs/data-model.md` (`users`, `courses`, `enrolments`, `chat_threads`, `chat_messages`, `emails`, `tickets`, `ticket_replies`, and the rest). Upload the JSON in `src/data` as the first documents. Point `src/services/store.ts` at those collections, or replace each function in `src/services/api.ts` with a Firestore write. Keep the access checks.
5. Write security rules that match `src/services/access.ts`. A student reads their own profile, enrolments, attempts, certificates, threads, tickets, and inbox. A facilitator reads and writes only courses listed in `course_staff`. Administrators do not read the audit log. Audit documents are create-only.
6. Put learning files in Cloud Storage. The client should request a path the rules allow, not a public URL. The current download button is only a stand-in.
7. Send real email from a Cloud Function (or an email provider called by that function) when `sendPortalEmail` runs. The inbox record can stay in Firestore. Do not call an email API from the browser.
8. Issue certificate numbers and PDFs in a Cloud Function so the sequence cannot be edited from the client. The public verify page can keep reading the certificate document by number.
9. Marking can stay in the client for the prototype. Before go-live, score objective questions in a function so the answer key is not shipped to the browser.

Supabase names remain in `.env.example` because the access layer was shaped for a Postgres swap as well. Use one backend. Do not commit real keys.
"# STK-PORTAL" 
