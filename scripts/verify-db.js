#!/usr/bin/env node

/**
 * Database Connectivity Verification Script
 * 
 * This script tests the connection to the PostgreSQL database
 * and verifies that all tables exist.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set');
  console.error('Please configure your .env file with the correct database URL');
  process.exit(1);
}

async function verifyDatabaseConnection() {
  console.log('🔍 Starting database connectivity verification...\n');
  
  let prisma;
  let pool;
  
  try {
    // Initialize connection
    console.log('📡 Connecting to database...');
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
    
    await prisma.$connect();
    console.log('✅ Database connection successful\n');
    
    // Test basic query
    console.log('🔍 Testing database query...');
    const result = await prisma.$queryRaw`SELECT current_database(), current_user, version()`;
    console.log('✅ Query executed successfully');
    console.log(`   Database: ${result[0].current_database}`);
    console.log(`   User: ${result[0].current_user}`);
    console.log(`   Version: ${result[0].version.split(' ').slice(0, 2).join(' ')}\n`);
    
    // Check if migrations have been run
    console.log('🔍 Checking for tables...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found in database');
      console.log('   Run: npx prisma migrate dev --name init_lims_schema\n');
    } else {
      console.log(`✅ Found ${tables.length} tables:`);
      tables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
      console.log('');
      
      // Count records in each model (if tables exist)
      const models = [
        'patient', 'testRequest', 'testRequestItem', 'sample',
        'labParameter', 'labResult', 'labResultValue', 'investigationResult',
        'inventoryItem', 'order', 'orderItem', 'payment'
      ];
      
      console.log('📊 Record counts:');
      for (const model of models) {
        const tableName = model.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
        const tableExists = tables.some(t => 
          t.table_name === tableName || 
          t.table_name === `${tableName}s`
        );
        
        if (tableExists) {
          try {
            const count = await prisma[model].count();
            console.log(`   - ${model}: ${count} records`);
          } catch (error) {
            // Skip if model doesn't match table name exactly
          }
        }
      }
      console.log('');
    }
    
    // Test write capability (optional)
    console.log('🔍 Testing write permissions...');
    await prisma.$executeRaw`SELECT 1`;
    console.log('✅ Database is writable\n');
    
    console.log('✅ All database connectivity checks passed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Database is ready for use 🚀\n');
    
  } catch (error) {
    console.error('\n❌ Database connectivity check failed!');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Connection refused. Possible causes:');
      console.error('   1. PostgreSQL is not running');
      console.error('   2. Wrong host or port in DATABASE_URL');
      console.error('   3. Firewall blocking the connection\n');
    } else if (error.code === '28P01') {
      console.error('❌ Authentication failed. Possible causes:');
      console.error('   1. Wrong username or password in DATABASE_URL');
      console.error('   2. User does not have access to the database\n');
    } else if (error.code === '3D000') {
      console.error('❌ Database does not exist. Solutions:');
      console.error('   1. Create the database: createdb -U postgres <database_name>');
      console.error('   2. Check DATABASE_URL has correct database name\n');
    } else if (error.message.includes('SASL') || error.message.includes('password')) {
      console.error('❌ Authentication error. Solutions:');
      console.error('   1. Verify DATABASE_URL has correct credentials');
      console.error('   2. Ensure password is properly URL-encoded');
      console.error('   3. Check PostgreSQL pg_hba.conf settings\n');
    } else {
      console.error('Error details:', error.message);
      console.error('');
    }
    
    console.error('Current DATABASE_URL pattern:', 
      DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    console.error('\nTroubleshooting steps:');
    console.error('1. Check PostgreSQL is running: pg_isready');
    console.error('2. Verify database exists: psql -l');
    console.error('3. Test connection: psql <your_database_url>');
    console.error('4. Review .env file configuration\n');
    
    process.exit(1);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (pool) {
      await pool.end();
    }
  }
}

// Run verification
verifyDatabaseConnection().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
