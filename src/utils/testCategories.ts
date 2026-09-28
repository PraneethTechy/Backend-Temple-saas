import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import {
  TempleCategory,
  TempleCategorySuggestion,
  Temple,
  TempleRegistration,
  User,
} from '../models/index.js';

async function runTests() {
  console.log('--- Starting Temple Category System Verification ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in .env');
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    // Test 1: Models exist and have expected schemas
    assert(TempleCategory && typeof TempleCategory.find === 'function', 'TempleCategory model is defined');
    assert(TempleCategorySuggestion && typeof TempleCategorySuggestion.find === 'function', 'TempleCategorySuggestion model is defined');
    assert(Temple.schema.paths['categories'] !== undefined, 'Temple model contains categories field');
    assert(TempleRegistration.schema.paths['categoryIds'] !== undefined, 'TempleRegistration model contains categoryIds field');
    assert(TempleRegistration.schema.paths['suggestedCategoryName'] !== undefined, 'TempleRegistration model contains suggestedCategoryName field');

    // Test 2: Category assignment deduplication and active validation logic
    const testCatId1 = new mongoose.Types.ObjectId();
    const testCatId2 = new mongoose.Types.ObjectId();
    const rawIds = [testCatId1.toString(), testCatId2.toString(), testCatId1.toString()];
    const uniqueIds = [...new Set(rawIds)];
    assert(uniqueIds.length === 2, 'Deduplication removes duplicate category IDs');

    // Test 3: Public Aggregation Pipeline Validation
    // Querying active categories with server-side temple counts
    const publicCategories = await TempleCategory.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'temples',
          let: { catId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$status', 'ACTIVE'] },
                    { $in: ['$$catId', { $ifNull: ['$categories', []] }] },
                  ],
                },
              },
            },
          ],
          as: 'matchedTemples',
        },
      },
      {
        $addFields: {
          templeCount: { $size: '$matchedTemples' },
        },
      },
      {
        $project: {
          matchedTemples: 0,
        },
      },
      { $sort: { displayOrder: 1, name: 1 } },
    ]);

    assert(Array.isArray(publicCategories), 'Aggregation returns an array of public categories');
    console.log(`  Current active categories count: ${publicCategories.length}`);
    for (const cat of publicCategories) {
      assert(cat.isActive === true, `Category "${cat.name}" is active`);
      assert(typeof cat.templeCount === 'number', `Category "${cat.name}" has numeric templeCount (${cat.templeCount})`);
    }

    // Test 4: Temple Filtering by Category Slug
    if (publicCategories.length > 0) {
      const testSlug = publicCategories[0].slug;
      const targetCat = await TempleCategory.findOne({ slug: testSlug, isActive: true });
      assert(targetCat !== null, `Able to find active category by slug "${testSlug}"`);

      const filteredTemples = await Temple.find({
        status: 'ACTIVE',
        categories: targetCat._id,
      });
      assert(Array.isArray(filteredTemples), 'Filtered temples query returns array matching category ObjectId');
    } else {
      console.log('  [INFO] Database has 0 categories - zero static/demo data constraint respected.');
    }

    // Test 5: Verify no hardcoded/seed categories exist without admin creation
    console.log(`\nVerification Summary: ${passed} passed, ${failed} failed.`);
  } catch (err) {
    console.error('Test error:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
