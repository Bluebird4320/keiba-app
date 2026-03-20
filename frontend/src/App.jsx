import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import RaceListPage from './pages/RaceListPage'
import RaceDetailPage from './pages/RaceDetailPage'
import './styles/global.css'

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<RaceListPage />} />
          <Route path="/race/:raceId" element={<RaceDetailPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
