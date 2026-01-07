# Database Setup Guide

## Quick Start

To get your PostgreSQL database up and running:

### 1. Update Environment Variables

Edit the `.env` file and replace the placeholder values:

```env
DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/lims_db?schema=public"
```

**Example configurations:**

For local development with default PostgreSQL:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lims_db?schema=public"
```

For custom PostgreSQL setup:
```env
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/lims_db?schema=public"
```

### 2. Create the Database

Choose one of these methods:

**Method A: Using psql**
```bash
psql -U postgres -c "CREATE DATABASE lims_db;"
```

**Method B: Using createdb command**
```bash
createdb -U postgres lims_db
```

**Method C: Interactive psql session**
```bash
psql -U postgres
CREATE DATABASE lims_db;
\q
```

### 3. Run Migrations

Apply the database schema:

```bash
npx prisma migrate dev --name init
```

This command will:
- Connect to your PostgreSQL database
- Create all tables defined in `prisma/schema.prisma`
- Generate the Prisma Client for use in your application

### 4. Verify Setup

Test the database connection:

```bash
# Start the dev server if not already running
npm run dev

# In another terminal, test the API endpoint
curl http://localhost:3000/api/test-db
```

You should see a success message with `userCount: 0`.

## Common PostgreSQL Configurations

### Ubuntu/Debian

**Check if PostgreSQL is running:**
```bash
sudo systemctl status postgresql
```

**Start PostgreSQL:**
```bash
sudo systemctl start postgresql
```

**Access PostgreSQL:**
```bash
sudo -u postgres psql
```

**Default credentials:** Username: `postgres`, Password: (set during installation or none for local)

### macOS (Homebrew)

**Check if PostgreSQL is running:**
```bash
brew services list | grep postgresql
```

**Start PostgreSQL:**
```bash
brew services start postgresql@15
```

**Access PostgreSQL:**
```bash
psql postgres
```

### Windows

**Check if PostgreSQL is running:**
- Open Services (`services.msc`)
- Look for "postgresql-x64-XX" service

**Access PostgreSQL:**
```bash
psql -U postgres
```

Default password is set during installation.

## Troubleshooting

### "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string"

This means your DATABASE_URL has incorrect credentials. Check:
1. Username is correct
2. Password is properly set
3. No special characters are causing issues (URL encode if needed)

### "database does not exist"

Run the database creation command:
```bash
createdb -U postgres lims_db
```

### "password authentication failed"

Reset your PostgreSQL password:
```bash
sudo -u postgres psql
ALTER USER postgres PASSWORD 'newpassword';
\q
```

Then update `.env` with the new password.

### "could not connect to server"

PostgreSQL is not running. Start it using your system's service manager.

## Advanced Configuration

### Using a different database name

1. Update `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/my_custom_db?schema=public"
```

2. Create the database:
```bash
createdb -U postgres my_custom_db
```

3. Run migrations:
```bash
npx prisma migrate dev
```

### Using a remote database

Update `.env` with your remote database URL:
```env
DATABASE_URL="postgresql://username:password@your-host.com:5432/database_name?sslmode=require"
```

For cloud providers (Supabase, Neon, Railway, etc.), copy the connection string from your provider's dashboard.

### Connection pooling

For production, consider using connection pooling:

```env
DATABASE_URL="postgresql://user:password@host:5432/db?schema=public&connection_limit=10&pool_timeout=10"
```

## Next Steps

After successful setup:

1. **View your database:** Run `npx prisma studio` to open a GUI
2. **Add seed data:** Create a `prisma/seed.js` file
3. **Create migrations:** Modify `schema.prisma` and run `npx prisma migrate dev`
4. **Build APIs:** Create routes in `app/api/` to interact with your data

## Useful Prisma Commands

```bash
# Open Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma Client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name descriptive_name

# Apply migrations in production
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Pull existing database schema
npx prisma db pull

# Push schema changes without creating migrations (dev only)
npx prisma db push
```
