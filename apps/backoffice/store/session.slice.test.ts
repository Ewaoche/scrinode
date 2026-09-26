import { describe, expect, it } from 'vitest';
import {
  clearAdminSession,
  hasPermission,
  sessionSlice,
  setAdminSession,
} from './session.slice';

const reducer = sessionSlice.reducer;
const initial = () => reducer(undefined, { type: '@@INIT' });

describe('sessionSlice', () => {
  it('starts with no permissions', () => {
    // Defaults must be closed. An empty permission set grants nothing.
    const state = initial();
    expect(state.permissions).toEqual([]);
    expect(state.adminId).toBeUndefined();
  });

  it('stores a signed-in admin', () => {
    const state = reducer(
      initial(),
      setAdminSession({
        adminId: 'admin-1',
        email: 'staff@scrinode.com',
        permissions: ['sources:read', 'audit:read'],
      }),
    );

    expect(state.adminId).toBe('admin-1');
    expect(state.permissions).toEqual(['sources:read', 'audit:read']);
  });

  it('clears every trace on sign-out', () => {
    let state = reducer(
      initial(),
      setAdminSession({ adminId: 'a', email: 'e', permissions: ['admin:manage'] }),
    );
    state = reducer(state, clearAdminSession());

    expect(state.adminId).toBeUndefined();
    expect(state.email).toBeUndefined();
    expect(state.permissions).toEqual([]);
  });

  it('replaces permissions rather than merging them', () => {
    // A re-issued session with fewer permissions must not retain the old set.
    let state = reducer(
      initial(),
      setAdminSession({ adminId: 'a', email: 'e', permissions: ['admin:manage'] }),
    );
    state = reducer(
      state,
      setAdminSession({ adminId: 'a', email: 'e', permissions: ['sources:read'] }),
    );

    expect(state.permissions).toEqual(['sources:read']);
  });
});

describe('hasPermission', () => {
  const withPermissions = (permissions: Parameters<typeof setAdminSession>[0]['permissions']) => ({
    session: reducer(
      initial(),
      setAdminSession({ adminId: 'a', email: 'e', permissions }),
    ),
  });

  it('is true for a held permission', () => {
    expect(hasPermission(withPermissions(['sources:read']), 'sources:read')).toBe(true);
  });

  it('is false for one not held', () => {
    expect(hasPermission(withPermissions(['sources:read']), 'sources:write')).toBe(false);
  });

  it('is false with no session', () => {
    expect(hasPermission({ session: initial() }, 'sources:read')).toBe(false);
  });

  it('does not treat a read permission as implying write', () => {
    const state = withPermissions(['sources:read']);
    expect(hasPermission(state, 'sources:write')).toBe(false);
    expect(hasPermission(state, 'admin:manage')).toBe(false);
  });
});
