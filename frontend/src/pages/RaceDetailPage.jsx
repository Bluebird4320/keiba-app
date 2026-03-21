import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Trophy, Users } from 'lucide-react'
import { fetchRaceDetail } from '../services/api'
import HorseCard from '../components/HorseCard'
import BetSimulator from '../components/BetSimulator'
import AIPrediction from '../components/AIPrediction'
import OddsPanel from '../components/OddsPanel'
import RaceResults from '../components/RaceResults'

export default function RaceDetailPage() {
  const { raceId } = useParams()
  const navigate = useNavigate()
  const [race, setRace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(() => {
    const raceDate = raceId?.slice(0, 8) || ''
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return raceDate < today ? 'results' : 'horses'
  })

  useEffect(() => {
    fetchRaceDetail(raceId)
      .then(setRace)
      .catch(() => setError('レース詳細の取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [raceId])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, flexDirection: 'column', gap: 14 }}>
      <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--gold)' }} />
      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>出走馬情報・過去成績を取得中...</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>（初回は1〜2分かかる場合があります）</div>
    </div>
  )

  if (error) return (
    <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}>
      <div style={{ color: '#f87171', fontSize: 14 }}>{error}</div>
    </div>
  )

  const tabs = [
    { key: 'results', label: '結果',   icon: Trophy },
    { key: 'horses',  label: '出走馬', icon: Users },
    { key: 'odds',    label: 'オッズ', icon: Trophy },
    { key: 'bet',     label: '買い目', icon: Trophy },
    { key: 'ai',      label: 'AI予想', icon: Trophy },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>
      {/* 戻るボタン */}
      <button
        onClick={() => navigate(-1)}
        className="btn btn-ghost"
        style={{ marginBottom: 20, fontSize: 13 }}
      >
        <ArrowLeft size={14} /> レース一覧に戻る
      </button>

      {/* レースヘッダー */}
      {race && (
        <div className="card animate-in" style={{ padding: '20px 24px', marginBottom: 24, background: 'linear-gradient(135deg, rgba(20,31,20,0.9), rgba(10,20,10,0.95))' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: 'var(--gold)', marginBottom: 6 }}>
                {race.race_name || 'レース詳細'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {race.race_conditions}
              </div>
              {(race.surface || race.track_condition) && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  {race.surface && <span className="badge badge-green" style={{ fontSize: 11 }}>{race.surface}</span>}
                  {race.track_condition && <span className="badge badge-green" style={{ fontSize: 11 }}>馬場:{race.track_condition}</span>}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {race.race_grade}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>出走頭数</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
                {race.horses?.length || 0}頭
              </div>
            </div>
          </div>
        </div>
      )}

      {/* タブ */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '10px 22px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, transition: 'all 0.18s',
              color: activeTab === key ? 'var(--green-bright)' : 'var(--text-muted)',
              borderBottom: activeTab === key ? '2px solid var(--green-bright)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      {race && (
        <>
          {activeTab === 'results' && (
            <RaceResults raceId={raceId} />
          )}

          {activeTab === 'horses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {race.horses?.length > 0 ? (
                race.horses.map((horse, i) => (
                  <HorseCard key={horse.horse_id || i} horse={horse} />
                ))
              ) : (
                <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  出走馬情報が取得できませんでした
                </div>
              )}
            </div>
          )}

          {activeTab === 'odds' && (
            <OddsPanel raceId={raceId} />
          )}

          {activeTab === 'bet' && (
            <BetSimulator horses={race.horses || []} />
          )}

          {activeTab === 'ai' && (
            <AIPrediction raceId={raceId} />
          )}
        </>
      )}
    </div>
  )
}
