import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import RaceListPage from './pages/RaceListPage'
import RaceDetailPage from './pages/RaceDetailPage'
import './styles/global.css'

// ブラウザを閉じて再度開いたとき、前回のレースページに自動復帰
function AppContent() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!sessionStorage.getItem('sessionStarted')) {
      sessionStorage.setItem('sessionStarted', '1')
      const lastRaceId = localStorage.getItem('lastRaceId')
      if (lastRaceId && window.location.pathname === '/') {
        navigate(`/race/${lastRaceId}`, { replace: true })
      }
    }
  }, [])

  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<RaceListPage />} />
          <Route path="/race/:raceId" element={<RaceDetailPage />} />
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
