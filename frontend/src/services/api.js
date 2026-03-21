import axios from 'axios'

// ブラウザのhostに基づいて動的にAPIのURLを決定
// Mac: localhost:5173 → localhost:8000
// スマホ: 192.168.1.12:5173 → 192.168.1.12:8000
const getApiUrl = () => {
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000'
  }
  return `http://${hostname}:8000`
}

const api = axios.create({
  baseURL: getApiUrl(),
  timeout: 30000,
})

export const fetchRaces = (date) =>
  api.get('/api/races', { params: date ? { date } : {} }).then(r => r.data)

export const fetchRaceDetail = (raceId) =>
  api.get(`/api/race/${raceId}`).then(r => r.data)

export const fetchOdds = (raceId) =>
  api.get(`/api/race/${raceId}/odds`).then(r => r.data)

export const fetchPrediction = (raceId) =>
  api.get(`/api/race/${raceId}/predict`).then(r => r.data)

export const fetchRaceResults = (raceId) =>
  api.get(`/api/race/${raceId}/results`).then(r => r.data)

export const simulateBet = (payload) =>
  api.post('/api/simulate', payload).then(r => r.data)

export default api
