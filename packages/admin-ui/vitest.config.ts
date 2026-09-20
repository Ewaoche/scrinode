import { jsdomConfig } from '@scrinode/config/vitest/jsdom';

/** Worker counts are capped in the shared preset; see its comment for why. */
export default jsdomConfig();
