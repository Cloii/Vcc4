## Deploy to Vercel + Supabase

### 1) Create Supabase project
- Create a new Supabase project.
- In **SQL Editor**, run: `supabase/schema.sql`
- In **Storage**, create a bucket named **`uploads`** and set it to **Public**.

### 2) Configure Supabase Auth
- Enable **Email/Password** auth.
- (Optional) Disable email confirmation for easier testing.

### 3) Migrate existing SQLite data + uploads
Create a local `.env` (copy from `.env.example`) and fill:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Then run:

```bash
npm run migrate:supabase
```

Notes:
- This migrates **buildings, panoramas, paths, resources, site_content**.
- **Users/passwords from SQLite cannot be migrated into Supabase Auth** automatically. Users should sign up again.

### 4) Deploy on Vercel
1. Push this repo to GitHub.
2. Import into Vercel.
3. Set Environment Variables in Vercel:
   - **Client (Vite)**:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - **Server (Vercel Function `/api/set-role`)**:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `ADMIN_CODE`
     - `STAFF_CODE`
4. Deploy.

### 5) Admin/Staff role codes
During signup, when role is **admin** or **staff**, the app calls `POST /api/set-role` to validate the code and update `profiles.role`.

