import type { Message, NewsItem } from '../../types'

interface NewsCardsProps {
  message: Message
}

export function NewsCards({ message }: NewsCardsProps) {
  let items: NewsItem[] = []
  try {
    items = JSON.parse(message.content)
  } catch {
    return null
  }

  if (!items.length) return null

  return (
    <div className="news-cards">
      {items.map((item, i) => (
        <a
          key={i}
          className="news-card"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.image && (
            <div className="news-card__image">
              <img src={item.image} alt={item.title} loading="lazy" />
            </div>
          )}
          <div className="news-card__body">
            <div className="news-card__title">{item.title}</div>
            {item.description && (
              <div className="news-card__desc">{item.description}</div>
            )}
          </div>
        </a>
      ))}
    </div>
  )
}
