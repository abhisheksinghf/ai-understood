export const messages = [
  { id: 'A', text: 'Claim a cash prize', spam: true, score: .96 },
  { id: 'B', text: 'Pay a release fee', spam: true, score: .88 },
  { id: 'C', text: 'Subscribed newsletter', spam: false, score: .73 },
  { id: 'D', text: 'Unknown reward link', spam: true, score: .67 },
  { id: 'E', text: 'Registered workshop', spam: false, score: .54 },
  { id: 'F', text: 'Private opportunity', spam: true, score: .45 },
  { id: 'G', text: 'Meeting agenda', spam: false, score: .21 },
  { id: 'H', text: 'Requested report', spam: false, score: .08 },
];
export function evaluateThreshold(threshold) {
  const counts = { tp: 0, fp: 0, tn: 0, fn: 0 };
  const rows = messages.map(message => {
    const flagged = message.score >= threshold;
    const outcome = flagged ? (message.spam ? 'tp' : 'fp') : (message.spam ? 'fn' : 'tn');
    counts[outcome]++;
    return { ...message, flagged, outcome };
  });
  return { ...counts, rows, accuracy: (counts.tp + counts.tn) / messages.length };
}
