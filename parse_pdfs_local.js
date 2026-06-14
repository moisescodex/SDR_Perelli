const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const projectPath = 'c:\\Users\\Mario Di Biase\\Documents\\pp2021\\oCodex\\agentes\\SDR_Perelli';
const docsDir = path.join(projectPath, 'documentos');

const pdfs = [
  'AUSTA_Medida-Certa50_ADESAO - 2025.pdf',
  'Copart Med Certa 50 - Valores Apróximados.pdf',
  'bvx_informe de produtos_AUSTA_Medida-Certa50_EMPRESARIAL_V26-05-2025[1].pdf'
];

async function parsePdf(fileName) {
  const filePath = path.join(docsDir, fileName);
  console.log(`Processing ${fileName}...`);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  const dataBuffer = fs.readFileSync(filePath);
  try {
    const data = await pdf(dataBuffer);
    const text = data.text;
    const outName = fileName.replace('.pdf', '_text.txt');
    const outPath = path.join(docsDir, outName);
    fs.writeFileSync(outPath, text, 'utf8');
    console.log(`Saved text to ${outPath}`);
  } catch (error) {
    console.error(`Error parsing ${fileName}:`, error);
  }
}

async function run() {
  for (const file of pdfs) {
    await parsePdf(file);
  }
  console.log('Done!');
}

run();
