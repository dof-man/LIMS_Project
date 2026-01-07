#!/usr/bin/env node

/**
 * Quick Database Test
 * Tests that Prisma Client can access all models
 */

import 'dotenv/config';
import prisma from '../lib/prisma.js';

async function testModels() {
  console.log('🧪 Testing Prisma Client model access...\n');
  
  const models = [
    'user',
    'session',
    'patient',
    'testRequest', 
    'testRequestItem',
    'sample',
    'labParameter',
    'labResult',
    'labResultValue',
    'investigationResult',
    'inventoryItem',
    'order',
    'orderItem',
    'payment'
  ];
  
  try {
    for (const model of models) {
      const count = await prisma[model].count();
      console.log(`✅ ${model}: ${count} records`);
    }
    
    console.log('\n✅ All models accessible!');
    console.log('Prisma Client is working correctly 🚀\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testModels();
