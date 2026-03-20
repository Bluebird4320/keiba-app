import { useState } from 'react'
import { Brain, Star, AlertTriangle, Loader2, TrendingUp, Shield, Zap } from 'lucide-react'
import { fetchPrediction } from '../services/api'

const RANK_COLORS = { 1: 'var(--rank-1)', 2: 'var(--rank-2)', 3: 'var(--rank-3)' }
const RANK_LABELS = { 1: '◎ 本命', 2: '○ 対抗', 3: '▲ 単穴' }
const CONFIDENCE_COLORS = { 高: '#22c55e', 中: '#f59e0b', 低: '#ef4444' }

export default function AIPrediction({ raceId }) {
  const [prediction, setPrediction] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)

  const handleFetch = async () => {
    setLoading(true)
    setError('')
    const start = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)
    try {
      const data = await fetchPrediction(raceId)
      setPrediction(data.prediction)
    } catch (e) {
      setError('AI予想の取得に失敗しました')
    } finally {
      setLoading(false)
      clearInterval(timer)
      setElapsed(0)
    }
  }

  return (
    <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, rgba(20,31,20,0.95), rgba(10,20,10,0.98))' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="section-title" style={{ fontSize: 18 }}>
          <Brain size={18} />
          AI予想
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {prediction?.db_enhanced && (
            <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(212,175,55,0.1)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.2)', fontSize: 10, fontWeight: 700 }}>
              📊 DB実績連携
            </span>
          )}
          <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: 'var(--green-bright)', border: '1px solid rgba(34,197,94,0.2)', fontSize: 10 }}>
            Gemini 2.5 Flash
          </span>
        </div>
      </div>

      {/* 未取得状態 */}
      {!prediction && !loading && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
            JRA公式2022-2026年の重賞実績データを活用してAIが分析します
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 16, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>📈 馬の重賞成績</span>
            <span>🏇 距離・馬場適性</span>
            <span>👤 騎手GⅠ実績</span>
          </div>
          <button className="btn btn-gold" onClick={handleFetch} style={{ margin: '0 auto' }}>
            <Brain size={15} />
            AI予想を取得する
          </button>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '28px 0', color: 'var(--text-muted)' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--gold)' }} />
          <div style={{ fontSize: 13 }}>DBデータを分析中... ({elapsed}秒)</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>各馬・騎手の重賞実績を照合しています</div>
        </div>
      )}

      {error && (
        <div style={{ color: '#f87171', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} /> {error}
          <button className="btn btn-ghost" onClick={handleFetch} style={{ marginLeft: 8, padding: '4px 10px', fontSize: 11 }}>再試行</button>
        </div>
      )}

      {/* 予想結果 */}
      {prediction && !prediction.error && (
        <div className="animate-in">

          {/* 信頼度バッジ */}
          {prediction.confidence && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Shield size={13} color={CONFIDENCE_COLORS[prediction.confidence] || '#fff'} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>予想信頼度:</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: CONFIDENCE_COLORS[prediction.confidence] || '#fff' }}>
                {prediction.confidence}
              </span>
            </div>
          )}

          {/* 展開予想 */}
          {prediction.summary && (
            <div style={{ marginBottom: 16, padding: 14, borderRadius: 8, background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)' }}>
              <div style={{ fontSize: 11, color: 'var(--gold-dim)', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <TrendingUp size={12} /> レース展開・注目ポイント
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{prediction.summary}</div>
            </div>
          )}

          {/* 予想上位3頭 */}
          {prediction.top3 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 10 }}>予想上位馬（DB実績ベース）</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prediction.top3.map((horse) => (
                  <div key={horse.rank} style={{
                    display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 8,
                    background: horse.rank === 1 ? 'rgba(212,175,55,0.08)' : 'var(--bg-secondary)',
                    border: '1px solid',
                    borderColor: horse.rank === 1 ? 'rgba(212,175,55,0.3)' : 'var(--border)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: RANK_COLORS[horse.rank], minWidth: 54, flexShrink: 0 }}>
                      {RANK_LABELS[horse.rank]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        {horse.horse_no}番 {horse.horse_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>
                        {horse.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 穴馬 */}
          {prediction.dark_horse && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Zap size={13} color="#a78bfa" />
                <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>穴馬注目</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {prediction.dark_horse.horse_no}番 {prediction.dark_horse.horse_name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.6 }}>
                {prediction.dark_horse.reason}
              </div>
            </div>
          )}

          {/* 推奨買い目 */}
          {prediction.recommended_bet && (
            <div style={{ marginBottom: 12, padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Star size={13} color="var(--green-bright)" />
                <span style={{ fontSize: 11, color: 'var(--green-bright)', fontWeight: 700 }}>推奨買い目</span>
                <span className="badge badge-green" style={{ marginLeft: 4 }}>{prediction.recommended_bet.type}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {prediction.recommended_bet.combination}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {prediction.recommended_bet.reason}
              </div>
            </div>
          )}

          {/* 再予想ボタン */}
          <button className="btn btn-ghost" onClick={handleFetch} style={{ width: '100%', justifyContent: 'center', fontSize: 12, marginBottom: 10 }}>
            <Brain size={13} /> 再予想する
          </button>

          {/* 免責 */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 4, lineHeight: 1.6 }}>
            <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            {prediction.caution || '本予想はJRA公式重賞データに基づくAI参考情報です。馬券購入は自己責任でお願いします。'}
          </div>
        </div>
      )}

      {prediction?.error && (
        <div style={{ color: '#f87171', fontSize: 12 }}>{prediction.error}</div>
      )}
    </div>
  )
}
