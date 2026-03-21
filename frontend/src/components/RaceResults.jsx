import { useState, useEffect } from 'react'
import { Loader2, Trophy } from 'lucide-react'
import { fetchRaceResults } from '../services/api'

const BRACKET_COLORS = ['', '#fff', '#000', '#f00', '#00a', '#f0f', '#0a0', '#f80', '#e0e0e0']
const BRACKET_TEXT   = ['', '#333', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', '#333']

const BET_LABELS = {
  win:               '単勝',
  place:             '複勝',
  bracket_quinella:  '枠連',
  quinella:          '馬連',
  exacta:            '馬単',
  wide:              'ワイド',
  trio:              '3連複',
  trifecta:          '3連単',
}

const RANK_COLORS = { '1': '#d4af37', '2': '#aaa', '3': '#cd7f32' }

export default function RaceResults({ raceId }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    fetchRaceResults(raceId)
      .then(setData)
      .catch(() => setError('結果が取得できませんでした（未出走の可能性があります）'))
      .finally(() => setLoading(false))
  }, [raceId])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60, gap: 12 }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--gold)' }} />
      <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>結果を取得中...</span>
    </div>
  )

  if (error) return (
    <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
      {error}
    </div>
  )

  if (!data) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* 着順 */}
      <div className="card animate-in" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '12px 18px',
          background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Trophy size={14} color="var(--gold)" />
          <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--gold)' }}>着順</span>
          {data.surface && <span className="badge badge-green" style={{ fontSize: 10, marginLeft: 4 }}>{data.surface}</span>}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                {['着', '枠', '馬', '馬名', '騎手', '人気', '単勝', 'タイム', '着差', '上り', '馬体重'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rankings.map((r, i) => {
                const rankColor = RANK_COLORS[r.rank] || 'var(--text-primary)'
                const bracketNum = parseInt(r.bracket) || 0
                return (
                  <tr key={i} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  }}>
                    <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 900, fontSize: 15, color: rankColor }}>
                      {r.rank}
                    </td>
                    <td style={{ padding: '9px 6px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: 4,
                        background: BRACKET_COLORS[bracketNum] || '#333',
                        color: BRACKET_TEXT[bracketNum] || '#fff',
                        fontSize: 11, fontWeight: 800,
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}>{r.bracket}</span>
                    </td>
                    <td style={{ padding: '9px 6px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{r.horse_no}</td>
                    <td style={{ padding: '9px 10px', fontWeight: 700, color: rankColor, whiteSpace: 'nowrap' }}>{r.horse_name}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.jockey}</td>
                    <td style={{ padding: '9px 6px', textAlign: 'center', color: parseInt(r.popular) <= 3 ? 'var(--gold)' : 'var(--text-muted)' }}>{r.popular}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.win_odds}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{r.time}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>{r.margin}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>{r.last3f}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>{r.horse_weight}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 払戻金 */}
      <div className="card animate-in" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '12px 18px',
          background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--gold)' }}>払戻金</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 0,
        }}>
          {Object.entries(BET_LABELS).map(([key, label]) => {
            const entries = data.payouts?.[key]
            if (!entries?.length) return null
            return (
              <div key={key} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>{label}</div>
                {entries.map((e, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{e.combination}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 800,
                      color: i === 0 ? 'var(--gold)' : 'var(--text-primary)',
                    }}>{e.amount}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
