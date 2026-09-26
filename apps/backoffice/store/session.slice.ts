import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Permission } from '@scrinode/types';

/**
 * Signed-in admin, client side.
 *
 * Holds permissions for navigation and affordance decisions only. This is a
 * usability convenience, never an authorization boundary: the API enforces
 * every permission server-side (AGENTS.md §51.3). Client state can be edited
 * by anyone with a debugger.
 *
 * Populated in Stage 2, when admin identity is built.
 */
export interface AdminSessionState {
  adminId?: string;
  email?: string;
  permissions: Permission[];
}

const initialState: AdminSessionState = {
  // No permissions until authenticated. Defaults must be closed, never open.
  permissions: [],
};

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setAdminSession(
      state,
      action: PayloadAction<{ adminId: string; email: string; permissions: Permission[] }>,
    ) {
      state.adminId = action.payload.adminId;
      state.email = action.payload.email;
      state.permissions = action.payload.permissions;
    },

    clearAdminSession(state) {
      delete state.adminId;
      delete state.email;
      state.permissions = [];
    },
  },
});

export const { setAdminSession, clearAdminSession } = sessionSlice.actions;

/** True when the signed-in admin holds a permission. Exact match only. */
export function hasPermission(
  state: { session: AdminSessionState },
  permission: Permission,
): boolean {
  return state.session.permissions.includes(permission);
}
