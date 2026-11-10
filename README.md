# Rsu Study Sprint

Build a university CBT exam preparation and study portal for 100-Level students in the Department of Employment Relations and Human Resources Management at Rivers State University. 

Connect it to a Supabase backend to handle database storage, authentication, and pin verification.

### USER ROLES & PERMISSIONS
1. ADMIN:
- Has a secure dashboard.
- Features a "Generate Pin" button that creates unique, random 11-digit numeric pins.
- Can see a list of all generated pins, showing their status: "Active" (unused) or "Expired" (used).
- Can see or generate a specific website route/link for each of the 9 courses.
- Can view student accounts and their quiz scores.

2. STUDENT:
- Creates an account using their Name only (or Name and Matric Number).
- Logs into a specific course page using a unique, unused 11-digit pin provided by the Admin.

### APPLICATION ARCHITECTURE & NAVIGATION
- Main Home Page: Simple layout displaying 9 large, clickable buttons—one for each course.
- Course List:
  1. GST 111 - COMMUNICATION IN ENGLISH LANG.
  2. AMS 101 - PRINCIPLES OF MANAGEMENT
  3. AMS 103 - INTRODUCTION TO COMPUTER
  4. EHR 121 - INTRO TO HUMAN RESOURCE MANAGEMENT
  5. RSU-EHR 123 - SOCIOLOGY OF WORK IN INDUSTRY
  6. RSU-EHR 111 - INTRO TO FINANCIAL ACCOUNTING
  7. RSU-EHR 113 - INTRODUCTION TO FINANCE
  8. RSU-EHR 115 - ELEMENTS OF MARKETING
  9. RSU-LSM 101 - INTRODUCTION TO LOGISTICS & SUPPLY CHAIN MGT

### EXAM ENGINE & TIMING LOGIC
- When a student clicks a course, they are prompted to create their account (Name) and enter an 11-digit active Pin.
- Upon successful pin validation, the pin status immediately updates to "Expired" in Supabase so it can never be used again.
- The student is immediately redirected to a workspace containing:
  A) Reading Plan: A dedicated section showing study guides and syllabus review for that 100L course.
  B) Practice Exam: A 30-question multiple-choice quiz.
- Quiz Mechanics: Each question has 3 answer options (A, B, C). Only one is correct. Each correct answer scores 2 points (Total score out of 60).
- Countdown Timer: A strict 20-minute countdown timer starts the moment the student enters.
- Expiration Event: When the 20-minute timer hits 0:00:
  - The quiz automatically submits.
  - The final score is saved to the database under the student's name.
  - The system force-closes the session, logs the student out, and redirects them to the home screen.
  - To attempt the quiz again, they must obtain a fresh, unused 11-digit pin from the admin.

Please build the frontend using clean Tailwind CSS components, construct the routing, and generate the Supabase database schema for users, pins, courses, questions, and scores.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rsu-study-sprint.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ba7cd39b-0a5e-4036-9eb3-87a7ae0366b1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
