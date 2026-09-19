import { describe, expect, it } from 'vitest';
import { makeAdminStore } from './index';
import { setAdminSession } from './session.slice';

describe('makeAdminStore', () => {
  it('registers the session slice and admin API', () => {
    const state = makeAdminStore().getState();

    expect(state.session).toBeDefined();
    expect(state.adminApi).toBeDefined();
  });

  it('holds no reader state', () => {
    // The backoffice shares nothing with the public reader (AGENTS.md §27.3).
    const state = makeAdminStore().getState() as Record<string, unknown>;

    expect(state.scripture).toBeUndefined();
    expect(state.preferences).toBeUndefined();
    expect(state.api).toBeUndefined();
  });

  it('gives each call an isolated store', () => {
    const first = makeAdminStore();
    const second = makeAdminStore();

    first.dispatch(
      setAdminSession({ adminId: 'a', email: 'e', permissions: ['admin:manage'] }),
    );

    expect(first.getState().session.permissions).toEqual(['admin:manage']);
    expect(second.getState().session.permissions).toEqual([]);
  });
});
