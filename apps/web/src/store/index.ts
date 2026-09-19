import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from './api';
import { preferencesSlice } from './preferences.slice';
import { scriptureSlice } from './scripture.slice';

/**
 * Store factory.
 *
 * A factory rather than a singleton so each server request and each test gets
 * an isolated store — a module-level store would leak one user's state into
 * another's request under SSR.
 */
export const makeStore = () => {
  const store = configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
      scripture: scriptureSlice.reducer,
      preferences: preferencesSlice.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
  });

  setupListeners(store.dispatch);

  return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export { api, preferencesSlice, scriptureSlice };
