#!/usr/bin/env node
/**
 * Auditoria Lighthouse reprodutível.
 * Uso: npm run build:demo && npm run lighthouse
 * (sobe `vite preview` automaticamente se nada responder em LH_BASE_URL)
 * Saída: lighthouse/reports/*.html|json + lighthouse/summary.json + lighthouse/SUMMARY.md
 * CHROME_PATH permite apontar um Chrome/Chromium específico.
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { BASE_URL, CATEGORIES, CHROME_FLAGS, PAGES, PROFILES, RUNS, TARGETS } from '../lighthouse/config.mjs'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const outDir = path.join(root, 'lighthouse', 'reports')

async function isUp(url) {
  try {
    const r = await fetch(url)
    return r.ok
  } catch {
    return false
  }
}

async function ensureServer() {
  if (await isUp(BASE_URL)) return null
  const port = new URL(BASE_URL).port || '4173'
  const child = spawn('npx', ['vite', 'preview', '--port', port, '--strictPort'], { cwd: root, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    if (await isUp(BASE_URL)) return child
    await new Promise((r) => setTimeout(r, 500))
  }
  child.kill()
  throw new Error(`Servidor de preview não respondeu em ${BASE_URL}. Rode "npm run build:demo" antes.`)
}

const median = (values) => {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const server = await ensureServer()
  const chrome = await chromeLauncher.launch({ chromeFlags: CHROME_FLAGS, chromePath: process.env.CHROME_PATH })
  const results = []
  let chromeVersion = 'desconhecida'
  try {
    for (const page of PAGES) {
      for (const [profile, config] of Object.entries(PROFILES)) {
        const runs = []
        for (let i = 1; i <= RUNS; i++) {
          const url = `${BASE_URL}${page.path}`
          const res = await lighthouse(url, { port: chrome.port, output: ['html', 'json'], logLevel: 'error' }, config)
          if (!res) throw new Error(`Lighthouse sem resultado para ${url}`)
          const lhr = res.lhr
          chromeVersion = lhr.environment?.hostUserAgent ?? chromeVersion
          const base = `${page.id}-${profile}-run${i}`
          await writeFile(path.join(outDir, `${base}.html`), res.report[0])
          await writeFile(path.join(outDir, `${base}.json`), res.report[1])
          const run = {
            run: i,
            scores: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
            metrics: {
              LCP_ms: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
              CLS: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
              TBT_ms: Math.round(lhr.audits['total-blocking-time'].numericValue),
              FCP_ms: Math.round(lhr.audits['first-contentful-paint'].numericValue),
            },
            lcpElement: lhr.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet ?? null,
            runtimeError: lhr.runtimeError?.message ?? null,
          }
          runs.push(run)
          console.log(`${page.id} [${profile}] run ${i}:`, run.scores, run.metrics)
        }
        const medianScores = Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))]))
        const medianMetrics = Object.fromEntries(Object.keys(runs[0].metrics).map((m) => [m, median(runs.map((r) => r.metrics[m]))]))
        results.push({ page: page.id, path: page.path, profile, median: { scores: medianScores, metrics: medianMetrics }, runs })
      }
    }
  } finally {
    await chrome.kill()
    server?.kill()
  }

  const env = {
    date: new Date().toISOString(),
    lighthouse: require('lighthouse/package.json').version,
    chromeLauncher: require('chrome-launcher/package.json').version,
    browser: chromeVersion,
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpus: os.cpus().length,
    baseUrl: BASE_URL,
    runsPerProfile: RUNS,
    scenario: 'MSW cenário "default" (latência 60–180 ms), build otimizado (vite build) via vite preview',
  }
  await writeFile(path.join(root, 'lighthouse', 'summary.json'), JSON.stringify({ env, targets: TARGETS, results }, null, 2))

  const lines = [
    '# Lighthouse — resumo (mediana de 3 execuções)',
    '',
    `Gerado em ${env.date} · Lighthouse ${env.lighthouse} · Node ${env.node} · ${env.os} · ${env.cpus} CPUs`,
    '',
    `Navegador: ${env.browser}`,
    '',
    `Condições: ${env.scenario}. Mobile = emulação Moto G Power com throttling simulado (4G lento, CPU 4x). Desktop = preset desktop (40 ms RTT, 10 Mbps, CPU 1x).`,
    '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |',
    '|---|---|---|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.page} | ${r.profile} | ${r.median.scores.performance} | ${r.median.scores.accessibility} | ${r.median.scores['best-practices']} | ${r.median.scores.seo} | ${r.median.metrics.LCP_ms} | ${r.median.metrics.CLS} | ${r.median.metrics.TBT_ms} |`,
    ),
    '',
    `Metas: Performance ≥ ${TARGETS.performance}, Accessibility ≥ ${TARGETS.accessibility}, Best Practices ≥ ${TARGETS['best-practices']}, SEO ≥ ${TARGETS.seo}.`,
    '',
    'Relatórios completos (HTML/JSON por execução) em `lighthouse/reports/`.',
  ]
  await writeFile(path.join(root, 'lighthouse', 'SUMMARY.md'), lines.join('\n') + '\n')
  console.log(lines.join('\n'))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
