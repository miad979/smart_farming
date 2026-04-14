# Complete Setup (Local Mode)

This project is configured for local-only development.

## 1. Install

```bash
npm install
```

## 2. Optional Environment Variables

Create `.env` in the project root if needed:

```bash
# Optional: disease detection provider key
PLANT_ID_API_KEY=your_real_plant_id_api_key

# Optional: custom disease endpoint
PLANT_ID_HEALTH_ENDPOINT=https://api.plant.id/v2/health_assessment

# Optional: AI assistant provider key
OPENAI_API_KEY=your_openai_api_key

# Optional: PostgreSQL mirror storage
DATABASE_URL=postgresql://username:password@host:5432/database

# Optional: force SSL for PostgreSQL connection
# SQL_SSL=require
```

## 3. Run

```bash
npm run dev
```

Open `http://localhost:5173`.

## 4. Data Storage

- User and app data: `.local-db.json`
- Uploaded files: `.local-uploads/`
- Local API server: `server/local-api.cjs`

If `DATABASE_URL` is configured and `.local-db.json` is missing, the backend bootstraps state from SQL snapshot (`app_state_snapshots`) automatically.

To push the current local DB into SQL immediately, run:

```bash
npm run sync:sql
```

### 4.1 Local PostgreSQL (Windows)

If you want true local PostgreSQL (not cloud), use this flow.

1. Install PostgreSQL:

```powershell
winget install -e --id PostgreSQL.PostgreSQL.16
```

2. Start service (service name may vary by version):

```powershell
Get-Service *postgres* | Format-Table Name,Status
Start-Service postgresql-x64-16
```

3. Create a local database and user (adjust values as needed):

```powershell
psql -U postgres -h localhost -c "CREATE DATABASE smart_farming;"
psql -U postgres -h localhost -c "CREATE USER smart_user WITH ENCRYPTED PASSWORD 'smart_pass';"
psql -U postgres -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE smart_farming TO smart_user;"
```

4. Set runtime env vars for this project:

```powershell
$env:DATABASE_URL="postgresql://smart_user:smart_pass@localhost:5432/smart_farming"
$env:SQL_SSL="false"
```

5. Sync current local JSON data to SQL snapshot:

```powershell
npm run sync:sql
```

6. Verify backend health SQL state:

```powershell
Invoke-RestMethod http://localhost:5173/api/health
```

## 5. Admin Login

- Email: `admin@smartfarming.local`
- Password: `admin123`

## Notes

- Supabase is not required.
- Database migrations under `supabase/migrations/` are optional schema references and do not affect local runtime.
