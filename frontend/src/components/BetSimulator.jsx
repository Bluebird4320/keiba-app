import { useState, useEffect, useMemo } from 'react'
import { BookmarkPlus, Trash2 } from 'lucide-react'

// ─── 枠色定義 ────────────────────────────────────────────────
const BRACKET_COLORS = [
  null,
  { bg: '#e0e0e0', text: '#1a1a1a' }, // 1枠 白
  { bg: '#1e1e1e', text: '#ffffff' }, // 2枠 黒
  { bg: '#c82020', text: '#ffffff' }, // 3枠 赤
  { bg: '#1048bb', text: '#ffffff' }, // 4枠 青
  { bg: '#e8c800', text: '#1a1a1a' }, // 5枠 黄
  { bg: '#1e8c1e', text: '#ffffff' }, // 6枠 緑
  { bg: '#e06818', text: '#ffffff' }, // 7枠 橙
  { bg: '#d84888', text: '#ffffff' }, // 8枠 ピンク
]

// ─── 勝式定義 ────────────────────────────────────────────────
const BET_TYPES = [
  { key: 'win',              label: '単勝',   formats: ['通常'],                                              usesBrackets: false },
  { key: 'place',            label: '複勝',   formats: ['通常'],                                              usesBrackets: false },
  { key: 'bracket_quinella', label: '枠連',   formats: ['ボックス'],                                         usesBrackets: true  },
  { key: 'quinella',         label: '馬連',   formats: ['流し', 'ボックス', 'フォーメーション'],              usesBrackets: false },
  { key: 'exacta',           label: '馬単',   formats: ['流し', 'ボックス', 'フォーメーション', 'マルチ'],   usesBrackets: false },
  { key: 'wide',             label: 'ワイド', formats: ['流し', 'ボックス', 'フォーメーション'],              usesBrackets: false },
  { key: 'trio',             label: '三連複', formats: ['流し', 'ボックス', 'フォーメーション'],              usesBrackets: false },
  { key: 'trifecta',         label: '三連単', formats: ['流し', 'ボックス', 'フォーメーション', 'マルチ'],   usesBrackets: false },
]
const BET_LABEL = Object.fromEntries(BET_TYPES.map(b => [b.key, b.label]))

// 行ラベル・カラーテーマ
const ROW_COLORS = {
  gold:  { border: 'rgba(212,175,55,0.5)',  bg: 'rgba(212,175,55,0.06)',  label: 'var(--gold)' },
  green: { border: 'rgba(34,197,94,0.5)',   bg: 'rgba(34,197,94,0.06)',   label: 'var(--green-bright)' },
  blue:  { border: 'rgba(102,136,238,0.5)', bg: 'rgba(102,136,238,0.06)', label: '#8899ee' },
}

function getRows(betType, format) {
  if (betType === 'win' || betType === 'place') {
    return [{ key: 'A', label: '馬を選択', color: null }]
  }
  if (betType === 'bracket_quinella') {
    return [{ key: 'A', label: '枠を選択', color: null, isBracket: true }]
  }
  if (format === 'ボックス') {
    return [{ key: 'A', label: 'ボックス馬を選択', color: null }]
  }
  if (format === '流し') {
    const isOrdered = betType === 'exacta' || betType === 'trifecta'
    return [
      { key: 'A', label: isOrdered ? '1着（軸）' : '軸', color: 'gold' },
      { key: 'B', label: isOrdered ? '2・3着（相手）' : '相手', color: 'green' },
    ]
  }
  if (format === 'マルチ') {
    return [
      { key: 'A', label: '軸', color: 'gold' },
      { key: 'B', label: '相手', color: 'green' },
    ]
  }
  // フォーメーション
  if (betType === 'exacta') {
    return [{ key: 'A', label: '1着', color: 'gold' }, { key: 'B', label: '2着', color: 'green' }]
  }
  if (betType === 'quinella' || betType === 'wide') {
    return [{ key: 'A', label: '1着側', color: 'gold' }, { key: 'B', label: '2着側', color: 'green' }]
  }
  if (betType === 'trio') {
    return [
      { key: 'A', label: '1頭目', color: 'gold' },
      { key: 'B', label: '2頭目', color: 'green' },
      { key: 'C', label: '3頭目', color: 'blue' },
    ]
  }
  if (betType === 'trifecta') {
    return [
      { key: 'A', label: '1着', color: 'gold' },
      { key: 'B', label: '2着', color: 'green' },
      { key: 'C', label: '3着', color: 'blue' },
    ]
  }
  return [{ key: 'A', label: '馬を選択', color: null }]
}

