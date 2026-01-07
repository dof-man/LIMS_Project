# Database Migration Guide

## ✅ Completed Steps

1. ✅ Prisma migration generated: `20260104100750_init_lims_schema`
2. ✅ Migration applied to database
3. ✅ Prisma Client generated
4. ✅ Database connectivity verified
5. ✅ All 12 tables created successfully

## Database Status

**Database:** lims_db  
**User:** postgres  
**PostgreSQL Version:** 14.20  
**Tables Created:** 13 (12 models + 1 migration tracking)

### Created Tables:
- `patients`
- `test_requests`
- `test_request_items`
- `samples`
- `lab_parameters`
- `lab_results`
- `lab_result_values`
- `investigation_results`
- `inventory_items`
- `orders`
- `order_items`
- `payments`
- `_prisma_migrations` (Prisma tracking table)

## Available Database Commands

### Verification & Inspection

```bash
# Verify database connectivity and show table info
npm run db:verify

# Open Prisma Studio (visual database browser)
npm run db:studio

# View migration history
npx prisma migrate status
```

### Schema Management

```bash
# Generate Prisma Client (after schema changes)
npm run db:generate
# or
npx prisma generate

# Create new migration (after schema changes)
npm run db:migrate
# or
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy
```

### Database Reset & Maintenance

```bash
# Reset database (WARNING: Deletes all data!)
npm run db:reset
# or
npx prisma migrate reset

# Push schema changes without migration (dev only)
npx prisma db push

# Pull schema from existing database
npx prisma db pull
```

### Advanced Commands

```bash
# Format Prisma schema file
npx prisma format

# Validate Prisma schema
npx prisma validate

# View connection status
npx prisma db execute --stdin <<< "SELECT 1"
```

## Migration Workflow

### Making Schema Changes

1. **Edit** `prisma/schema.prisma`
2. **Format** the schema: `npx prisma format`
3. **Validate** the schema: `npx prisma validate`
4. **Create migration**: `npm run db:migrate`
5. **Verify**: `npm run db:verify`

### Example: Adding a New Field

```prisma
model Patient {
  // ... existing fields ...
  nationality String?  // Add this field
}
```

Then run:
```bash
npx prisma migrate dev --name add_patient_nationality
```

### Example: Adding a New Model

```prisma
model Department {
  id          String   @id @default(uuid())
  name        String
  code        String   @unique
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("departments")
}
```

Then run:
```bash
npx prisma migrate dev --name add_departments_table
```

## Verification Script Features

The `scripts/verify-db.js` script checks:

- ✅ Database connection
- ✅ PostgreSQL version
- ✅ Table existence
- ✅ Record counts
- ✅ Write permissions
- ✅ Detailed error messages with solutions

Run it anytime with:
```bash
npm run db:verify
```

## Common Issues & Solutions

### Issue: "Database does not exist"

**Solution:**
```bash
createdb -U postgres lims_db
```

### Issue: "Authentication failed"

**Solution:**
1. Check `.env` file has correct credentials
2. Verify DATABASE_URL format:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/lims_db?schema=public"
   ```

### Issue: "Migration failed"

**Solution:**
```bash
# Check migration status
npx prisma migrate status

# If needed, reset and reapply
npx prisma migrate reset
npx prisma migrate dev
```

### Issue: "Prisma Client out of sync"

**Solution:**
```bash
npm run db:generate
```

## Migration Files

Migrations are stored in: `prisma/migrations/`

Current migrations:
- `20260104100750_init_lims_schema/` - Initial LIMS schema

Each migration folder contains:
- `migration.sql` - SQL commands to apply
- Metadata for Prisma tracking

## Database Backup

### Create Backup

```bash
pg_dump -U postgres lims_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Backup

```bash
psql -U postgres lims_db < backup_20260104_100750.sql
```

## Production Deployment

1. **Never use** `migrate dev` in production
2. **Use** `migrate deploy` instead:
   ```bash
   npx prisma migrate deploy
   ```

3. **Always backup** before migrations:
   ```bash
   pg_dump -U postgres lims_db > pre_migration_backup.sql
   npx prisma migrate deploy
   ```

## Environment Variables

Required in `.env`:

```env
DATABASE_URL="postgresql://username:password@host:port/database?schema=public"
NODE_ENV="development"
```

## Next Steps

Now that your database is set up, you can:

1. **Add seed data** (if needed):
   - Create `prisma/seed.js`
   - Add data using Prisma Client
   - Run: `npx prisma db seed`

2. **Create API routes** in `app/api/`
3. **Build UI components** to interact with data
4. **Add authentication** for user management
5. **Implement business logic** in services

## Useful Resources

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Client API](https://www.prisma.io/docs/concepts/components/prisma-client)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Database Setup Complete! 🎉**

Your LIMS database is now fully configured and ready for development.
