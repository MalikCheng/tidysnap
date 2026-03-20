// Script to generate test fixture images
// Run: node tests/scripts/generate-fixtures.js

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const fixturesDir = path.join(process.cwd(), 'tests/fixtures');

// Ensure directory exists
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// Generate a simple messy desk placeholder
async function generateMessyDesk(filename, width = 800, height = 600, complexity = 1) {
  // Create SVG with colored rectangles representing desk items
  const itemCount = 5 + complexity * 3;
  let rects = [];

  for (let i = 0; i < itemCount; i++) {
    const x = Math.random() * (width - 100);
    const y = Math.random() * (height - 100);
    const w = 50 + Math.random() * 100;
    const h = 30 + Math.random() * 80;
    const color = `hsl(${Math.random() * 360}, 50%, 50%)`;
    rects.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" opacity="0.8"/>`);
  }

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f5f5f5"/>
      <rect x="50" y="50" width="${width - 100}" height="${height - 100}" fill="#d4a574" rx="5"/>
      ${rects.join('\n')}
      <text x="50%" y="50%" text-anchor="middle" fill="#333" font-size="16">Messy Desk Test Fixture</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .jpeg({ quality: 80 })
    .toFile(path.join(fixturesDir, filename));

  console.log(`Generated: ${filename}`);
}

async function generateCleanDesk(filename, width = 800, height = 600) {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <rect x="50" y="50" width="${width - 100}" height="${height - 100}" fill="#d4a574" rx="5"/>
      <rect x="200" y="200" width="400" height="200" fill="#e8e8e8" rx="3"/>
      <text x="50%" y="50%" text-anchor="middle" fill="#333" font-size="16">Clean Desk (Control)</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .jpeg({ quality: 80 })
    .toFile(path.join(fixturesDir, filename));

  console.log(`Generated: ${filename}`);
}

async function generateOversized(filename) {
  const svg = `
    <svg width="2000" height="2000" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ff9999"/>
      <text x="50%" y="50%" text-anchor="middle" fill="#333" font-size="24">OVERSIZED - 12MB+</text>
    </svg>
  `;

  // Generate large file by lowering compression
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 100 })
    .toFile(path.join(fixturesDir, filename));

  console.log(`Generated: ${filename}`);
}

async function main() {
  console.log('Generating test fixtures...\n');

  try {
    await generateMessyDesk('desktop-messy-1.jpg', 800, 600, 1);
    await generateMessyDesk('desktop-messy-2.jpg', 1024, 768, 2);
    await generateCleanDesk('desktop-clean.jpg');
    await generateMessyDesk('mobile-messy.jpg', 375, 667, 1);
    await generateOversized('oversize.jpg');

    // Create a small PDF placeholder (for file type test)
    const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    fs.writeFileSync(path.join(fixturesDir, 'wrong-type.pdf'), pdfBuffer);
    console.log('Generated: wrong-type.pdf');

    console.log('\n✅ All fixtures generated successfully!');
    console.log(`📁 Location: ${fixturesDir}`);
  } catch (error) {
    console.error('Error generating fixtures:', error);
    process.exit(1);
  }
}

main();
