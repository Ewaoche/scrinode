import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { adminApi } from './admin-api';
import { sessionSlice } from './session.slice';

/**
 * Backoffice store.
 *
 * Entirely separate from the reader store in @scrinode/web. The two
 * applications share no state, no session and no cookie (AGENTS.md §27.3).
 */
export const makeAdminStore = () => {
  const store = configureStore({
    reducer: {
      [adminApi.reducerPath]: adminApi.reducer,
      session: sessionSlice.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(adminApi.middleware),
  });

  setupListeners(store.dispatch);

  return store;
};

export type AdminStore = ReturnType<typeof makeAdminStore>;
export type AdminRootState = ReturnType<AdminStore['getState']>;
export type AdminDispatch = AdminStore['dispatch'];

export { adminApi, sessionSlice };
