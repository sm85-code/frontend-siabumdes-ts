import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  changePasswordRequest,
  loginRequest,
  logoutRequest,
} from '@/api/auth'
import { queryKeys } from '@/api/keys'

/**
 * TanStack mutations for auth side-effects.
 * AuthProvider still owns session state; these wrap the API for typed useMutation usage.
 */
export function useLoginMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      loginRequest(username, password),
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.auth.me, user)
    },
  })
}

export function useLogoutMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => logoutRequest(),
    onSettled: () => {
      qc.removeQueries({ queryKey: queryKeys.auth.me })
      qc.clear()
    },
  })
}

export function useChangePasswordMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string
      newPassword: string
    }) => changePasswordRequest(currentPassword, newPassword),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.auth.me })
    },
  })
}
