const fs = require('fs');

const content = fs.readFileSync('parsed_stock_report.txt', 'utf8');
const lines = content.split('\n').map(l => l.trim());

// Data structures
let currentGroup = '';
let products = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  if (
    line.startsWith('STOCK BALANCE REPORT') ||
    line.startsWith('As On :') ||
    line.startsWith('Product Description') ||
    line.startsWith('Page ') ||
    line.startsWith('Opening') ||
    line.startsWith('-- ')
  ) {
    continue;
  }

  const parts = line.split('\t').map(p => p.trim());
  const firstCol = parts[0] ? parts[0].toUpperCase() : '';
  const isUnit = ['GALLON', 'QUARTER', 'DRUM', 'PIECS', 'PIECES', 'CAN', 'BAG', 'KG', 'LTR', 'LITER', 'TUBE', 'PKT', 'PACKET', 'FOOT'].includes(firstCol);

  if (isUnit) {
    const isSubtotal = parts.length === 5 && parts.slice(1).every(p => /^-?\d+(\.\d+)?$/.test(p));
    if (!isSubtotal && parts.length >= 4) {
      const unit = parts[0];
      const sNo = parts[1];
      const codeAndDesc = parts[3];

      // Ignore Sunrise and Diamond
      if (/sunrise/i.test(currentGroup) || /diamond/i.test(currentGroup) || /sunrise/i.test(codeAndDesc) || /diamond/i.test(codeAndDesc)) {
        continue;
      }

      // Parse code and shade
      const codeMatch = codeAndDesc.match(/^([A-Za-z0-9\-\/]+)\s*(.*)$/);
      let code = codeAndDesc;
      let shade = '';
      if (codeMatch) {
        code = codeMatch[1];
        shade = codeMatch[2] || '';
      }

      products.push({
        group: currentGroup,
        unit,
        sNo,
        code,
        shade,
        fullDesc: codeAndDesc,
        opening: 0,
        balance: 0
      });
    }
  } else {
    if (parts.length === 1 && line.length > 2 && !/^\d+$/.test(line) && !line.startsWith('-180846')) {
      currentGroup = line;
    }
  }
}

// Classify Brand and Series
function classifyBrandAndSeries(groupName) {
  const g = groupName.toUpperCase();
  if (g.startsWith('GOBI')) {
    let series = 'General Series';
    if (g.includes('GOLD')) series = 'Gold Series';
    else if (g.includes('SILK SHEEN')) series = 'Silk Sheen (Premium)';
    else if (g.includes('ARMOR')) series = 'Armor Series';
    else if (g.includes('VALMATE') || g.includes('SUMMER') || g.includes('KONTRA')) series = 'Valmate / Summer / Kontra';
    else if (g.includes('EGGSHELL')) series = 'Eggshell Special Shades';
    else if (g.includes('SONA LAPI') || g.includes('LAPI') || g.includes('PUTTY')) series = 'Putty & Surface Prep';
    else if (g.includes('CAR MAN')) series = 'Car Man Synthetic';
    else if (g.includes('HEAT FLEX')) series = 'Heat Flex Speciality';
    else if (g.includes('THINER') || g.includes('THINNER')) series = 'Thinners & Solvents';
    else if (g.includes('AQUEOUS MATT')) series = 'Aqueous Matt (Premium)';
    return { brand: "GOBI'S", series };
  } else if (g.startsWith('RELIANCE')) {
    let series = 'General Series';
    if (g.includes('PLASTIC EMULSION')) series = 'Plastic Emulsion';
    else if (g.includes('WEATHER GUARD')) series = 'Weather Guard';
    else if (g.includes('EASY COAT')) series = 'Easy Coat';
    else if (g.includes('SUPER ENAMEL') || g.includes('SYNTHETIC ENAMEL')) series = 'Synthetic Enamel';
    return { brand: 'RELIANCE', series };
  } else if (g.startsWith('BRIGHTO')) {
    let series = 'Boom Series';
    if (g.includes('SUPER MASTIC')) series = 'Boom Super Mastic';
    else if (g.includes('GLOSS ENAMEL')) series = 'Boom Gloss Enamel';
    else if (g.includes('SUPER SILK')) series = 'Boom Super Silk';
    return { brand: 'BRIGHTO', series };
  } else if (g.startsWith('BERGER')) {
    return { brand: 'BERGER', series: 'Water Base Primer' };
  } else if (g.startsWith('KAIZEN')) {
    return { brand: 'KAIZEN', series: 'Industrial Coatings' };
  } else if (g.startsWith('RELIABLE')) {
    return { brand: 'RELIABLE', series: 'Reliable Series' };
  } else if (g.startsWith('BLUE BIRD')) {
    return { brand: 'BLUE BIRD', series: 'Wood Care & Varnish' };
  } else if (g.startsWith('NIPPON')) {
    return { brand: 'NIPPON', series: 'Q Enamel' };
  } else if (g.startsWith('CHOICE')) {
    return { brand: 'CHOICE', series: 'Premier Series' };
  } else if (g.startsWith('ROZZI')) {
    return { brand: 'ROZZI', series: 'Lac Undercoat' };
  } else if (g.startsWith('BLACKHORSE')) {
    return { brand: 'BLACKHORSE', series: 'Gloss Finish Enamel' };
  } else if (g.startsWith('SILK GOLDEN')) {
    return { brand: 'SILK GOLDEN', series: 'Silk Matt' };
  } else if (g.startsWith('UJALA')) {
    return { brand: 'UJALA', series: 'Synthetic Enamel' };
  } else {
    return { brand: 'GENERAL HARDWARE', series: 'Tools & Adhesives' };
  }
}

