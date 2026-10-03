# Data model

The prototype stores one JSON file per entity in `src/data` and loads them through `src/data/seed.ts`. With `src/config/firebase.ts` left blank, mutations stay in this browser. When that file has a Firebase web config, the same database is the Firestore document `portal/database`.

| Table | Purpose |
| --- | --- |
| users | Account identity, role, and active or inactive status |
| roles | Role names and the permissions shown to super admins |
| student_profiles | Student number linked to a user |
| staff_profiles | Staff number and title |
| courses | Catalogue, pass mark, and certificate number pattern |
| course_modules | Ordered modules inside a course |
| course_staff | Facilitators assigned to a course |
| enrolments | Student-course link and status |
| materials | Learning-file metadata |
| material_versions | Earlier file names for a material |
| assessments | Quiz, assignment, test, or final, including weight and release rule |
| questions | Prompts, types, marks, and accepted short answers |
| question_options | Objective options and which ones are correct |
| assessment_attempts | A student's start, submission, score, and release state |
| assessment_answers | The response and awarded marks for one question |
| course_results | Weighted course outcome |
| attendance_sessions | A class session |
| attendance_records | Present, absent, late, or excused |
| certificate_templates | Signatory for a course |
| certificates | Issued number, student, course, result, and valid or revoked |
| announcements | College-wide or course messages |
| notifications | In-portal notices for one user |
| chat_threads | A course conversation and its participants |
| chat_messages | Messages inside a thread |
| emails | Portal inbox records. Status `recorded` means no mail server sent them |
| tickets | An issue reported by a student, with category and status |
| ticket_replies | Replies on a ticket |
| audit_logs | Who did what, when, and the previous and new value |

Answer keys stay on `question_options.isCorrect` and `questions.acceptedAnswers`. The student assessment view does not copy those fields until a result is released.

Access rules in the prototype mirror the intended row level security:

- A student can read their own profile, active or completed enrolments, published materials and assessments for those enrolments, their own attempts, attendance, certificates, conversations, tickets, and inbox.
- A facilitator can manage only courses listed in `course_staff`, including messages, tickets, and mail for students in those courses.
- An administrator can manage college data but cannot open the audit log or change staff roles.
- A super admin can open users, roles, and the audit log.
- Audit rows are never edited from the interface.
