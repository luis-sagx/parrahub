import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createRoom, deleteRoom, getRooms } from '@/services/roomsApi'
import type { CreateRoomPayload } from '@/types'

const roomsQueryKey = ['rooms']

export function useRooms() {
  const queryClient = useQueryClient()

  const roomsQuery = useQuery({
    queryKey: roomsQueryKey,
    queryFn: getRooms,
  })

  const createRoomMutation = useMutation({
    mutationFn: (payload: CreateRoomPayload) => createRoom(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roomsQueryKey })
    },
  })

  const deleteRoomMutation = useMutation({
    mutationFn: (id: string) => deleteRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roomsQueryKey })
    },
  })

  return {
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
