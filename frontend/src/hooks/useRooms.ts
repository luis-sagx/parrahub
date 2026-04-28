import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createRoom, deleteRoom, getRooms } from '@/services/roomsApi'
import type { CreateRoomPayload } from '@/types'

const roomsQueryKey = ['rooms']

export function useRooms() {
  const queryClient = useQueryClient()

  // Consulta principal del dashboard; React Query cachea y refresca la lista.
  const roomsQuery = useQuery({
    queryKey: roomsQueryKey,
    queryFn: getRooms,
  })

  const createRoomMutation = useMutation({
    mutationFn: (payload: CreateRoomPayload) => createRoom(payload),
    onSuccess: () => {
      // Al crear una sala se invalida la lista para pedir datos frescos.
      queryClient.invalidateQueries({ queryKey: roomsQueryKey })
    },
  })

  const deleteRoomMutation = useMutation({
    mutationFn: (id: string) => deleteRoom(id),
    onSuccess: () => {
      // Al eliminar tambien se refresca para quitar la tarjeta del dashboard.
      queryClient.invalidateQueries({ queryKey: roomsQueryKey })
    },
  })

  return {
    // Se expone una API pequena para que las pantallas no dependan de React Query directo.
    rooms: roomsQuery.data ?? [],
    isLoading: roomsQuery.isLoading,
    isError: roomsQuery.isError,
    error: roomsQuery.error,
    refetchRooms: roomsQuery.refetch,
    createRoom: createRoomMutation.mutateAsync,
    isCreating: createRoomMutation.isPending,
    deleteRoom: deleteRoomMutation.mutateAsync,
    isDeleting: deleteRoomMutation.isPending,
  }
}
