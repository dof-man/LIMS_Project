# LIMS Project

A Laboratory Information Management System built with Next.js, Prisma, and PostgreSQL.

## Tech Stack

- **Next.js 16** - React framework with App Router (JavaScript)
- **Prisma 7** - Database ORM with PostgreSQL adapter
- **PostgreSQL 14** - Relational database
- **Tailwind CSS** - Styling
- **Session-based Authentication** - Secure user authentication with bcrypt

## Features

- ✅ Complete LIMS database schema (patients, tests, samples, results, inventory, billing)
- ✅ Session-based authentication with role-based access control (RBAC)
- ✅ Four user roles: RECEPTION, LAB_STAFF, ADMIN, SUPERUSER
- ✅ Comprehensive permission system with reusable RBAC utilities
- ✅ Protected API routes and middleware
- ✅ User management dashboard
- ✅ Patient registration system

## Documentation

- **[SETUP.md](./SETUP.md)** - Detailed setup instructions
- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - Authentication system guide
- **[RBAC_GUIDE.md](./RBAC_GUIDE.md)** - Role-Based Access Control usage guide
- **[SCHEMA_DOCUMENTATION.md](./SCHEMA_DOCUMENTATION.md)** - Database schema reference
- **[DATABASE_GUIDE.md](./DATABASE_GUIDE.md)** - Database management guide
- **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - Migration history

## Prerequisites

- Node.js 18+ installed
- PostgreSQL installed and running

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure database:**
   ```bash
   # Copy environment variables
   cp .env.example .env
   
   # Edit .env and update DATABASE_URL
   # Example: postgresql://postgres:password@localhost:5432/lims_db
   ```

3. **Create database:**
   ```bash
   createdb -U postgres lims_db
   ```

4. **Run migrations:**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Create initial superuser:**
   ```bash
   node scripts/create-superuser-simple.js admin admin@example.com admin123
   ```

6. **Start development server:**
   ```bash
   npm run dev
   ```

7. **Login:**
   - Visit [http://localhost:3000](http://localhost:3000)
   - Username: `admin`
   - Password: `admin123`

For detailed setup instructions, see [SETUP.md](./SETUP.md).

## Role-Based Access Control

The system has four user roles with hierarchical permissions:

1. **RECEPTION** - Front desk staff (patient registration, billing)
2. **LAB_STAFF** - Laboratory technicians (sample processing, result entry)
3. **ADMIN** - System administrators (user management, result verification)
4. **SUPERUSER** - System owners (full access, including admin creation)

### Using RBAC in Your Code

```javascript
import { requirePermission } from '@/lib/middleware';
import { canModifyPatients, canVerifyLabResults } from '@/lib/rbac';

// In API routes
export async function POST(request) {
  const authResult = await requirePermission(
    request,
    canModifyPatients,
    'You do not have permission to create patients'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }
  
  // User has permission, proceed with operation
  const user = authResult.user;
  // ... your code here
}
```

For complete RBAC usage examples and patterns, see **[RBAC_GUIDE.md](./RBAC_GUIDE.md)**.

## API Routes

All API routes are protected with authentication and role-based permissions:

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/session` - Get current session
- `GET /api/users` - List users (requires user management permission)
- `POST /api/users` - Create user (requires user management permission)
- `GET /api/patients` - List patients (requires patient access permission)
- `POST /api/patients` - Create patient (requires patient modification permission)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npx prisma studio` - Open Prisma Studio (database GUI)
- `npx prisma migrate dev` - Create and apply migrations
- `npx prisma generate` - Generate Prisma Client
- `node scripts/verify-db.js` - Verify database connection
- `node scripts/test-models.js` - Test Prisma models
- `node scripts/create-superuser-simple.js` - Create superuser

## Database Schema

The system includes comprehensive models for:

**Clinical Management:**
- Patient - Patient demographics and registration
- TestRequest - Laboratory test orders
- TestRequestItem - Individual tests in an order (links clinical to billing)
- Sample - Physical specimens
- LabParameter - Test parameters and reference ranges
- LabResult - Test results container
- LabResultValue - Individual parameter results
- InvestigationResult - Radiology and special test results

**Inventory & Billing:**
- InventoryItem - Master catalog of all billable items
- Order - Billing orders
- OrderItem - Individual order line items
- Payment - Payment records

**Authentication:**
- User - System users with roles
- Session - User sessions

For detailed schema documentation, see [SCHEMA_DOCUMENTATION.md](./SCHEMA_DOCUMENTATION.md).

## Project Structure

```
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── users/                # User management (admin only)
│   │   └── patients/             # Patient management
│   ├── dashboard/                # Protected dashboard pages
│   │   └── users/                # User management UI
│   ├── login/                    # Login page
│   ├── layout.js                 # Root layout
│   └── page.js                   # Home page (redirects)
├── lib/                          # Utility libraries
│   ├── prisma.js                 # Prisma client singleton
│   ├── auth.js                   # Authentication utilities
│   ├── middleware.js             # Request middleware
│   └── rbac.js                   # Role-based access control utilities
├── prisma/                       # Prisma configuration
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Database migrations
├── scripts/                      # Utility scripts
│   ├── verify-db.js              # Database connection test
│   ├── test-models.js            # Prisma model test
│   └── create-superuser-simple.js # Superuser creation
├── examples/                     # Code examples
│   └── lab-results-api-example.js # RBAC usage example
├── .env                          # Environment variables (not in git)
├── .env.example                  # Environment template
├── prisma.config.ts              # Prisma configuration
└── package.json                  # Dependencies and scripts
```

## Examples

Check the `examples/` directory for complete implementation examples:

- **lab-results-api-example.js** - Complete API route with RBAC integration

## Next Steps

- [ ] Implement lab results entry UI
- [ ] Add sample collection workflow
- [ ] Create billing and payment processing
- [ ] Build inventory management interface
- [ ] Add reporting and analytics
- [ ] Implement audit logging
- [ ] Add email notifications
- [ ] Create patient portal

## Testing Database Connection

```bash
# Test database connectivity
node scripts/verify-db.js

# Test Prisma models
node scripts/test-models.js

# Open Prisma Studio
npx prisma studio
```

## Troubleshooting

### Database Connection Issues

1. Ensure PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   # or
   pg_isready
   ```

2. Verify your DATABASE_URL is correct in `.env`

3. Check if the database exists:
   ```bash
   psql -U postgres -l
   ```

4. Test connection manually:
   ```bash
   psql postgresql://USERNAME:PASSWORD@localhost:5432/lims_db
   ```

### Prisma Issues

If you encounter Prisma-related errors:

```bash
# Regenerate Prisma Client
npx prisma generate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View database in browser
npx prisma studio
```

## License

MIT
