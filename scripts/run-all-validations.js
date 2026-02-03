#!/usr/bin/env node
/**
 * Run All Validations
 * Master script that executes all QA validation scripts in sequence
 * and generates the final validation report.
 *
 * Part of QAValidator suite for Keystone Security Distribution demo.
 *
 * Usage: node scripts/run-all-validations.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPTS_DIR = __dirname;
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure docs directory exists
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

// ── Pre-flight: Check data files exist ────────────────────────────────────────

console.log('='.repeat(70));
console.log('  KEYSTONE SECURITY DISTRIBUTION - FULL VALIDATION SUITE');
console.log('='.repeat(70));
console.log('');

const requiredFiles = ['products.csv', 'customers.csv', 'orders.csv', 'order_lines.csv'];
const missingFiles = requiredFiles.filter(f => !fs.existsSync(path.join(DATA_DIR, f)));

if (missingFiles.length > 0) {
  console.error('ABORT: Missing required data files:');
  missingFiles.forEach(f => console.error(`  - /data/${f}`));
  console.error('\nPlease ensure all data files are generated before running validation.');
  process.exit(1);
}

console.log('Pre-flight checks:');
requiredFiles.forEach(f => {
  const filePath = path.join(DATA_DIR, f);
  const stats = fs.statSync(filePath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`  [OK] /data/${f} (${sizeMB} MB)`);
});

// Check for summary.json
const summaryPath = path.join(DATA_DIR, 'summary.json');
if (fs.existsSync(summaryPath)) {
  console.log('  [OK] /data/summary.json');
} else {
  console.log('  [--] /data/summary.json (optional, not found)');
}

console.log('');

// ── Run each validation script ────────────────────────────────────────────────

const scripts = [
  { name: 'Data Integrity',   file: 'validate-integrity.js',      resultFile: 'integrity-results.json' },
  { name: 'Margin Validation', file: 'validate-margins.js',        resultFile: 'margin-results.json' },
  { name: 'Seasonality',       file: 'validate-seasonality.js',    resultFile: 'seasonality-results.json' },
  { name: 'Distributions',     file: 'validate-distributions.js',  resultFile: 'distribution-results.json' },
];

const allResults = {};
let totalPassed = 0;
let totalWarnings = 0;
let totalFailed = 0;
let anyScriptFailed = false;

scripts.forEach((script, idx) => {
  console.log('');
  console.log('-'.repeat(70));
  console.log(`  [${idx + 1}/${scripts.length}] Running: ${script.name}`);
  console.log('-'.repeat(70));
  console.log('');

  const scriptPath = path.join(SCRIPTS_DIR, script.file);

  if (!fs.existsSync(scriptPath)) {
    console.error(`  SKIP: Script not found: ${scriptPath}`);
    allResults[script.name] = { status: 'SKIPPED', error: 'Script not found' };
    return;
  }

  try {
    const output = execSync(`node "${scriptPath}"`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      timeout: 120000,  // 2 minute timeout per script
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(output);

    // Load results JSON if it exists
    const resultPath = path.join(DOCS_DIR, script.resultFile);
    if (fs.existsSync(resultPath)) {
      const resultData = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
      allResults[script.name] = {
        status: 'PASS',
        passed: resultData.passed ? resultData.passed.length : 0,
        warnings: resultData.warnings ? resultData.warnings.length : 0,
        failed: resultData.failed ? resultData.failed.length : 0,
        data: resultData
      };
      totalPassed += allResults[script.name].passed;
      totalWarnings += allResults[script.name].warnings;
      totalFailed += allResults[script.name].failed;
    } else {
      allResults[script.name] = { status: 'PASS', note: 'No JSON results file generated' };
    }
  } catch (err) {
    // Script exited with non-zero (has failures)
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);

    anyScriptFailed = true;

    // Still try to load results
    const resultPath = path.join(DOCS_DIR, script.resultFile);
    if (fs.existsSync(resultPath)) {
      const resultData = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
      allResults[script.name] = {
        status: 'FAIL',
        passed: resultData.passed ? resultData.passed.length : 0,
        warnings: resultData.warnings ? resultData.warnings.length : 0,
        failed: resultData.failed ? resultData.failed.length : 0,
        data: resultData
      };
      totalPassed += allResults[script.name].passed;
      totalWarnings += allResults[script.name].warnings;
      totalFailed += allResults[script.name].failed;
    } else {
      allResults[script.name] = {
        status: 'FAIL',
        error: err.message || 'Script exited with errors'
      };
    }
  }
});

// ── Generate Summary Report ───────────────────────────────────────────────────

console.log('\n');
console.log('='.repeat(70));
console.log('  VALIDATION SUITE COMPLETE');
console.log('='.repeat(70));
console.log('');

const overallStatus = totalFailed > 0 ? 'FAIL' : (totalWarnings > 0 ? 'WARNINGS' : 'PASS');

console.log(`  Overall Status: ${overallStatus}`);
console.log(`  Total Passed:   ${totalPassed}`);
console.log(`  Total Warnings: ${totalWarnings}`);
console.log(`  Total Failed:   ${totalFailed}`);
console.log('');

console.log('  Script Results:');
Object.entries(allResults).forEach(([name, result]) => {
  const statusIcon = result.status === 'PASS' ? '[PASS]' : result.status === 'FAIL' ? '[FAIL]' : '[SKIP]';
  const detail = result.passed !== undefined
    ? `P:${result.passed} W:${result.warnings} F:${result.failed}`
    : result.error || result.note || '';
  console.log(`    ${statusIcon} ${name}: ${detail}`);
});

// ── Generate Markdown Report ──────────────────────────────────────────────────

const now = new Date().toISOString().replace('T', ' ').split('.')[0];

let report = `# Keystone Security Demo - Validation Report

**Generated:** ${now}
**Validator:** QAValidator Agent
**Status:** ${overallStatus}

---

## Executive Summary

| Check Category | Passed | Warnings | Failed |
|----------------|--------|----------|--------|
`;

Object.entries(allResults).forEach(([name, result]) => {
  report += `| ${name} | ${result.passed || 0} | ${result.warnings || 0} | ${result.failed || 0} |\n`;
});

report += `| **Total** | **${totalPassed}** | **${totalWarnings}** | **${totalFailed}** |\n`;

// ── Data Integrity Section ────────────────────────────────────────────────────

report += `
---

## Data Integrity Results

`;

const integrityData = allResults['Data Integrity']?.data;
if (integrityData) {
  report += `### Volume Targets\n\n`;
  report += `| Dataset | Count | Target |\n`;
  report += `|---------|-------|--------|\n`;
  if (integrityData.stats) {
    report += `| Products | ${integrityData.stats.products} | 200+ |\n`;
    report += `| Customers | ${integrityData.stats.customers} | 150 |\n`;
    report += `| Orders | ${integrityData.stats.orders} | ~7,904 |\n`;
    report += `| Order Lines | ${integrityData.stats.orderLines} | ~35,568 |\n`;
  }

  report += `\n### Check Results\n\n`;
  if (integrityData.passed) {
    integrityData.passed.forEach(p => {
      const text = typeof p === 'string' ? p : (p.check || JSON.stringify(p));
      report += `- [x] ${text}\n`;
    });
  }
  if (integrityData.warnings) {
    integrityData.warnings.forEach(w => {
      const text = typeof w === 'string' ? w : (w.check || JSON.stringify(w));
      report += `- [ ] WARNING: ${text}\n`;
    });
  }
  if (integrityData.failed) {
    integrityData.failed.forEach(f => {
      const text = typeof f === 'string' ? f : (f.check || JSON.stringify(f));
      report += `- [ ] FAILED: ${text}\n`;
    });
  }
}

// ── Margin Validation Section ─────────────────────────────────────────────────

report += `
---

## Margin Validation Results

`;

const marginData = allResults['Margin Validation']?.data;
if (marginData && marginData.summary) {
  report += `| Category | Count | Avg Margin | Target | Out of Bounds | Status |\n`;
  report += `|----------|-------|------------|--------|---------------|--------|\n`;
  Object.entries(marginData.summary).forEach(([cat, data]) => {
    if (cat === '_overall') return;
    const status = data.outOfBounds === 0 ? 'PASS' : 'WARN';
    report += `| ${cat} | ${data.count} | ${data.avgMargin} | ${data.target} | ${data.outOfBounds} | ${status} |\n`;
  });

  if (marginData.summary._overall) {
    const ov = marginData.summary._overall;
    report += `\n**Overall Margin Distribution:** Mean ${ov.mean}, Median ${ov.median}, P5-P95: ${ov.p5}-${ov.p95}\n`;
  }
}

// ── Seasonality Section ───────────────────────────────────────────────────────

report += `
---

## Seasonality Results

`;

const seasonData = allResults['Seasonality']?.data;
if (seasonData) {
  report += `### Monthly Pattern\n\n`;
  report += `| Month | Avg Orders | Expected | Actual | Delta | Status |\n`;
  report += `|-------|-----------|----------|--------|-------|--------|\n`;
  if (seasonData.monthlyData) {
    seasonData.monthlyData.forEach(m => {
      const status = m.inRange ? 'PASS' : 'WARN';
      const deltaStr = (m.delta >= 0 ? '+' : '') + m.delta.toFixed(3);
      report += `| ${m.monthName} | ${m.avgOrders} | ${m.expected.toFixed(2)} | ${m.actual.toFixed(2)} | ${deltaStr} | ${status} |\n`;
    });
  }

  if (seasonData.yoyData) {
    const yoy = seasonData.yoyData;
    report += `\n### Year-over-Year Growth\n\n`;
    report += `- 2023 Orders: ${yoy.year1Orders?.toLocaleString()}\n`;
    report += `- 2024 Orders: ${yoy.year2Orders?.toLocaleString()}\n`;
    report += `- Order Growth: ${yoy.orderGrowth}% (target: 8%)\n`;
    report += `- 2023 Revenue: $${yoy.year1Revenue?.toLocaleString()}\n`;
    report += `- 2024 Revenue: $${yoy.year2Revenue?.toLocaleString()}\n`;
    report += `- Revenue Growth: ${yoy.revenueGrowth}%\n`;
  }

  if (seasonData.dowData) {
    report += `\n### Day-of-Week Pattern\n\n`;
    report += `| Day | Orders | Expected | Actual | Status |\n`;
    report += `|-----|--------|----------|--------|--------|\n`;
    seasonData.dowData.forEach(d => {
      const status = d.inRange ? 'PASS' : 'WARN';
      report += `| ${d.day} | ${d.orders} | ${d.expected.toFixed(2)} | ${d.actual.toFixed(2)} | ${status} |\n`;
    });
  }
}

// ── Distribution Section ──────────────────────────────────────────────────────

report += `
---

## Distribution Results

`;

const distData = allResults['Distributions']?.data;
if (distData) {
  if (distData.customerTypes) {
    report += `### Customer Types\n\n`;
    report += `| Type | Name | Count | Expected | Actual | Delta | Status |\n`;
    report += `|------|------|-------|----------|--------|-------|--------|\n`;
    Object.entries(distData.customerTypes).forEach(([type, data]) => {
      const status = data.inRange ? 'PASS' : 'WARN';
      const deltaStr = (data.delta >= 0 ? '+' : '') + (data.delta * 100).toFixed(1) + '%';
      report += `| ${type} | ${data.name} | ${data.count} | ${(data.expected * 100).toFixed(0)}% | ${(data.actual * 100).toFixed(1)}% | ${deltaStr} | ${status} |\n`;
    });
  }

  if (distData.geoDistribution) {
    report += `\n### Geographic Distribution\n\n`;
    report += `| State | Count | Expected | Actual | Delta | Status |\n`;
    report += `|-------|-------|----------|--------|-------|--------|\n`;
    Object.entries(distData.geoDistribution).forEach(([state, data]) => {
      const status = data.inRange ? 'PASS' : 'WARN';
      const deltaStr = (data.delta >= 0 ? '+' : '') + (data.delta * 100).toFixed(1) + '%';
      report += `| ${state} | ${data.count} | ${(data.expected * 100).toFixed(0)}% | ${(data.actual * 100).toFixed(1)}% | ${deltaStr} | ${status} |\n`;
    });
  }
}

// ── Issues Section ────────────────────────────────────────────────────────────

report += `
---

## Issues Found

`;

// Collect all failures and warnings
const criticalIssues = [];
const majorIssues = [];
const minorIssues = [];

Object.entries(allResults).forEach(([scriptName, result]) => {
  if (!result.data) return;

  if (result.data.failed) {
    result.data.failed.forEach(f => {
      const text = typeof f === 'string' ? f : (f.check || f.message || JSON.stringify(f));
      criticalIssues.push({ script: scriptName, issue: text, detail: f });
    });
  }

  if (result.data.warnings) {
    result.data.warnings.forEach(w => {
      const text = typeof w === 'string' ? w : (w.check || w.message || JSON.stringify(w));
      if (typeof w === 'object' && w.count && w.count > 10) {
        majorIssues.push({ script: scriptName, issue: text, detail: w });
      } else {
        minorIssues.push({ script: scriptName, issue: text, detail: w });
      }
    });
  }
});

report += `### Critical (Blocking)\n\n`;
if (criticalIssues.length === 0) {
  report += `None found.\n`;
} else {
  criticalIssues.forEach(issue => {
    report += `- **[${issue.script}]** ${issue.issue}\n`;
  });
}

report += `\n### Major (Should Fix)\n\n`;
if (majorIssues.length === 0) {
  report += `None found.\n`;
} else {
  majorIssues.forEach(issue => {
    report += `- **[${issue.script}]** ${issue.issue}\n`;
  });
}

report += `\n### Minor (Nice to Fix)\n\n`;
if (minorIssues.length === 0) {
  report += `None found.\n`;
} else {
  minorIssues.forEach(issue => {
    report += `- **[${issue.script}]** ${issue.issue}\n`;
  });
}

// ── Recommendations ───────────────────────────────────────────────────────────

report += `
---

## Recommendations

`;

if (totalFailed === 0 && totalWarnings === 0) {
  report += `1. All validation checks passed with no issues. Data is ready for demo use.\n`;
  report += `2. No action items required.\n`;
} else if (totalFailed === 0) {
  report += `1. All critical checks passed. ${totalWarnings} warnings are within acceptable tolerance.\n`;
  report += `2. Review warnings above for potential improvements to data realism.\n`;
  report += `3. Data is suitable for demo use as-is.\n`;
} else {
  report += `1. **${totalFailed} critical failures found.** These must be resolved before demo use.\n`;
  report += `2. Review each failure in the detailed results above.\n`;
  report += `3. After fixes, re-run validation suite: \`node scripts/run-all-validations.js\`\n`;
}

report += `
---

*Report generated by QAValidator Agent v1.0*
*Validation suite: validate-integrity.js, validate-margins.js, validate-seasonality.js, validate-distributions.js*
`;

// ── Write Report ──────────────────────────────────────────────────────────────

const reportPath = path.join(DOCS_DIR, 'validation_report.md');
fs.writeFileSync(reportPath, report);
console.log(`\nValidation report written to: ${reportPath}`);

// Write consolidated JSON
const consolidatedPath = path.join(DOCS_DIR, 'validation-all-results.json');
fs.writeFileSync(consolidatedPath, JSON.stringify({
  generated: now,
  status: overallStatus,
  totals: { passed: totalPassed, warnings: totalWarnings, failed: totalFailed },
  scripts: allResults
}, null, 2));
console.log(`Consolidated results written to: ${consolidatedPath}`);

// Exit code
process.exit(totalFailed > 0 ? 1 : 0);
