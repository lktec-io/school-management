/**
 * Global activity counter behind the top progress bar. API requests and lazy route loads call
 * start()/done(); the bar is visible while the counter is above zero.
 */
let active = 0;
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener(active);
}

export const progress = {
  start() {
    active += 1;
    if (active === 1) emit();
  },
  done() {
    if (active === 0) return;
    active -= 1;
    if (active === 0) emit();
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get active() {
    return active;
  },
};