// ─── 組み合わせ生成ユーティリティ ────────────────────────────
function comb2(arr, r) {
  if (r === 0) return [[]]
  const result = []
  for (let i = 0; i <= arr.length - r; i++) {
    for (const rest of comb2(arr.slice(i + 1), r - 1)) result.push([arr[i], ...rest])
  }
  return result
}

function perm2(arr, r) {
  if (r === 0) return [[]]
  const result = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const p of perm2(rest, r - 1)) result.push([arr[i], ...p])
  }
  return result
}

function genCombos(betType, format, posA, posB, posC) {
  const a = [...posA].sort((x, y) => +x - +y)
  const b = [...posB].sort((x, y) => +x - +y)
  const c = [...posC].sort((x, y) => +x - +y)

  const dedup = (list) => {
    const seen = new Set()
    return list.filter(p => {
      const k = p.join('-')
      return seen.has(k) ? false : (seen.add(k), true)
    })
  }

  if (betType === 'win' || betType === 'place') return a.map(x => [x])

  if (betType === 'bracket_quinella') return comb2(a, 2)

  if (betType === 'quinella' || betType === 'wide') {
    if (format === 'ボックス') return comb2(a, 2)
    if (format === '流し') {
      return dedup(a.flatMap(ax => b.filter(op => op !== ax).map(op => [ax, op].sort((x, y) => +x - +y))))
    }
    return dedup(a.flatMap(x => b.filter(y => y !== x).map(y => [x, y].sort((u, v) => +u - +v))))
  }

  if (betType === 'exacta') {
    if (format === 'ボックス') return perm2(a, 2)
    const base = a.flatMap(x => b.filter(y => y !== x).map(y => [x, y]))
    if (format === 'マルチ') return dedup([...base, ...base.map(([x, y]) => [y, x])])
    return dedup(base)
  }

  if (betType === 'trio') {
    if (format === 'ボックス') return comb2(a, 3)
    if (format === '流し') {
      const raw = []
      for (const ax of a) {
        for (const [x, y] of comb2(b, 2)) {
          if (x !== ax && y !== ax) {
            raw.push([ax, x, y].map(Number).sort((u, v) => u - v).map(String))
          }
        }
      }
      return dedup(raw)
    }
    return dedup(
      a.flatMap(x => b.flatMap(y =>
        c.filter(z => z !== x && z !== y && x !== y)
          .map(z => [x, y, z].map(Number).sort((u, v) => u - v).map(String))
      ))
    )
  }

  if (betType === 'trifecta') {
    if (format === 'ボックス') return perm2(a, 3)
    if (format === '流し') {
      return dedup(
        a.flatMap(first =>
          perm2(b.filter(x => x !== first), 2).map(([x, y]) => [first, x, y])
        )
      )
    }
    if (format === 'マルチ') {
      const raw = []
      for (const ax of a) {
        for (const [x, y] of comb2(b.filter(z => z !== ax), 2)) {
          for (const p of perm2([ax, x, y], 3)) raw.push(p)
        }
      }
      return dedup(raw)
    }
    return dedup(
      a.flatMap(x =>
        b.filter(y => y !== x).flatMap(y =>
          c.filter(z => z !== x && z !== y).map(z => [x, y, z])
        )
      )
    )
  }

  return []
}

function getBracketNo(horse) {
  if (horse.bracket_no) return parseInt(horse.bracket_no)
  return Math.min(8, Math.ceil(parseInt(horse.horse_no) / 2))
}

