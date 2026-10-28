# Lighthouse — resumo (mediana de 3 execuções)

Gerado em 2026-10-28T19:54:36.805Z · Lighthouse 13.6.0 · Node v22.23.4 · Linux 6.18.44-fc-v180 (x64) · 2 CPUs

Navegador: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.0 Safari/537.36

Condições: MSW cenário "default" (latência 60–180 ms), build otimizado (vite build) via vite preview. Mobile = emulação Moto G Power com throttling simulado (4G lento, CPU 4x). Desktop = preset desktop (40 ms RTT, 10 Mbps, CPU 1x).

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |
|---|---|---|---|---|---|---|---|---|
| inicio | mobile | 70 | 100 | 100 | 100 | 4852 | 0.001 | 493 |
| inicio | desktop | 99 | 100 | 100 | 100 | 942 | 0 | 4 |
| detalhe | mobile | 70 | 100 | 100 | 100 | 4690 | 0 | 531 |
| detalhe | desktop | 99 | 100 | 100 | 100 | 1000 | 0.001 | 4 |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.

Relatórios completos (HTML/JSON por execução) em `lighthouse/reports/`.
