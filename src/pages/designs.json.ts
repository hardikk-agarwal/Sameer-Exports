import type { APIRoute } from 'astro';
import { allRanges, thumb } from '../data/catalogue';

// Search index for the products page: [code, name, range id, range title, photo version] for every design.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(allRanges.flatMap((r) => r.designs.map((d) => [d.code, d.name, r.id, r.title, thumb(d.code).v]))), {
    headers: { 'Content-Type': 'application/json' },
  });
