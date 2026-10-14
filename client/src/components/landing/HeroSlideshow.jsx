import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const ROTATE_MS = 6500;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Full-width hero carousel: auto-rotates (paused on hover/focus or when the user prefers
 * reduced motion), with arrows, dot indicators, keyboard ← → support and a pause control.
 * A slide whose image fails to load falls back to the navy gradient.
 */
export default function HeroSlideshow({ slides, lang, labels }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [hovered, setHovered] = useState(false);
  const [failed, setFailed] = useState(() => new Set());
  const count = slides.length;

  const go = useCallback((next) => setIndex((next + count) % count), [count]);

  useEffect(() => {
    if (paused || hovered || count < 2) return undefined;
    const timer = setTimeout(() => setIndex((current) => (current + 1) % count), ROTATE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, hovered, count]);

  const onKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + 1);
    }
  };

  return (
    <section
      className="hero-slideshow"
      role="region"
      aria-roledescription="carousel"
      aria-label={labels.region}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onKeyDown={onKeyDown}
    >
      <div className="hero-slideshow__track" aria-live={paused ? 'polite' : 'off'}>
        {slides.map((slide, slideIndex) => {
          const active = slideIndex === index;
          return (
            <article
              key={slide.id}
              className={`hero-slide${active ? ' is-active' : ''}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${slideIndex + 1} / ${count}`}
              aria-hidden={!active}
            >
              {!failed.has(slide.id) && (
                <img
                  className="hero-slide__image"
                  src={slide.image}
                  alt=""
                  loading={slideIndex === 0 ? 'eager' : 'lazy'}
                  fetchPriority={slideIndex === 0 ? 'high' : 'auto'}
                  onError={() => setFailed((current) => new Set(current).add(slide.id))}
                />
              )}
              <div className="hero-slide__overlay" />
              <div className="hero-slide__content">
                <span className="hero-slide__tag">{slide.tag[lang]}</span>
                <h2 className="hero-slide__title">{slide.title[lang]}</h2>
                <p className="hero-slide__text">{slide.text[lang]}</p>
              </div>
            </article>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button type="button" className="hero-slideshow__arrow hero-slideshow__arrow--prev" onClick={() => go(index - 1)} aria-label={labels.previous}>
            <ChevronLeft size={22} />
          </button>
          <button type="button" className="hero-slideshow__arrow hero-slideshow__arrow--next" onClick={() => go(index + 1)} aria-label={labels.next}>
            <ChevronRight size={22} />
          </button>
          <div className="hero-slideshow__controls">
            <button type="button" className="hero-slideshow__pause" onClick={() => setPaused((value) => !value)} aria-label={paused ? labels.play : labels.pause}>
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <div className="hero-slideshow__dots" role="group" aria-label={labels.dots}>
              {slides.map((slide, slideIndex) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`hero-slideshow__dot${slideIndex === index ? ' is-active' : ''}`}
                  aria-label={`${labels.goTo} ${slideIndex + 1}`}
                  aria-current={slideIndex === index ? 'true' : undefined}
                  onClick={() => go(slideIndex)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
