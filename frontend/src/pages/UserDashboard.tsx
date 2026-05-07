import { Copy, LogIn, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePublicRooms } from '@/hooks/usePublicRooms'

const formatDate = (value: string) =>
  // Formatea fechas del backend en espanol para mostrarlas en las tarjetas.
  new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))

export default function UserDashboard() {
  const navigate = useNavigate()
  // Hook publico para listar salas sin necesitar sesion de administrador.
  const { rooms, isLoading, isError, refetchRooms } = usePublicRooms()

  const handleLogout = () => {
    // logout()
    navigate('/login')
  }

  const getJoinUrl = (roomId: string) =>
    `${window.location.origin}/join/${roomId}`

  const copyJoinUrl = async (roomId: string) => {
    // Copia el enlace publico que los invitados usan para unirse a la sala.
    await navigator.clipboard.writeText(getJoinUrl(roomId))
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-fg">
      <header className="border-b border-white/8 bg-surface/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">
              Parras <span className="bg-brand p-1 rounded ml-0.5">hub</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="border-white/8 bg-white/5 text-slate-300"
              onClick={() => refetchRooms()}
              type="button"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button onClick={handleLogout} type="button" variant="ghost">
              <LogIn className="h-4 w-4" />
              Eres admin?
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-medium">Salas</h2>
            <p className="mt-1 text-sm text-slate-400">
              Ingresa a una sala para comenzar a chatear
            </p>
          </div>
        </div>

        {isLoading && (
          // Mientras React Query carga, se muestran tarjetas placeholder.
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <Skeleton
                key={item}
                className="h-36 rounded-xl bg-white/[0.06]"
              />
            ))}
          </div>
        )}

        {isError && (
          <Card className="border-red-500/20 bg-red-500/10 text-fg">
            <CardHeader>
              <CardTitle>No se pudieron cargar las salas</CardTitle>
              <CardDescription className="text-red-100/70">
                Revisa que el backend este activo.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {!isLoading && !isError && rooms.length === 0 && (
          <Card className="border-white/8 bg-white/[2.5%] text-fg">
            <CardHeader>
              <CardTitle>No hay salas en las que puedes ingresar</CardTitle>
              <CardDescription className="text-slate-400">
                Cuando el Administrador cree nuevas salas, apareceran aqui para
                que puedas unirte a ellas.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {!isLoading && !isError && rooms.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) => (
              // Cada tarjeta resume una sala y concentra sus acciones principales.
              <Card key={room.id} className="border-white/8 bg-surface text-fg">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{room.name}</CardTitle>
                      <CardDescription className="mt-1 text-slate-400">
                        Creada el {formatDate(room.createdAt)}
                      </CardDescription>
                    </div>
                    <Badge className="border-white/10 bg-white/[0.04] text-slate-300">
                      {room.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-white/8 bg-white/[2.5%] p-3">
                    <p className="text-xs uppercase text-zinc-500">ID sala</p>
                    <p className="mt-1 truncate font-mono text-xs text-slate-300">
                      {room.id}
                    </p>
                  </div>

                  {room.type === 'MULTIMEDIA' ? (
                    <span className="text-slate-400">
                      Max archivo: {room.maxFileSize} MB
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Archivos: no permitidos
                    </span>
                  )}

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      className="bg-brand text-white hover:bg-brand-hover"
                      onClick={() => navigate(`/join/${room.id}`)}
                      type="button"
                    >
                      <LogIn className="h-4 w-4" />
                      Entrar
                    </Button>
                    <Button
                      className="border-white/8 bg-white/5 text-slate-300"
                      onClick={() => copyJoinUrl(room.id)}
                      type="button"
                      variant="outline"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar link
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
