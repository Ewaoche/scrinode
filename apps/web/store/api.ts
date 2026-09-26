import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Remote server state — AGENTS.md §26.
 *
 * RTK Query owns server state and caching; Redux slices own interaction
 * state. Bible corpora live here, never in a slice.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  }),
  // Domain-oriented tags, matching the API's endpoint shape (§40).
  tagTypes: ['Scripture', 'Study', 'Conversation', 'Workspace', 'Library'],
  endpoints: (builder) => ({
    health: builder.query<{ status: string; uptimeSeconds: number }, void>({
      query: () => '/health',
    }),
  }),
});

export const { useHealthQuery } = api;
