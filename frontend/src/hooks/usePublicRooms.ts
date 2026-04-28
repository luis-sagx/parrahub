import { useQuery } from '@tanstack/react-query'
import { getPublicRooms } from '@/services/roomsApi'

const publicRoomsQueryKey = ['rooms', 'public']

export function usePublicRooms() {
  // Lista salas activas para usuarios invitados, sin depender del token admin.
  const roomsQuery = useQuery({
    queryKey: publicRoomsQueryKey,
    queryFn: getPublicRooms,
  })

  return {
    rooms: roomsQuery.data ?? [],
    isLoading: roomsQuery.isLoading,
    isError: roomsQuery.isError,
    error: roomsQuery.error,
    refetchRooms: roomsQuery.refetch,
  }
}
