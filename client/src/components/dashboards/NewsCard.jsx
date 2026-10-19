import { Megaphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi.js';
import { formatDate } from '../../utils/format.js';
import { isFreshNews } from '../../utils/news.js';
import LiveBadge from '../ui/LiveBadge.jsx';

/** Latest school announcements for every role, with a pulsing badge on fresh items. */
export default function NewsCard() {
  const { t } = useTranslation();
  const { data, error } = useApi('/announcements', { limit: 4 });
  const items = data ?? [];
  const freshCount = items.filter((item) => isFreshNews(item.publishedAt)).length;

  return (
    <section id="school-news" className="card news-card">
      <div className="card__header">
        <h2 className="card__title"><Megaphone size={16} aria-hidden="true" className="inline-icon" /> {t('dash.news.title')}</h2>
        {freshCount > 0 && <LiveBadge>{t('dash.news.fresh', { count: freshCount })}</LiveBadge>}
      </div>
      {error && <div className="card__body text-sm text-muted">{t('dash.news.error')}</div>}
      {data && items.length === 0 && <div className="card__body text-sm text-muted">{t('dash.news.empty')}</div>}
      {items.length > 0 && (
        <ul className="news-list">
          {items.map((item) => (
            <li key={item.id} className={isFreshNews(item.publishedAt) ? 'is-fresh' : undefined}>
              <div className="news-list__meta">
                <span className="mono">{formatDate(item.publishedAt)}</span>
                {isFreshNews(item.publishedAt) && <LiveBadge className="live-badge--sm">{t('dash.news.new')}</LiveBadge>}
              </div>
              <strong className="news-list__title">{item.title}</strong>
              <p className="news-list__body">{item.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Slim strip at the top of the dashboard when there is fresh news; links down to the news card. */
export function NewsTicker() {
  const { t } = useTranslation();
  const { data } = useApi('/announcements', { limit: 4 });
  const latest = (data ?? []).find((item) => isFreshNews(item.publishedAt));
  if (!latest) return null;
  return (
    <a href="#school-news" className="news-ticker">
      <LiveBadge>{t('dash.news.breaking')}</LiveBadge>
      <span className="news-ticker__title">{latest.title}</span>
      <span className="news-ticker__more">{t('dash.news.readMore')}</span>
    </a>
  );
}
