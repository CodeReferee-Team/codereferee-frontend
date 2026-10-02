import { useMutation, useQuery } from '@tanstack/react-query'
import {
  getValidation,
  getValidationHistory,
  isTerminal,
  submitValidation,
} from '@/lib/api'

const POLL_INTERVAL_MS = 2000

export const useSubmitValidation = () =>
  useMutation({ mutationFn: submitValidation })

// 종결 상태(PASSED/FAILED/ERROR)가 되면 폴링을 멈춘다.
export const useValidation = (requestId: string) =>
  useQuery({
    queryKey: ['validation', requestId],
    queryFn: () => getValidation(requestId),
    refetchInterval: (query) => {
      const status = query.state.data
      return status && isTerminal(status.currentAgent) ? false : POLL_INTERVAL_MS
    },
    // 404(없는 requestId)는 재시도해도 소용없다.
    retry: (count, error) =>
      !(error instanceof Error && 'status' in error && error.status === 404) &&
      count < 2,
  })

export const useValidationHistory = (
  repositoryUrl: string | null,
  commitSha: string | null,
) =>
  useQuery({
    queryKey: ['validation-history', repositoryUrl, commitSha],
    queryFn: () => getValidationHistory(repositoryUrl!, commitSha!),
    enabled: !!repositoryUrl && !!commitSha,
  })