// Categorize product
function classifyCategory(groupName) {
  const g = groupName.toUpperCase();
  if (g.includes('EMULSION')) return 'Emulsion';
  if (g.includes('ENAMEL')) return 'Enamel';
  if (g.includes('MATT')) return 'Matt Finish';
  if (g.includes('WEATHER') || g.includes('GUARD') || g.includes('SHEILD')) return 'Weather Shield / Exterior';
  if (g.includes('SEALER') || g.includes('PRIMER') || g.includes('UNDER COAT') || g.includes('UNDERCOAT')) return 'Sealers & Primers';
  if (g.includes('PUTTY') || g.includes('LAPI') || g.includes('FILLING')) return 'Wall Putty & Fillers';
  if (g.includes('VARNISH') || g.includes('LACQUER')) return 'Varnish & Clear Finish';
  if (g.includes('THINNER') || g.includes('THINER')) return 'Thinners & Solvents';
  if (g.includes('GLUE') || g.includes('ADHESIVE') || g.includes('REGMAR') || g.includes('BRUSH') || g.includes('RUBBER')) return 'Tools, Adhesives & Accessories';
  return 'General Paint';
}

// Build catalog hierarchy
const catalog = {};
const allUnits = new Set();
const allCategories = new Set();

for (const p of products) {
  const { brand, series } = classifyBrandAndSeries(p.group);
  const category = classifyCategory(p.group);
  allUnits.add(p.unit);
  allCategories.add(category);

  if (!catalog[brand]) catalog[brand] = {};
  if (!catalog[brand][series]) catalog[brand][series] = [];
  catalog[brand][series].push({
    ...p,
    category
  });
}

