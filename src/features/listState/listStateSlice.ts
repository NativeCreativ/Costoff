import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Per-view list filter / pagination state.
 *
 * These values used to be plain useState inside the single-page app. Now that every
 * list is its own route, navigating between routes unmounts the page component, so
 * in-memory state would silently reset the user's search, filters and page. Holding
 * it in the Redux store (a module-level singleton that outlives route changes)
 * preserves the previous behaviour.
 *
 * Filters live here rather than in the query string because the app had no existing
 * query-param convention for lists; the route carries the page, the store carries
 * the filters.
 */

export interface ListViewState {
  search: string;
  filters: Record<string, string>;
  page: number;
  pageSize: number;
}

export const LISTS = {
  demands: 'demands',
  candidates: 'candidates',
  interviews: 'interviews',
  offers: 'offers',
  users: 'users',
  companies: 'companies',
} as const;

export type ListId = (typeof LISTS)[keyof typeof LISTS];

const DEFAULT_PAGE_SIZE = 10;

function initial(): ListViewState {
  return { search: '', filters: {}, page: 1, pageSize: DEFAULT_PAGE_SIZE };
}

type State = Record<string, ListViewState>;

const initialState: State = {
  [LISTS.demands]: initial(),
  [LISTS.candidates]: initial(),
  [LISTS.interviews]: initial(),
  [LISTS.offers]: initial(),
  [LISTS.users]: initial(),
  [LISTS.companies]: initial(),
};

const listStateSlice = createSlice({
  name: 'listState',
  initialState,
  reducers: {
    /** Update a single filter (and reset to page 1, matching prior behaviour). */
    setFilter(
      state,
      action: PayloadAction<{ list: ListId; key: string; value: string }>
    ) {
      const entry = state[action.payload.list];
      if (!entry) return;
      entry.filters[action.payload.key] = action.payload.value;
      entry.page = 1;
    },
    setSearch(state, action: PayloadAction<{ list: ListId; value: string }>) {
      const entry = state[action.payload.list];
      if (!entry) return;
      entry.search = action.payload.value;
      entry.page = 1;
    },
    setPage(state, action: PayloadAction<{ list: ListId; page: number }>) {
      const entry = state[action.payload.list];
      if (!entry) return;
      entry.page = action.payload.page;
    },
    setPageSize(state, action: PayloadAction<{ list: ListId; pageSize: number }>) {
      const entry = state[action.payload.list];
      if (!entry) return;
      entry.pageSize = action.payload.pageSize;
      entry.page = 1;
    },
  },
});

export const { setFilter, setSearch, setPage, setPageSize } = listStateSlice.actions;
export default listStateSlice.reducer;