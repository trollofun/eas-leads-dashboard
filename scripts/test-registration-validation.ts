#!/usr/bin/env tsx
/**
 * Test registration number validation
 * EUR-114 Task #2 verification
 */

import { validateAndNormalizePlate, isValidRoPlate, normalizePlate } from '../src/lib/plate-validator';

console.log('═══════════════════════════════════════════════════════');
console.log('  Registration Number Validation Tests (EUR-114)');
console.log('═══════════════════════════════════════════════════════\n');

const testCases = [
  // Valid formats
  { input: 'CT-05-EAM', expected: 'CT05EAM', shouldPass: true },
  { input: 'B-123-ABC', expected: 'B123ABC', shouldPass: true },
  { input: 'BH12XYZ', expected: 'BH12XYZ', shouldPass: true },
  { input: 'ct-05-eam', expected: 'CT05EAM', shouldPass: true }, // lowercase
  { input: 'B 123 ABC', expected: 'B123ABC', shouldPass: true }, // spaces
  { input: 'IF-98-DEF', expected: 'IF98DEF', shouldPass: true },

  // Invalid formats
  { input: 'ZZ-05-EAM', expected: '', shouldPass: false }, // bad county
  { input: 'CT-1-ABC', expected: '', shouldPass: false }, // 1 digit only
  { input: 'CT-1234-ABC', expected: '', shouldPass: false }, // 4 digits
  { input: 'CT-05-AB', expected: '', shouldPass: false }, // 2 letters only
  { input: 'CT-05-ABCD', expected: '', shouldPass: false }, // 4 letters
  { input: 'CT-05-ABI', expected: '', shouldPass: false }, // I not allowed
  { input: 'CT-05-ABO', expected: '', shouldPass: false }, // O not allowed
  { input: 'CT-05-ABQ', expected: '', shouldPass: false }, // Q not allowed
  { input: '123-ABC', expected: '', shouldPass: false }, // missing county
  { input: 'CT05', expected: '', shouldPass: false }, // missing letters
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  try {
    const result = validateAndNormalizePlate(testCase.input);
    if (testCase.shouldPass && result === testCase.expected) {
      console.log(`✓ PASS: "${testCase.input}" → "${result}"`);
      passed++;
    } else if (testCase.shouldPass) {
      console.log(`✗ FAIL: "${testCase.input}" → "${result}" (expected "${testCase.expected}")`);
      failed++;
    } else {
      console.log(`✗ FAIL: "${testCase.input}" should have thrown error but returned "${result}"`);
      failed++;
    }
  } catch (err: any) {
    if (!testCase.shouldPass) {
      console.log(`✓ PASS: "${testCase.input}" → rejected (${err.message.split('.')[0]})`);
      passed++;
    } else {
      console.log(`✗ FAIL: "${testCase.input}" → unexpected error: ${err.message}`);
      failed++;
    }
  }
}

console.log('\n═══════════════════════════════════════════════════════');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