// ─── メインコンポーネント ─────────────────────────────────────
export default function BetSimulator({ horses = [], oddsData = {}, raceName = '' }) {
  const [view, setView]               = useState('sim')
  const [betType, setBetType]         = useState('trio')
  const [format, setFormat]           = useState('流し')
  const [posA, setPosA]               = useState(new Set())
  const [posB, setPosB]               = useState(new Set())
  const [posC, setPosC]               = useState(new Set())
  const [amount, setAmount]           = useState(100)
  const [evenMode, setEvenMode]       = useState(false)
  const [totalBudget, setTotalBudget] = useState(1000)
  const [savedBets, setSavedBets]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('savedBets') || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('savedBets', JSON.stringify(savedBets))
  }, [savedBets])

  const handleBetTypeChange = (key) => {
    const bt = BET_TYPES.find(b => b.key === key)
    if (!bt) return
    setBetType(key)
    setFormat(bt.formats[0])
    setPosA(new Set()); setPosB(new Set()); setPosC(new Set())
  }

  const handleFormatChange = (f) => {
    setFormat(f)
    setPosA(new Set()); setPosB(new Set()); setPosC(new Set())
  }

  const togglePos = (setter, no) =>
    setter(prev => {
      const next = new Set(prev)
      next.has(no) ? next.delete(no) : next.add(no)
      return next
    })

  const posForKey = (key) => {
    if (key === 'A') return [posA, setPosA]
    if (key === 'B') return [posB, setPosB]
    return [posC, setPosC]
  }

  const currentBT = BET_TYPES.find(b => b.key === betType)
  const rows      = useMemo(() => getRows(betType, format), [betType, format])

  const combos = useMemo(() => {
    try { return genCombos(betType, format, posA, posB, posC) } catch { return [] }
  }, [betType, format, posA, posB, posC])

  const effectiveAmount = (evenMode && combos.length > 0)
    ? Math.max(100, Math.floor(totalBudget / combos.length / 100) * 100)
    : amount

  const totalAmount = combos.length * effectiveAmount
  const SEP = (betType === 'exacta' || betType === 'trifecta') ? '→' : '-'

  const syntheticOdds = useMemo(() => {
    if (betType !== 'win' || !Array.isArray(oddsData?.win) || combos.length === 0) return null
    const inv = combos.reduce((sum, c) => {
      const entry = oddsData.win.find(o => o.combination === c[0])
      const o = entry ? parseFloat(entry.odds) : 0
      return o > 0 ? sum + 1 / o : sum
    }, 0)
    return inv > 0 ? (1 / inv).toFixed(1) : null
  }, [betType, oddsData, combos])

  const calcPayout = (combo) => {
    if (betType !== 'win' || !Array.isArray(oddsData?.win)) return null
    const entry = oddsData.win.find(o => o.combination === combo[0])
    if (!entry?.odds) return null
    return Math.floor(effectiveAmount * parseFloat(entry.odds))
  }

  const handleSave = () => {
    if (combos.length === 0) return
    setSavedBets(prev => [{
      id: Date.now(),
      raceName,
      betType,
      format,
      combinations: combos.map(c => ({ combination: c.join(SEP), amount: effectiveAmount })),
      totalBets: combos.length,
      totalAmount,
      savedAt: new Date().toISOString(),
    }, ...prev])
  }

  return (
    <div className="card" style={{ padding: 20 }}>

      {/* ── ビュータブ ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'sim',   label: 'フォーメーション計算機' },
          { key: 'saved', label: `保存済み${savedBets.length > 0 ? ` (${savedBets.length})` : ''}` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setView(key)} style={{
            padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            color: view === key ? 'var(--green-bright)' : 'var(--text-muted)',
            borderBottom: view === key ? '2px solid var(--green-bright)' : '2px solid transparent',
            marginBottom: -1,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════ 保存済みビュー ══════════════ */}
      {view === 'saved' ? (
        savedBets.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            保存済みの買い目がありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savedBets.map(bet => (
              <div key={bet.id} style={{
                background: 'var(--bg-secondary)', borderRadius: 10, padding: 14,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {bet.raceName || 'レース'}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                      {BET_LABEL[bet.betType] || bet.betType} / {bet.format}
                    </span>
                  </div>
                  <button
                    onClick={() => setSavedBets(prev => prev.filter(b => b.id !== bet.id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>
                  {bet.combinations.slice(0, 8).map(c => c.combination).join(' / ')}
                  {bet.combinations.length > 8 && ` … (+${bet.combinations.length - 8}点)`}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>
                    {bet.totalBets}点 / {bet.totalAmount.toLocaleString()}円
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(bet.savedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )

      ) : (
        /* ══════════════ シミュレータービュー ══════════════ */
        <>

          {/* 勝式タブ */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em' }}>
              勝式
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {BET_TYPES.map(b => (
                <button
                  key={b.key}
                  onClick={() => handleBetTypeChange(b.key)}
                  style={{
                    padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
                    background: betType === b.key
                      ? 'linear-gradient(135deg,#1a7a1a,#22c55e)'
                      : 'var(--bg-secondary)',
                    color: betType === b.key ? '#fff' : 'var(--text-secondary)',
                    boxShadow: betType === b.key ? '0 2px 8px rgba(34,197,94,0.3)' : 'none',
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* 買い方タブ（複数フォーマットがある勝式のみ） */}
          {currentBT && currentBT.formats.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em' }}>
                買い方
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {currentBT.formats.map(f => (
                  <button
                    key={f}
                    onClick={() => handleFormatChange(f)}
                    style={{
                      padding: '5px 14px', borderRadius: 6, border: '1px solid',
                      borderColor: format === f ? 'var(--gold)' : 'var(--border)',
                      background: format === f ? 'rgba(212,175,55,0.1)' : 'transparent',
                      color: format === f ? 'var(--gold)' : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 馬選択エリア */}
          <div style={{ marginBottom: 16 }}>
            {rows.map(row => {
              const [pos, setPos] = posForKey(row.key)
              const rc = row.color ? ROW_COLORS[row.color] : null
              return (
                <div
                  key={row.key}
                  style={{
                    marginBottom: 10,
                    padding: rc ? '10px 12px' : '4px 0',
                    borderRadius: rc ? 8 : 0,
                    border: rc ? `1px solid ${rc.border}` : 'none',
                    background: rc ? rc.bg : 'transparent',
                  }}
                >
                  <div style={{
                    fontSize: 11, fontWeight: 700, marginBottom: 8,
                    color: rc ? rc.label : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {row.label}
                    {pos.size > 0 && (
                      <span style={{ fontWeight: 400, opacity: 0.75, fontSize: 10 }}>
                        {pos.size}頭選択中
                      </span>
                    )}
                  </div>

                  {row.isBracket ? (
                    /* 枠ボタン */
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {[1,2,3,4,5,6,7,8].map(n => {
                        const bc = BRACKET_COLORS[n]
                        const selected = pos.has(String(n))
                        return (
                          <button
                            key={n}
                            onClick={() => togglePos(setPos, String(n))}
                            style={{
                              width: 52, height: 42, borderRadius: 8,
                              border: `2px solid ${selected ? 'var(--green-bright)' : 'transparent'}`,
                              background: bc.bg, color: bc.text,
                              fontSize: 12, fontWeight: 800, cursor: 'pointer',
                              boxShadow: selected ? '0 0 0 2px var(--green-bright)' : 'none',
                              transition: 'box-shadow 0.1s',
                            }}
                          >
                            {n}枠
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    /* 馬ボタン */
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {horses.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          レース詳細を開くと馬が表示されます
                        </span>
                      ) : horses.map(h => {
                        const no = String(h.horse_no)
                        const selected = pos.has(no)
                        const bracketNo = getBracketNo(h)
                        const bc = BRACKET_COLORS[bracketNo] || BRACKET_COLORS[1]
                        return (
                          <button
                            key={no}
                            onClick={() => togglePos(setPos, no)}
                            style={{
                              display: 'flex', alignItems: 'stretch',
                              padding: 0, borderRadius: 6,
                              border: `1.5px solid ${selected ? 'var(--green-bright)' : 'var(--border)'}`,
                              background: selected ? 'rgba(34,197,94,0.1)' : 'transparent',
                              cursor: 'pointer', overflow: 'hidden', transition: 'all 0.1s',
                            }}
                          >
                            <span style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 24, padding: '4px 0',
                              background: bc.bg, color: bc.text,
                              fontSize: 11, fontWeight: 900,
                              borderRight: `1px solid ${selected ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                            }}>
                              {h.horse_no}
                            </span>
                            <span style={{
                              padding: '4px 8px',
                              fontSize: 11, fontWeight: 600,
                              color: selected ? 'var(--green-bright)' : 'var(--text-secondary)',
                              maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {h.horse_name || '?'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 金額設定 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
                金額設定
              </div>
              <button
                onClick={() => setEvenMode(v => !v)}
                style={{
                  padding: '3px 10px', borderRadius: 6, border: '1px solid',
                  borderColor: evenMode ? 'var(--gold)' : 'var(--border)',
                  background: evenMode ? 'rgba(212,175,55,0.1)' : 'transparent',
                  color: evenMode ? 'var(--gold)' : 'var(--text-muted)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                均等分散 {evenMode ? 'ON' : 'OFF'}
              </button>
            </div>
            {evenMode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>総予算:</span>
                {[500, 1000, 2000, 5000].map(v => (
                  <button key={v} onClick={() => setTotalBudget(v)} style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid',
                    borderColor: totalBudget === v ? 'var(--gold)' : 'var(--border)',
                    background: totalBudget === v ? 'rgba(212,175,55,0.1)' : 'transparent',
                    color: totalBudget === v ? 'var(--gold)' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                    {v.toLocaleString()}円
                  </button>
                ))}
                <input
                  type="number" value={totalBudget} min={100} step={100}
                  onChange={e => setTotalBudget(Math.max(100, Math.floor(+e.target.value / 100) * 100))}
                  style={{
                    width: 80, padding: '4px 8px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontSize: 11, textAlign: 'right',
                  }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>1点あたり:</span>
                {[100, 200, 500, 1000].map(v => (
                  <button key={v} onClick={() => setAmount(v)} style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid',
                    borderColor: amount === v ? 'var(--gold)' : 'var(--border)',
                    background: amount === v ? 'rgba(212,175,55,0.1)' : 'transparent',
                    color: amount === v ? 'var(--gold)' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                    {v.toLocaleString()}円
                  </button>
                ))}
                <input
                  type="number" value={amount} min={100} step={100}
                  onChange={e => setAmount(Math.max(100, Math.floor(+e.target.value / 100) * 100))}
                  style={{
                    width: 80, padding: '4px 8px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontSize: 11, textAlign: 'right',
                  }}
                />
              </div>
            )}
          </div>

          {/* 買い目一覧（リアルタイム表示） */}
          {combos.length > 0 ? (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              {/* サマリー行 */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 10, flexWrap: 'wrap', gap: 8,
              }}>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                  <span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>点数 </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{combos.length}点</strong>
                  </span>
                  {syntheticOdds && (
                    <span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>合成オッズ </span>
                      <strong style={{ color: 'var(--green-bright)' }}>{syntheticOdds}倍</strong>
                    </span>
                  )}
                  {evenMode && combos.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      1点 {effectiveAmount.toLocaleString()}円
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>
                    {totalAmount.toLocaleString()}円
                  </span>
                  <button
                    onClick={handleSave}
                    style={{
                      padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <BookmarkPlus size={13} />保存
                  </button>
                </div>
              </div>

              {/* 組み合わせリスト */}
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {combos.map((c, i) => {
                  const payout = calcPayout(c)
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '5px 10px', borderRadius: 6, background: 'var(--bg-secondary)',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {c.join(SEP)}
                      </span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {effectiveAmount.toLocaleString()}円
                        </span>
                        {payout && (
                          <span style={{ color: 'var(--green-bright)', fontWeight: 700 }}>
                            ≒{payout.toLocaleString()}円
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            horses.length > 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                馬を選択すると買い目がリアルタイムで表示されます
              </div>
            )
          )}

        </>
      )}
    </div>
  )
}
