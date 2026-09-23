# College Timetable Website

A mobile-friendly College Timetable portal using Supabase Authentication + PostgreSQL and deployable to Vercel.

## Included
- Login / signup
- Student and professor roles
- Admin dashboard shell
- Timetable viewer
- Classes, classrooms and subjects
- Notifications
- Professor absence reporting
- Supabase database schema + RLS policies
- Responsive mobile UI

## Setup
1. Open Supabase SQL Editor.
2. Paste and run `supabase-schema.sql`.
3. In Supabase, copy your Project URL and Publishable key.
4. Open `app.js` and replace:
   - `YOUR_SUPABASE_PROJECT_URL`
   - `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY`
5. Open `index.html` locally to test, or deploy the folder to Vercel.
6. Create your first account. If you want admin access, run the admin SQL command at the bottom of `supabase-schema.sql` with your email.
7. Import your CSV data through Supabase Table Editor, then refresh the website.

## Vercel
Upload this project to GitHub, then import the repository into Vercel. This is a static site, so no build command is required.

## Security
Use only the Supabase Publishable/anon key in this frontend. Never put a Supabase service-role/secret key in `app.js`.
