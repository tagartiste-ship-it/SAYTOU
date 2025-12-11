import puppeteer from 'puppeteer';

interface RencontreData {
  id: string;
  date: Date;
  heureDebut: string;
  heureFin: string;
  moderateur: string;
  moniteur: string;
  theme?: string | null;
  ordreDuJour?: any;
  presenceHomme: number;
  presenceFemme: number;
  presenceTotale: number;
  observations?: string | null;
  type: {
    name: string;
    isReunion: boolean;
  };
  section: {
    name: string;
    sousLocalite: {
      name: string;
    };
  };
  createdBy: {
    name: string;
  };
}

export async function generateRencontrePDF(rencontre: RencontreData, exportedBy: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    const html = generateRencontreHTML(rencontre, exportedBy);

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function generateRencontreHTML(rencontre: RencontreData, exportedBy: string): string {
  const dateFormatted = new Date(rencontre.date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const exportDate = new Date().toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rencontre - ${rencontre.type.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #0A0A0A;
      line-height: 1.6;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #0B6EFF;
    }
    
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #0B6EFF;
      margin-bottom: 10px;
    }
    
    .type-rencontre {
      font-size: 24px;
      font-weight: 600;
      color: #FF7A00;
      margin-top: 10px;
    }
    
    .info-section {
      background-color: #F7FAFC;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    
    .info-label {
      font-weight: 600;
      color: #0B6EFF;
      width: 40%;
    }
    
    .info-value {
      width: 60%;
      text-align: right;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #0B6EFF;
      margin-top: 25px;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #FF7A00;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    th, td {
      padding: 12px;
      text-align: left;
      border: 1px solid #ddd;
    }
    
    th {
      background-color: #0B6EFF;
      color: white;
      font-weight: 600;
    }
    
    tr:nth-child(even) {
      background-color: #F7FAFC;
    }
    
    .total-row {
      background-color: #FF7A00 !important;
      color: white;
      font-weight: bold;
    }
    
    .ordre-du-jour-item {
      background-color: #F7FAFC;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 8px;
      border-left: 4px solid #0B6EFF;
    }
    
    .ordre-numero {
      font-weight: bold;
      color: #FF7A00;
      margin-bottom: 8px;
    }
    
    .ordre-titre {
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 5px;
    }
    
    .ordre-description {
      color: #555;
      margin-top: 8px;
    }
    
    .observations {
      background-color: #F7FAFC;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #FF7A00;
      white-space: pre-wrap;
    }
    
    .signatures {
      display: flex;
      justify-content: space-around;
      margin-top: 50px;
      margin-bottom: 30px;
    }
    
    .signature-box {
      text-align: center;
      width: 30%;
    }
    
    .signature-label {
      font-weight: 600;
      color: #0B6EFF;
      margin-bottom: 40px;
    }
    
    .signature-line {
      border-top: 2px solid #0A0A0A;
      margin-top: 40px;
      padding-top: 5px;
      font-size: 12px;
      color: #666;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #ddd;
      font-size: 11px;
      color: #666;
      text-align: center;
    }
    
    .page-break {
      page-break-after: always;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">SAYTOU</div>
    <div>Application de Gestion de Rencontres</div>
    <div class="type-rencontre">${rencontre.type.name}</div>
  </div>

  <div class="info-section">
    <div class="info-row">
      <div class="info-label">Date :</div>
      <div class="info-value">${dateFormatted}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Horaire :</div>
      <div class="info-value">${rencontre.heureDebut} - ${rencontre.heureFin}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Sous-Localité :</div>
      <div class="info-value">${rencontre.section.sousLocalite.name}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Section :</div>
      <div class="info-value">${rencontre.section.name}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Modérateur :</div>
      <div class="info-value">${rencontre.moderateur}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Moniteur :</div>
      <div class="info-value">${rencontre.moniteur}</div>
    </div>
  </div>

  ${rencontre.type.isReunion ? generateOrdreDuJourHTML(rencontre.ordreDuJour) : generateThemeHTML(rencontre.theme)}

  <div class="section-title">Présences</div>
  <table>
    <thead>
      <tr>
        <th>Catégorie</th>
        <th style="text-align: center;">Nombre</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Hommes</td>
        <td style="text-align: center;">${rencontre.presenceHomme}</td>
      </tr>
      <tr>
        <td>Femmes</td>
        <td style="text-align: center;">${rencontre.presenceFemme}</td>
      </tr>
      <tr class="total-row">
        <td>TOTAL</td>
        <td style="text-align: center;">${rencontre.presenceTotale}</td>
      </tr>
    </tbody>
  </table>

  ${rencontre.observations ? `
    <div class="section-title">Observations</div>
    <div class="observations">${rencontre.observations}</div>
  ` : ''}

  <div class="signatures">
    <div class="signature-box">
      <div class="signature-label">Modérateur</div>
      <div class="signature-line">${rencontre.moderateur}</div>
    </div>
    <div class="signature-box">
      <div class="signature-label">Moniteur</div>
      <div class="signature-line">${rencontre.moniteur}</div>
    </div>
    <div class="signature-box">
      <div class="signature-label">Responsable</div>
      <div class="signature-line"></div>
    </div>
  </div>

  <div class="footer">
    <div>Document généré le ${exportDate}</div>
    <div>Exporté par : ${exportedBy}</div>
    <div>SAYTOU - Application de Gestion de Rencontres</div>
  </div>
</body>
</html>
  `;
}

function generateThemeHTML(theme?: string | null): string {
  if (!theme) return '';
  
  return `
    <div class="section-title">Thème</div>
    <div class="info-section">
      <div style="font-size: 16px; font-weight: 500;">${theme}</div>
    </div>
  `;
}

function generateOrdreDuJourHTML(ordreDuJour: any): string {
  if (!ordreDuJour || !Array.isArray(ordreDuJour)) return '';

  const items = ordreDuJour.map((item: any, index: number) => `
    <div class="ordre-du-jour-item">
      <div class="ordre-numero">Point ${item.ordre || index + 1}</div>
      <div class="ordre-titre">${item.titre || 'Sans titre'}</div>
      ${item.description ? `<div class="ordre-description">${item.description}</div>` : ''}
    </div>
  `).join('');

  return `
    <div class="section-title">Ordre du Jour</div>
    ${items}
  `;
}
