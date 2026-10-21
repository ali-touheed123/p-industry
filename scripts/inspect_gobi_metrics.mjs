import fs from 'fs';

// Load gobi items from DB dump
const dbData = JSON.parse(fs.readFileSync('gobi_db_items.json', 'utf-8'));
const dbItems = dbData.items;

console.log('Total Gobi DB Items for TPH:', dbItems.length);

// Check distinct units in DB for Gobi
const dbUnits = new Set(dbItems.map(it => it.unit));
console.log('DB Units for Gobi items:', Array.from(dbUnits));

// Check categories
const dbCats = new Set(dbItems.map(it => it.category));
console.log('DB Categories for Gobi items:', Array.from(dbCats));

// Check pricing status
const nonZeroCost = dbItems.filter(it => Number(it.cost_price || 0) > 0);
const nonZeroRetail = dbItems.filter(it => Number(it.retail_price || 0) > 0);

console.log('Gobi items with cost_price > 0:', nonZeroCost.length);
console.log('Gobi items with retail_price > 0:', nonZeroRetail.length);
