import { useState } from 'react'
import { ChevronDown, ChevronUp, User, TrendingUp } from 'lucide-react'

const BRACKET_COLORS = ['', '#fff', '#000', '#f00', '#00a', '#f0f', '#0a0', '#f80', '#e0e0e0']
const BRACKET_TEXT   = ['', '#333', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', '#333']

function RankBadge({ rank }) {
  const r = parseInt(rank)
  const color = r === 1 ? 'var(--rank-1)' : r === 2 ? 'var(--rank-2)' : r === 3 ? 'var(--rank-3)' : 'var(--text-muted)'
  return (
    <span style={{ color, fontWeight: 800, fontSize: 12, minWidth: 22, display: 'inline-block', textAlign: 'center' }}>
      {rank ? `${rank}着` : '-'}
    </span>
  )
}

export default function HorseCard({ horse, highlight }) {
  const [expanded, setExpanded] = useState(false)

  const bracketNum = parseInt(horse.bracket_no) || 0
  const bgColor = BRACKET_COLORS[bracketNum] || '#333'
  const textColor = BRACKET_TEXT[bracketNum] || '#fff'

  const popularNum = parseInt(horse.popular) || 99
  const isTopFav = popularNum <= 3

  return (
    <div
      className="card animate-in"
      style={{
        padding: 0,
        overflow: 'hidden',
        border: highlight ? '1px solid var(--gold)' : undefined,
        boxShadow: highlight ? '0 0 20px rgba(212,175,55,0.15)' : undefined,
      }}
    >
      {/* メイン行 */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* 枠番 */}
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: bgColor, color: textColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, flexShrink: 0,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {horse.bracket_no}
        </div>

        {/* 馬番 */}
        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', minWidth: 28, textAlign: 'center' }}>
          {horse.horse_no}
        </div>

        {/* 馬名・属性 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: highlight ? 'var(--gold)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {horse.horse_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {horse.age_sex} | {horse.trainer_name} | {horse.horse_weight}
          </div>
        </div>

        {/* 騎手 */}
        <div style={{ textAlign: 'center', minWidth: 80 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{horse.jockey_name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>騎手</div>
        </div>

        {/* オッズ */}
        <div style={{ textAlign: 'right', minWidth: 70 }}>
          <div style={{
            fontSize: 16, fontWeight: 800,
            color: isTopFav ? 'var(--gold)' : 'var(--text-primary)',
          }}>
            {horse.odds ? `${horse.odds}倍` : '-'}
          </div>
          {horse.popular && (
            <div style={{ fontSize: 10, color: isTopFav ? 'var(--gold-dim)' : 'var(--text-muted)' }}>
              {horse.popular}番人気
            </div>
          )}
        </div>

        {/* 展開ボタン */}
        <div style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* 展開パネル */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* 過去成績 */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <TrendingUp size={12} /> 過去成績（最近10走）
              </div>
              {horse.past_races && horse.past_races.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {horse.past_races.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <RankBadge rank={r.rank} />
                      <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.race_name}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{r.date}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>データ取得中...</div>
              )}
            </div>

            {/* 騎手情報 */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <User size={12} /> 騎手情報
              </div>
              {horse.jockey_info && Object.keys(horse.jockey_info).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(horse.jockey_info).slice(0, 6).map(([k, v]) => (
                    typeof v === 'string' && (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{v}</span>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{horse.jockey_name}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
