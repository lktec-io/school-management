import { useEffect, useState } from 'react';
import { progress } from '../../utils/progress.js';

const SHOW_DELAY = 120; // fast responses never flash the bar
const TRICKLE_MS = 300;

/**
 * Thin bar pinned to the top of the viewport (YouTube style). It creeps towards 90 % while work
 * is pending, then completes and fades out.
 */
export default function TopProgressBar() {
  const [value, setValue] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timers = {};
    const clear = () => {
      clearTimeout(timers.show);
      clearTimeout(timers.hide);
      clearInterval(timers.trickle);
    };
    const handle = (count) => {
      clear();
      if (count > 0) {
        timers.show = setTimeout(() => {
          setVisible(true);
          setValue((current) => (current > 0 && current < 90 ? current : 12));
          timers.trickle = setInterval(() => {
            setValue((current) => (current >= 90 ? current : current + (90 - current) * 0.12));
          }, TRICKLE_MS);
        }, SHOW_DELAY);
      } else {
        setValue((current) => (current > 0 ? 100 : 0));
        timers.hide = setTimeout(() => {
          setVisible(false);
          setValue(0);
        }, 280);
      }
    };
    const unsubscribe = progress.subscribe(handle);
    if (progress.active > 0) handle(progress.active);
    return () => {
      unsubscribe();
      clear();
    };
  }, []);

  return (
    <div className={`top-progress${visible ? ' is-visible' : ''}`} aria-hidden="true">
      <div className="top-progress__bar" style={{ transform: `scaleX(${value / 100})` }} />
    </div>
  );
}

/** Suspense fallback: drives the bar while a lazy route chunk downloads. */
export function RouteProgress() {
  useEffect(() => {
    progress.start();
    return () => progress.done();
  }, []);
  return null;
}
