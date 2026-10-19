// The website moved from kalender.amazone.or.at to rebellinnen.amazone.or.at. Every old address -
// the store listings' privacy policy, printed QR codes pointing at /download - lands on the same
// path there. `replace`, so the old address does not stay in the history.
location.replace(
  'https://rebellinnen.amazone.or.at' + location.pathname + location.search + location.hash,
);
