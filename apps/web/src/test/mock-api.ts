/**
 * A route-table fetch mock.
 *
 * Tests describe what each endpoint should answer; everything not listed
 * resolves to an empty successful list so a page can render without the test
 * having to enumerate every call it happens to make.
 */
import { vi } from 'vitest';

export interface MockRoute {
  status?: number;
  /** Raw payloads (auth endpoints) bypass the `{ success, data }` envelope. */
  body?: unknown;
  /** Return the body at request time — lets a test change state between calls. */
  bodyFn?: () => unknown;
  delayMs?: number;
}

type Routes = Record<string, MockRoute>;

let routes: Routes = {};

export function setScenario(next: Routes): void {
  routes = next;
}

export function resetScenario(): void {
  routes = {};
}

export function installFetchMock(): void {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.pathname
          : (input as Request).url;
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    const method = (init?.method ?? 'GET').toUpperCase();
    const route = routes[`${method} ${path}`];

    if (route?.delayMs) await new Promise((resolve) => setTimeout(resolve, route.delayMs));

    const payload = route?.bodyFn ? route.bodyFn() : route?.body;
    return new Response(JSON.stringify(payload ?? { success: true, data: [] }), {
      status: route?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', mock);
}
