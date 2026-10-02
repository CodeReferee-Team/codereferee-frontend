import { Route, Routes } from 'react-router'
import SubmitPage from '@/pages/SubmitPage'
import ValidationPage from '@/pages/ValidationPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SubmitPage />} />
      <Route path="/validations/:requestId" element={<ValidationPage />} />
    </Routes>
  )
}
