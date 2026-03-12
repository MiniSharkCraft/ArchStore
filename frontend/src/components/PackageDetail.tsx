// frontend/src/components/PackageDetail.tsx
// Trang chi tiết package với rating Trustpilot-style
import { useState } from 'react'
import type { Package, SystemInfo, InstallProgress, Review, Reply } from '../types'

interface Props {
  pkg: Package
  installProgress?: InstallProgress
  sysInfo: SystemInfo | null
  onInstall: (name: string) => void
  onUninstall: (name: string) => void
  user: any
  onRequireLogin: () => void
  onSubmitReview: (pkg: string, rating: number, comment: string) => void
  onVote: (reviewId: number, type: string) => Promise<void>
  onBack: () => void
  t: (key: string, vars?: Record<string, string>) => string
}

export function PackageDetail({
  pkg, installProgress, sysInfo, onInstall, onUninstall,
  user, onRequireLogin, onSubmitReview, onVote, onBack, t
}: Props) {
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [hoverRating, setHoverRating] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const isInstalling = installProgress && installProgress.stage !== 'done' && installProgress.stage !== 'error'
  const rating = pkg.rating
  const alreadyReviewed = !!rating?.user_review_id || submitSuccess

  // Tính distribution %
  const getDistributionPct = (stars: number) => {
    if (!rating || rating.total_votes === 0) return 0
    const dist = rating.distribution?.find((d: { stars: number; count: number }) => d.stars === stars)
    return dist ? Math.round((dist.count / rating.total_votes) * 100) : 0
  }

  const handleSubmitReview = async () => {
    if (!user || reviewRating === 0 || reviewComment.trim().length < 10) return
    setIsSubmitting(true)
    try {
      await onSubmitReview(pkg.name, reviewRating, reviewComment)
      setReviewRating(0)
      setReviewComment('')
      setSubmitSuccess(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="pkg-detail">
      {/* Back button */}
      <button className="btn" onClick={onBack} style={{ marginBottom: 16, color: 'rgba(220,235,255,0.5)' }}>
        ← {t('nav.search')}
      </button>

      {/* ── HERO SECTION ── */}
      <div className="pkg-detail__hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pkg-detail__name">{pkg.name}</div>
            <p style={{ color: 'rgba(220,235,255,0.55)', fontSize: 13, marginTop: 6, maxWidth: 580 }}>
              {pkg.description}
            </p>
          </div>

          {/* Install / Uninstall Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {pkg.installed ? (
              <button className="btn btn--danger" onClick={() => onUninstall(pkg.name)} disabled={!!isInstalling}>
                {t('pkg.uninstall')}
              </button>
            ) : (
              <button
                className="btn btn--primary"
                onClick={() => onInstall(pkg.name)}
                disabled={!!isInstalling}
                style={{ minWidth: 120, justifyContent: 'center' }}
              >
                {isInstalling ? '⟳ ' + (t(`stage.${installProgress?.stage}`) || '...') : t('pkg.install')}
              </button>
            )}

            {/* "Works on my machine" badge */}
            {pkg.installed && sysInfo && (
              <div className="works-badge" title={`Kernel: ${sysInfo.kernel_version}`}>
                🐧 {t('works_on_mine')}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {isInstalling && installProgress && (
          <div className="install-progress" style={{ marginTop: 16 }}>
            <div className="install-progress__bar-track">
              <div
                className="install-progress__bar-fill"
                style={{ width: `${installProgress.progress}%` }}
              />
            </div>
            <div className="install-progress__text">
              {installProgress.message}
            </div>
          </div>
        )}

        {/* Meta badges */}
        <div className="pkg-detail__meta">
          <span className={`pkg-card__source source--${pkg.source}`}>{pkg.source.toUpperCase()}</span>
          <span className="meta-chip">
            <span className="meta-chip__label">{t('pkg.version')}</span> {pkg.version}
          </span>
          {pkg.size_kb > 0 && (
            <span className="meta-chip">
              <span className="meta-chip__label">{t('pkg.size')}</span> {formatSize(pkg.size_kb)}
            </span>
          )}
          {pkg.maintainer && (
            <span className="meta-chip">
              <span className="meta-chip__label">{t('pkg.maintainer')}</span> {pkg.maintainer}
            </span>
          )}
          {pkg.last_updated && (
            <span className="meta-chip">
              <span className="meta-chip__label">{t('pkg.last_updated')}</span> {pkg.last_updated}
            </span>
          )}
        </div>

        {/* Technical Specs Grid */}
        <div className="section-header" style={{ fontSize: 12, marginTop: 16, marginBottom: 10 }}>
          {t('tech_specs')}
        </div>
        <div className="spec-grid">
          <div className="spec-item">
            <div className="spec-item__key">{t('pkg.version')}</div>
            <div className="spec-item__value">{pkg.version || '—'}</div>
          </div>
          <div className="spec-item">
            <div className="spec-item__key">{t('pkg.size')}</div>
            <div className="spec-item__value">{pkg.size_kb > 0 ? formatSize(pkg.size_kb) : '—'}</div>
          </div>
          <div className="spec-item">
            <div className="spec-item__key">{t('pkg.source')}</div>
            <div className="spec-item__value">{pkg.source}</div>
          </div>
          {pkg.votes > 0 && (
            <div className="spec-item">
              <div className="spec-item__key">{t('pkg.votes')}</div>
              <div className="spec-item__value">{pkg.votes.toLocaleString()}</div>
            </div>
          )}
          {pkg.url && (
            <div className="spec-item" style={{ gridColumn: 'span 2' }}>
              <div className="spec-item__key">URL</div>
              <div className="spec-item__value" style={{ fontSize: 11 }}>{pkg.url}</div>
            </div>
          )}
          {pkg.depends?.length > 0 && (
            <div className="spec-item" style={{ gridColumn: '1 / -1' }}>
              <div className="spec-item__key">{t('pkg.depends')}</div>
              <div className="spec-item__value" style={{ fontSize: 11 }}>
                {pkg.depends.join('  ·  ')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RATING OVERVIEW (Trustpilot-style) ── */}
      <div className="section-header">{t('reviews')}</div>

      {rating && rating.total_votes > 0 ? (
        <div className="rating-overview">
          {/* Score bên trái */}
          <div className="rating-big">
            <div className="rating-big__number">{rating.average.toFixed(1)}</div>
            <div className="star-rating rating-big__stars">
              {[1,2,3,4,5].map(s => (
                <span key={s} className={`star ${s <= Math.round(rating.average) ? 'star--filled' : ''}`}>★</span>
              ))}
            </div>
            <div className="rating-big__count">
              {t('rating.based_on', { count: rating.total_votes.toString() })}
            </div>
          </div>

          {/* Distribution bars bên phải */}
          <div className="rating-bars">
            {[5,4,3,2,1].map(star => (
              <div key={star} className="rating-bar-row">
                <span style={{ minWidth: 8, color: 'rgba(220,235,255,0.4)', fontSize: 11 }}>{star}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,184,0,0.7)' }}>★</span>
                <div className="rating-bar-track">
                  <div className="rating-bar-fill" style={{ width: `${getDistributionPct(star)}%` }} />
                </div>
                <span style={{ minWidth: 32, textAlign: 'right', color: 'rgba(220,235,255,0.35)', fontSize: 11 }}>
                  {getDistributionPct(star)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ height: 100 }}>
          <div style={{ fontSize: 14, color: 'rgba(220,235,255,0.3)' }}>{t('no_reviews')}</div>
        </div>
      )}

      {/* ── WRITE REVIEW FORM ── */}
      <div className="review-form">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: 'rgba(220,235,255,0.8)' }}>
          {t('write_review')}
        </div>

        {!user ? (
          <div className="login-prompt">
            <span>🔒</span>
            <span>Bạn cần <button className="btn btn--primary" style={{padding:'3px 10px',fontSize:11}} onClick={onRequireLogin}>đăng nhập</button> để viết đánh giá</span>
          </div>
        ) : alreadyReviewed ? (
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:'rgba(0,245,255,0.05)',borderRadius:8,border:'1px solid rgba(0,245,255,0.15)'}}>
            <span style={{fontSize:18}}>✓</span>
            <div>
              <div style={{fontSize:13,color:'var(--cyan-dim)',fontWeight:600}}>Bạn đã đánh giá package này</div>
              <div style={{fontSize:11,color:'rgba(220,235,255,0.4)',marginTop:2}}>Mỗi người chỉ được đánh giá một lần để đảm bảo tính minh bạch</div>
            </div>
          </div>
        ) : (
          <>
            {/* User badge */}
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,padding:'8px 12px',background:'rgba(0,245,255,0.04)',borderRadius:8,border:'1px solid rgba(0,245,255,0.1)'}}>
              {user.avatar_url && <img src={user.avatar_url} style={{width:24,height:24,borderRadius:'50%',objectFit:'cover'}} alt=""/>}
              <span style={{fontSize:13,color:'var(--cyan-dim)'}}>Đánh giá với tư cách <strong>{user.username}</strong></span>
              {!pkg.installed && (
                <span style={{marginLeft:'auto',fontSize:11,color:'rgba(255,160,0,0.7)',background:'rgba(255,160,0,0.08)',padding:'2px 8px',borderRadius:4,border:'1px solid rgba(255,160,0,0.2)'}}>
                  ⚠ Chưa cài đặt
                </span>
              )}
            </div>

            {/* Star picker */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'rgba(220,235,255,0.4)', marginBottom: 6 }}>{t('your_rating')}</div>
              <div className="star-rating">
                {[1,2,3,4,5].map(s => (
                  <span
                    key={s}
                    className={`star ${s <= (hoverRating || reviewRating) ? 'star--filled' : ''}`}
                    style={{ fontSize: 24, cursor: 'pointer' }}
                    onClick={() => setReviewRating(s)}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                  >★</span>
                ))}
                {reviewRating > 0 && (
                  <span style={{fontSize:12,color:'rgba(220,235,255,0.4)',marginLeft:8}}>
                    {['','Rất tệ','Tệ','Bình thường','Tốt','Tuyệt vời'][reviewRating]}
                  </span>
                )}
              </div>
            </div>

            <textarea
              placeholder={t('your_comment')}
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              maxLength={2000}
              style={{ marginBottom: 6 }}
            />
            <div style={{fontSize:11,color:'rgba(220,235,255,0.25)',marginBottom:10,textAlign:'right'}}>
              {reviewComment.length}/2000
            </div>

            <button
              className="btn btn--primary"
              onClick={handleSubmitReview}
              disabled={isSubmitting || reviewRating === 0 || reviewComment.trim().length < 10}
            >
              {isSubmitting ? '...' : t('submit_review')}
            </button>
          </>
        )}
      </div>

      {/* ── REVIEW LIST ── */}
      {rating?.reviews?.map(review => (
        <ReviewCard key={review.id} review={review} onVote={onVote} t={t} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// REVIEW CARD COMPONENT
// ─────────────────────────────────────────────

function ReviewCard({
  review, onVote, t
}: { review: Review; onVote: (id: number, type: string) => Promise<void>; t: Function }) {
  const [voted, setVoted] = useState<boolean>(review.user_voted ?? false)
  const [likes, setLikes] = useState(review.likes)
  const [dislikes, setDislikes] = useState(review.dislikes)
  const [voteError, setVoteError] = useState('')

  const handleVote = async (type: 'like' | 'dislike') => {
    if (voted || review.is_mine) return
    try {
      await onVote(review.id, type)
      setVoted(true)
      if (type === 'like') setLikes((l: number) => l + 1)
      else setDislikes((d: number) => d + 1)
    } catch (err: any) {
      setVoteError(err?.message || 'Cần đăng nhập để vote')
      setTimeout(() => setVoteError(''), 3000)
    }
  }

  const dateStr = review.created_at || review.date
  return (
    <div className="review-card" style={review.is_mine ? {border:'1px solid rgba(0,245,255,0.25)',background:'rgba(0,245,255,0.03)'} : {}}>
      <div className="review-card__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="review-card__username">{review.username}</span>
          {review.is_mine && (
            <span style={{fontSize:10,padding:'1px 6px',borderRadius:3,background:'rgba(0,245,255,0.15)',color:'var(--cyan)',border:'1px solid rgba(0,245,255,0.3)'}}>
              Của bạn
            </span>
          )}
          <div className="star-rating" style={{ fontSize: 12 }}>
            {[1,2,3,4,5].map(s => (
              <span key={s} className={`star ${s <= review.rating ? 'star--filled' : ''}`} style={{ fontSize: 13 }}>★</span>
            ))}
          </div>
        </div>
        <span className="review-card__date">
          {dateStr ? new Date(dateStr).toLocaleDateString('vi-VN') : ''}
        </span>
      </div>

      <p className="review-card__comment">{review.comment}</p>

      {/* Maintainer replies */}
      {review.replies?.map((reply: Reply) => (
        <div key={reply.id} className="review-reply">
          <div className="review-reply__author">🛡️ {reply.author} — {t('maintainer_reply')}</div>
          <p style={{ fontSize: 12, color: 'rgba(220,235,255,0.65)', lineHeight: 1.5 }}>{reply.content}</p>
        </div>
      ))}

      <div className="review-card__actions">
        {review.is_mine ? (
          <span style={{fontSize:11,color:'rgba(220,235,255,0.3)'}}>Không thể vote bài của chính mình</span>
        ) : (
          <>
            <button
              className={`vote-btn ${voted ? 'vote-btn--liked' : ''}`}
              onClick={() => handleVote('like')}
              disabled={voted}
              title={voted ? 'Đã vote' : ''}
            >
              👍 {likes > 0 && `(${likes})`}
            </button>
            <button
              className={`vote-btn ${voted ? 'vote-btn--disliked' : ''}`}
              onClick={() => handleVote('dislike')}
              disabled={voted}
            >
              👎 {dislikes > 0 && `(${dislikes})`}
            </button>
            {voteError && <span style={{fontSize:11,color:'rgba(255,80,80,0.8)'}}>{voteError}</span>}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function formatSize(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GiB`
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MiB`
  return `${kb} KiB`
}
