import type { APIRoute } from 'astro';
import { allRanges } from '../data/catalogue';

// Search index for the products page: [code, name, range id, range title] for every design.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(allRanges.flatMap((r) => r.designs.map((d) => [d.code, d.name, r.id, r.title]))), {
    headers: { 'Content-Type': 'application/json' },
  });
