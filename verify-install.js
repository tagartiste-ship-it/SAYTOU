#!/usr/bin/env node

/**
 * Script de vérification de l'installation SAYTOU
 * Vérifie que toutes les dépendances sont installées et que le projet compile
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    log(`✅ ${description}`, 'green');
  } else {
    log(`❌ ${description} - MANQUANT`, 'red');
  }
  return exists;
}

function checkNodeModules(dir, name) {
  const nodeModulesPath = path.join(dir, 'node_modules');
  const exists = fs.existsSync(nodeModulesPath);
  if (exists) {
    log(`✅ ${name} - node_modules installé`, 'green');
  } else {
    log(`❌ ${name} - node_modules MANQUANT (exécuter: cd ${name} && npm install)`, 'red');
  }
  return exists;
}

function runCommand(command, cwd, description) {
  try {
    log(`\n🔍 Test: ${description}...`, 'cyan');
    execSync(command, { cwd, stdio: 'pipe' });
    log(`✅ ${description} - OK`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description} - ERREUR`, 'red');
    if (error.stdout) {
      log(`   Sortie: ${error.stdout.toString().substring(0, 200)}`, 'yellow');
    }
    if (error.stderr) {
      log(`   Erreur: ${error.stderr.toString().substring(0, 200)}`, 'yellow');
    }
    return false;
  }
}

async function main() {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'blue');
  log('║         🔍 VÉRIFICATION INSTALLATION SAYTOU 🔍            ║', 'blue');
  log('╚═══════════════════════════════════════════════════════════╝\n', 'blue');

  const rootDir = __dirname;
  const backendDir = path.join(rootDir, 'backend');
  const frontendDir = path.join(rootDir, 'frontend');

  let allChecks = true;

  // Vérification de la structure des fichiers
  log('\n📁 Vérification de la structure des fichiers...', 'cyan');
  allChecks &= checkFileExists(path.join(rootDir, 'package.json'), 'package.json racine');
  allChecks &= checkFileExists(path.join(rootDir, 'docker-compose.yml'), 'docker-compose.yml');
  allChecks &= checkFileExists(path.join(rootDir, 'README.md'), 'README.md');
  allChecks &= checkFileExists(path.join(rootDir, 'INSTALLATION.md'), 'INSTALLATION.md');
  
  log('\n📁 Backend...', 'cyan');
  allChecks &= checkFileExists(path.join(backendDir, 'package.json'), 'Backend package.json');
  allChecks &= checkFileExists(path.join(backendDir, 'tsconfig.json'), 'Backend tsconfig.json');
  allChecks &= checkFileExists(path.join(backendDir, 'prisma', 'schema.prisma'), 'Prisma schema');
  allChecks &= checkFileExists(path.join(backendDir, 'src', 'server.ts'), 'Backend server.ts');
  
  log('\n📁 Frontend...', 'cyan');
  allChecks &= checkFileExists(path.join(frontendDir, 'package.json'), 'Frontend package.json');
  allChecks &= checkFileExists(path.join(frontendDir, 'tsconfig.json'), 'Frontend tsconfig.json');
  allChecks &= checkFileExists(path.join(frontendDir, 'vite.config.ts'), 'Vite config');
  allChecks &= checkFileExists(path.join(frontendDir, 'src', 'main.tsx'), 'Frontend main.tsx');

  // Vérification des node_modules
  log('\n📦 Vérification des dépendances...', 'cyan');
  const backendInstalled = checkNodeModules(backendDir, 'Backend');
  const frontendInstalled = checkNodeModules(frontendDir, 'Frontend');

  // Tests de compilation (seulement si node_modules existe)
  if (backendInstalled) {
    log('\n🔨 Tests Backend...', 'cyan');
    runCommand('npx tsc --noEmit', backendDir, 'Compilation TypeScript Backend');
    runCommand('npx prisma validate', backendDir, 'Validation Prisma Schema');
  } else {
    log('\n⚠️  Backend non installé - Tests ignorés', 'yellow');
  }

  if (frontendInstalled) {
    log('\n🔨 Tests Frontend...', 'cyan');
    runCommand('npx tsc --noEmit', frontendDir, 'Compilation TypeScript Frontend');
  } else {
    log('\n⚠️  Frontend non installé - Tests ignorés', 'yellow');
  }

  // Vérification Docker
  log('\n🐳 Vérification Docker...', 'cyan');
  try {
    execSync('docker --version', { stdio: 'pipe' });
    log('✅ Docker installé', 'green');
  } catch {
    log('❌ Docker non installé ou non accessible', 'red');
    log('   Télécharger: https://www.docker.com/products/docker-desktop/', 'yellow');
  }

  // Résumé
  log('\n╔═══════════════════════════════════════════════════════════╗', 'blue');
  log('║                      📊 RÉSUMÉ                            ║', 'blue');
  log('╚═══════════════════════════════════════════════════════════╝\n', 'blue');

  if (!backendInstalled || !frontendInstalled) {
    log('⚠️  INSTALLATION INCOMPLÈTE', 'yellow');
    log('\n📝 Prochaines étapes:', 'cyan');
    
    if (!backendInstalled) {
      log('   1. cd backend && npm install', 'yellow');
      log('   2. npx prisma generate', 'yellow');
    }
    
    if (!frontendInstalled) {
      log('   3. cd frontend && npm install', 'yellow');
    }
    
    log('\n   4. Suivre le guide: INSTALLATION.md', 'yellow');
  } else {
    log('✅ INSTALLATION COMPLÈTE!', 'green');
    log('\n🚀 Vous pouvez maintenant:', 'cyan');
    log('   1. docker-compose up -d postgres', 'green');
    log('   2. cd backend && npx prisma migrate dev', 'green');
    log('   3. cd backend && npx prisma db seed', 'green');
    log('   4. npm run dev (depuis la racine)', 'green');
  }

  log('\n📚 Documentation:', 'cyan');
  log('   - README.md - Vue d\'ensemble', 'blue');
  log('   - INSTALLATION.md - Guide d\'installation détaillé', 'blue');
  log('   - ARCHITECTURE.md - Architecture technique', 'blue');
  log('   - CORRECTIONS.md - Corrections appliquées', 'blue');

  log('\n');
}

main().catch(console.error);
