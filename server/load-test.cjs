const http = require('http');
const path = require('path');
const { performance } = require('perf_hooks');

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function run() {
  process.env.AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'load_test_secret_2026';

  const { createLocalApiMiddleware } = require(path.resolve(__dirname, 'local-api.cjs'));
  const middleware = createLocalApiMiddleware();

  const server = http.createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Not found' }));
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const base = `http://127.0.0.1:${addr.port}`;

  const loginRes = await fetch(`${base}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartfarming.local', password: 'admin123' }),
  });

  if (!loginRes.ok) {
    throw new Error(`Admin login failed for load test (${loginRes.status})`);
  }
  const loginPayload = await loginRes.json();
  const accessToken = loginPayload?.accessToken;
  if (!accessToken) {
    throw new Error('No access token returned for load test');
  }

  const endpoints = [
    { method: 'GET', path: '/health', auth: false, expected: [200] },
    { method: 'GET', path: '/users', auth: true, expected: [200] },
    { method: 'GET', path: '/consultations', auth: true, expected: [200] },
    { method: 'GET', path: '/prices/live/dhaka', auth: false, expected: [200] },
  ];

  const durationMs = Number(process.env.LOAD_TEST_DURATION_MS || 10000);
  const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 25);
  const endAt = Date.now() + durationMs;

  const stats = {
    total: 0,
    failed: 0,
    throttled: 0,
    byStatus: {},
    latencies: [],
  };

  async function worker() {
    while (Date.now() < endAt) {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const headers = endpoint.auth
        ? { Authorization: `Bearer ${accessToken}` }
        : {};

      const started = performance.now();
      let status = 0;
      try {
        const res = await fetch(`${base}${endpoint.path}`, {
          method: endpoint.method,
          headers,
        });
        status = res.status;
        await res.text();
      } catch {
        status = -1;
      }
      const elapsed = performance.now() - started;

      stats.total += 1;
      stats.latencies.push(elapsed);
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      if (status === 429) {
        stats.throttled += 1;
      } else if (!endpoint.expected.includes(status)) {
        stats.failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const avg = stats.latencies.reduce((sum, v) => sum + v, 0) / Math.max(1, stats.latencies.length);
  const p50 = percentile(stats.latencies, 50);
  const p95 = percentile(stats.latencies, 95);
  const p99 = percentile(stats.latencies, 99);
  const max = stats.latencies.length ? Math.max(...stats.latencies) : 0;
  const errorRate = stats.total ? (stats.failed / stats.total) * 100 : 0;
  const throttledRate = stats.total ? (stats.throttled / stats.total) * 100 : 0;

  console.log('Load test completed');
  console.log(`Duration(ms): ${durationMs}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Total requests: ${stats.total}`);
  console.log(`Failed requests (unexpected): ${stats.failed}`);
  console.log(`Throttled requests (429): ${stats.throttled}`);
  console.log(`Unexpected error rate: ${errorRate.toFixed(2)}%`);
  console.log(`Throttle rate: ${throttledRate.toFixed(2)}%`);
  console.log(`Latency avg: ${avg.toFixed(2)}ms`);
  console.log(`Latency p50: ${p50.toFixed(2)}ms`);
  console.log(`Latency p95: ${p95.toFixed(2)}ms`);
  console.log(`Latency p99: ${p99.toFixed(2)}ms`);
  console.log(`Latency max: ${max.toFixed(2)}ms`);
  console.log(`Status counts: ${JSON.stringify(stats.byStatus)}`);

  await new Promise((resolve) => server.close(resolve));

  if (errorRate > 2) {
    throw new Error(`Load test failed: unexpected error rate too high (${errorRate.toFixed(2)}%)`);
  }
}

run().catch((error) => {
  console.error('Load test failed:', error?.message || error);
  process.exit(1);
});
