import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Admin server state.
 *
 * Every request targets `/admin/*`, which the API serves behind a global
 * module guard (AGENTS.md §51.3). A reader session token must never
 * authorize these routes, and an admin token must never reach reader routes
 * (§27.3).
 *
 * `credentials: 'include'` sends the admin session cookie, which is scoped to
 * the backoffice domain and is a different cookie from the reader's.
 */
export const adminApi = createApi({
  reducerPath: 'adminApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/admin`,
    credentials: 'include',
  }),
  tagTypes: ['Source', 'Ingestion', 'AdminUser', 'Audit', 'Flag'],
  endpoints: () => ({}),
});
