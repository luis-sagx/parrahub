import { QueryClient } from '@tanstack/react-query'

// Configuracion global de cache para las consultas REST del frontend.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