// Also process image products (Gobi's price lists)
const imageGobis = [
  // Image 1: Summer, Valmate & Kontra Series
  { series: 'Valmate / Summer / Kontra', name: 'Gobis Summer Valmate Kontra Interior Emulsion', category: 'Emulsion', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Valmate / Summer / Kontra', name: 'Gobis Summer Valmate Kontra Interior Emulsion (Special Shades 66,33,65,28,14,21,29,20,62)', category: 'Emulsion', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Valmate / Summer / Kontra', name: 'Gobis Summer Valmate Kontra Gloss Enamel', category: 'Enamel', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)'] },
  { series: 'Valmate / Summer / Kontra', name: 'Gobis Summer Valmate Kontra Weather Shield', category: 'Weather Shield / Exterior', packings: ['Gallon (4 Ltr)', 'Drum (16 Ltr)'] },
  { series: 'Valmate / Summer / Kontra', name: 'Gobis Summer Valmate Kontra Wall Sealer (Water Base)', category: 'Sealers & Primers', packings: ['Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Valmate / Summer / Kontra', name: 'Gobis Summer Valmate Kontra Wall Sealer (Oil Base)', category: 'Sealers & Primers', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Valmate / Summer / Kontra', name: 'Gobis Summer Valmate Kontra Wall Putty', category: 'Wall Putty & Fillers', packings: ['Gallon (5 Kg)', 'Drum (20 Kg)'] },

  // Image 2: Gobis Gold Series
  { series: 'Gold Series', name: "Gobi's Gold Emulsion", category: 'Emulsion', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Gold Series', name: "Gobi's Gold Emulsion (Special Shades 14,20,28,29,30,32,62)", category: 'Emulsion', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Gold Series', name: "Gobi's Gold Gloss Finish Enamel", category: 'Enamel', packings: ['Small Quarter (0.25 Ltr)', 'Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Gold Series', name: "Gobi's Gold Metallic Enamel", category: 'Enamel', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Gold Series', name: "Gobi's Gold Enamel Matt Finish", category: 'Matt Finish', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Gold Series', name: "Gobi's Gold Aqueous Matt Finish", category: 'Matt Finish', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Gold Series', name: "Gobi's Gold Weather Guard (Exterior Finish)", category: 'Weather Shield / Exterior', packings: ['Quarter (1 Ltr)', 'Gallon (4 Ltr)', 'Drum (16 Ltr)'] },
  { series: 'Gold Series', name: "Gobi's Gold Wall Sealer (Oil base)", category: 'Sealers & Primers', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Gold Series', name: "Gobi's Gold Wall Sealer (Water base)", category: 'Sealers & Primers', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Gold Series', name: "Gobi's Gold Wall Putty", category: 'Wall Putty & Fillers', packings: ['Quarter (1.25 Kg)', 'Gallon (5 Kg)', 'Drum (20 Kg)'] },
  { series: 'Gold Series', name: "Gobi's Gold Under Coat White", category: 'Sealers & Primers', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)'] },
  { series: 'Gold Series', name: "Gobi's Gold Under Coat Grey", category: 'Sealers & Primers', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)'] },
  { series: 'Gold Series', name: "Gobi's Gold Synthetic Clear Varnish", category: 'Varnish & Clear Finish', packings: ['Small Quarter (0.25 Ltr)', 'Quarter (0.75 Ltr)', 'Gallon (3 Ltr)', 'Drum (20 Ltr)'] },
  { series: 'Gold Series', name: "Gobi's Gold Red Oxide Primer", category: 'Sealers & Primers', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },

  // Image 3: Gobis Premium Series
  { series: 'Silk Sheen (Premium)', name: "Gobi's Silk Sheen Emulsion", category: 'Emulsion', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Silk Sheen (Premium)', name: "Gobi's Silk Sheen Emulsion (Special Shades 15,17,66,70,98)", category: 'Emulsion', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Aqueous Matt (Premium)', name: "Gobi's Gloss Finish Enamel", category: 'Enamel', packings: ['Small Quarter (0.25 Ltr)', 'Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Aqueous Matt (Premium)', name: "Gobi's Enamel Matt Finish", category: 'Matt Finish', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Aqueous Matt (Premium)', name: "Gobi's Matt Finish (Special Shades 37,38,50,52,63,80,82,84,85,86)", category: 'Matt Finish', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Aqueous Matt (Premium)', name: "Gobi's Aqueous Matt Finish", category: 'Matt Finish', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Aqueous Matt (Premium)', name: "Gobi's Plastic Emulsion", category: 'Emulsion', packings: ['Quarter (1.0 Ltr)', 'Gallon (4.0 Ltr)', 'Drum (16 Ltr)'] },
  { series: 'Aqueous Matt (Premium)', name: "Gobi's Protector (Exterior Finish)", category: 'Weather Shield / Exterior', packings: ['Quarter (1.0 Ltr)', 'Gallon (4.0 Ltr)', 'Drum (16 Ltr)'] },
  { series: 'Aqueous Matt (Premium)', name: "Gobi's Wall Sealer", category: 'Sealers & Primers', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Aqueous Matt (Premium)', name: "Gobi's Aqueous (water base) Wall Sealer", category: 'Sealers & Primers', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Aqueous Matt (Premium)', name: "Gobi's Red Oxide Primer", category: 'Sealers & Primers', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Putty & Surface Prep', name: "Gobi's Wall Filler (Sona Lappi)", category: 'Wall Putty & Fillers', packings: ['Quarter (1.25 Kg)', 'Gallon (5 Kg)', 'Drum (20 Kg)'] },
  { series: 'Aqueous Matt (Premium)', name: "Gobi's Under Coat", category: 'Sealers & Primers', packings: ['Quarter (0.91 Ltr)', 'Gallon (3.64 Ltr)', 'Drum (14.56 Ltr)'] },
  { series: 'Aqueous Matt (Premium)', name: "Gobi's Premium Synthetic Varnish", category: 'Varnish & Clear Finish', packings: ['Quarter (0.75 Ltr)', 'Gallon (3 Ltr)', 'Drum (20 Ltr)'] },
  { series: 'Putty & Surface Prep', name: "Gobi's Wall Filler Exterior Gold", category: 'Wall Putty & Fillers', packings: ['Drum (20 Kg)'] },
  { series: 'Aqueous Matt (Premium)', name: "Gobi's Black Board Paint", category: 'Enamel', packings: ['Small Quarter (0.25 Ltr)'] },
];

const summary = {
  brands: Object.keys(catalog).map(brand => {
    const seriesObj = catalog[brand];
    return {
      brand,
      series: Object.keys(seriesObj).map(s => ({
        name: s,
        productCount: seriesObj[s].length,
        units: [...new Set(seriesObj[s].map(p => p.unit))],
        categories: [...new Set(seriesObj[s].map(p => p.category))]
      })),
      totalProducts: Object.values(seriesObj).reduce((sum, arr) => sum + arr.length, 0)
    };
  }),
  imageCatalogLines: imageGobis.length,
  imageTotalSKUs: imageGobis.reduce((sum, item) => sum + item.packings.length, 0),
  allUnits: Array.from(allUnits),
  allCategories: Array.from(allCategories),
  totalPdfProducts: products.length,
  catalog
};

fs.writeFileSync('catalog_audit_complete.json', JSON.stringify(summary, null, 2));
console.log('Catalog audit complete successfully!');
console.log('Brands found:', summary.brands.map(b => `${b.brand} (${b.totalProducts} items)`).join(', '));
console.log('Units found:', summary.allUnits.join(', '));
console.log('Categories found:', summary.allCategories.join(', '));
