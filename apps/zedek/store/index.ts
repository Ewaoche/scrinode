import { configureStore } from '@reduxjs/toolkit';
import { zedekSlice } from './zedek.slice';

/**
 * Store factory.
 *
 * A factory rather than a singleton so each server request and each test gets
 * an isolated store — a module-level store would leak one reader's research
 * into another's request under SSR.
 */
export const makeStore = () => {
  const store = configureStore({
    reducer: {
      zedek: zedekSlice.reducer,
    },
  });

  return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export { zedekSlice };
