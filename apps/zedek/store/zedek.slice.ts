import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { BibleReference, TranslationCode } from '@scrinode/types';

/**
 * Zedek's interaction state (AGENTS.md §26).
 *
 * Interaction state only — which Study is open, which Conversation, what the
 * reader has typed. Studies, Conversations and messages themselves are server
 * state and belong to RTK Query, and §26 is explicit that large Bible corpora
 * never enter Redux.
 */
export interface ZedekState {
  /** The Study being worked in. Null on the index. */
  readonly activeStudyId: string | null;

  /** The Conversation open within it. */
  readonly activeConversationId: string | null;

  /** The composer's contents, kept so navigating away does not lose a draft. */
  readonly draft: string;

  /**
   * Scripture context carried in from the reader.
   *
   * §11's context cannot cross an origin (§3.3), so a reader arriving from
   * scrinode.com passes a reference in the URL and this is where it lands.
   * Absent is normal: Zedek is also entered directly.
   */
  readonly incomingContext: {
    readonly reference: BibleReference;
    readonly translation: TranslationCode;
  } | null;
}

const initialState: ZedekState = {
  activeStudyId: null,
  activeConversationId: null,
  draft: '',
  incomingContext: null,
};

export const zedekSlice = createSlice({
  name: 'zedek',
  initialState,
  reducers: {
    studyOpened(state, action: PayloadAction<string>) {
      state.activeStudyId = action.payload;
      // Opening a different Study cannot leave the previous Study's
      // conversation selected — it would show a thread that does not belong
      // to what is on screen.
      state.activeConversationId = null;
      state.draft = '';
    },

    conversationOpened(state, action: PayloadAction<string>) {
      state.activeConversationId = action.payload;
      state.draft = '';
    },

    draftChanged(state, action: PayloadAction<string>) {
      state.draft = action.payload;
    },

    /** Called once on arrival from the reader, with the URL's reference. */
    contextReceived(state, action: PayloadAction<ZedekState['incomingContext']>) {
      state.incomingContext = action.payload;
    },

    conversationClosed(state) {
      state.activeConversationId = null;
      state.draft = '';
    },
  },
});

export const { studyOpened, conversationOpened, draftChanged, contextReceived, conversationClosed } =
  zedekSlice.actions;
