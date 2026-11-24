import type { APIRoute } from 'astro';
import { app } from '../../server';

export const prerender = false;

export const ALL: APIRoute = async (context) => {
  return app.fetch(context.request);
};
