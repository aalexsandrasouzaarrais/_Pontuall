const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, 'dist');
const distHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

// Find css file and js file
const cssMatch = distHtml.match(/href="(\.\/assets\/[^"]+\.css)"/);
const jsMatch = distHtml.match(/src="(\.\/assets\/[^"]+\.js)"/);

if (!cssMatch || !jsMatch) {
  console.error('Could not find css or js bundles in dist/index.html');
  process.exit(1);
}

const cssRel = cssMatch[1].replace('./', '');
const jsRel = jsMatch[1].replace('./', '');

const cssContent = fs.readFileSync(path.join(distDir, cssRel), 'utf-8');
const jsContent = fs.readFileSync(path.join(distDir, jsRel), 'utf-8');

const standaloneHtml = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pontual - Portal do Colaborador & Gestão</title>
    <meta name="description" content="Sistema de Gestão de Escalas, Confirmação de Presença, Justificativas e Ponto Eletrônico" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="icon" type="image/png" href="logo-colaborador.png" />
    <style>
${cssContent}
    </style>
  </head>
  <body class="bg-[#0B0B0E] text-slate-100 antialiased font-sans">
    <div id="root"></div>
    <script type="module">
${jsContent}
    </script>
  </body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'Pontual-Colaborador.html'), standaloneHtml);
console.log('Pontual-Colaborador.html updated successfully with current build!');
