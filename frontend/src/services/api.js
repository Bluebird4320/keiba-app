import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
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

export const simulateBet = (payload) =>
  api.post('/api/simulate', payload).then(r => r.data)

export default api
