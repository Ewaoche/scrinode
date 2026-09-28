import { StudyList } from '../components/study-list';

/**
 * Zedek's home: the reader's Studies.
 *
 * Studies first rather than a chat box, because §3.3 makes the Study the unit
 * of work — a conversation with nowhere to belong has nowhere to keep what it
 * learned. Starting at the project level is what distinguishes this from a
 * general assistant (§1).
 */
export default function ZedekHome() {
  return <StudyList />;
}
