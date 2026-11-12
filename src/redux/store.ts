import { configureStore } from '@reduxjs/toolkit';
import listStateReducer from '@/features/listState/listStateSlice';

/**
 * Only cross-route UI state lives here now.
 *
 * The old `ui.activeTab` slice is gone: which page is open is decided by the URL,
 * not by Redux. What remains is per-list search/filter/pagination, kept in the store
 * so it survives the unmount/remount that happens when navigating between routes.
 */
export const store = configureStore({
  reducer: {
    listState: listStateReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
