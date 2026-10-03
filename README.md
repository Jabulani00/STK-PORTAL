# STK College portal

Student and staff portal for STK College. With `src/config/firebase.ts` left blank, every screen runs on the sample college stored in this browser. Paste a Firebase web config into that one file and the same screens read and write the Firestore document `portal/database`. No other screen has to change.

## Tech stack

| Layer | Choice |
| --- | --- |
| App | React 19, TypeScript, Vite |
| Routing | React Router |
| Server state | TanStack Query, one database from the browser or Firestore |
| Backend switch | `src/config/firebase.ts` |
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

The sample college is the default. Connect Firebase only when you are ready, using the steps at the end of this file.

- `npm test` checks marking, weighted results, certificate numbers, file checks, and CSV import validation
- `npm run build` typechecks and builds the app
- `npm run preview` serves the production build

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

Changes stay in this browser until Firebase is connected. Restore demo data from the staff dashboard or a student profile. After Firebase is connected and `seedFirestoreWhenEmpty` is `false`, that restore button is hidden and the sample JSON is not loaded.

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
  .env.example               server-only key names; the app does not read them
  public/templates/          CSV templates for student and ticket import
  docs/data-model.md         entity list and access rules
  src/
    main.tsx                 waits for connectPortal(), then renders
    config/firebase.ts       the only file to edit for Firebase
    index.css                navy, gold, ember, and signal tokens
    assets/STKLogo2.png
    app/                     router, guards, providers
    layouts/                 student shell, staff shell, menus
    pages/                   thin route files
    features/                screens: auth, courses, assessments, certificates,
                             analytics, messages, email, tickets, reports
    components/              logo, tables, import wizard, UI controls
    services/
      store.ts               sample data, or Firestore when firebase.ts is filled in
      firebase-backend.ts   reads and writes portal/database
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
- Sign-in is a demo session. Accounts stored in Firebase still use the password `stk-demo` until `src/services/session.ts` is replaced.
- Access checks live in `src/services/access.ts`. A shared Firebase project must enforce the same rules in Firestore security rules. The test rules below are open on purpose.
- Email status is `recorded`. Nothing leaves the browser.

## Connect Firebase

Do this when you want the portal to stop using the sample college in the browser. You need a Firebase account. You edit one file: `src/config/firebase.ts`.

1. Open [Firebase console](https://console.firebase.google.com/) and create a project.
2. Build → Firestore Database → Create database. For a private trial, start in test mode. Pick a region and wait until the database is ready.
3. Project settings → Your apps → add a Web app. Copy the `firebaseConfig` object. Do not download a service-account JSON into this folder.
4. Paste the values into `src/config/firebase.ts`. Leave `seedFirestoreWhenEmpty` as `true` for the first run.

```ts
export const firebaseConfig = {
  apiKey: 'paste-from-console',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:abcdef',
}

export const seedFirestoreWhenEmpty = true
```

5. In the Firestore rules tab, allow the one document while you are testing. Replace this before any real student uses the project. Anyone who can load the site can read and write while this rule is open.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /portal/database {
      allow read, write: if true;
    }
  }
}
```

6. From the `portal` folder, run `npm run dev` and open the site. The first load creates the document `portal` / `database` from the sample college, because that document did not exist yet.
7. Sign in as Sipho (`sipho.ndlovu@stkcollege.org`, password `stk-demo`). Open a ticket or change a phone number. In the Firebase console, open `portal/database` and confirm the change is there. Refresh the portal. The change should still be there, including in a second browser.

The screens do not know which source they are using. `src/services/store.ts` calls `connectPortal()` before the first paint. A blank config uses the sample files in `src/data`. A filled config uses Firestore and ignores the browser copy.

### Remove the sample data

Do this after the Firebase document looks right and you want the portal to stop falling back to the JSON files.

1. In `src/config/firebase.ts`, set `seedFirestoreWhenEmpty` to `false`.
2. Restart `npm run dev`.
3. The app now reads only `portal/database`. It does not load `src/data` and it does not write the sample college back. Restore demo data disappears from the staff dashboard and the student profile.
4. Replace the sample records from the portal itself (add students, courses, enrolments) or edit `portal/database` in the Firebase console. If you delete that document while the flag is `false`, the site shows: Firebase is connected, but portal/database is empty.
5. You can leave the JSON files in `src/data`. They are the shape of the document, and they are not loaded while the flag is `false`.

Sign-in is still the demo password for every user id stored in that document. Replacing `src/services/session.ts` with Firebase Auth is a later step. The data switch does not require it.

Do not commit a filled-in `src/config/firebase.ts` if other people can see the repository.
