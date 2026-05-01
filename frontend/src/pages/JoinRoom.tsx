import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  Hash,
  LogIn,
  MessageSquareText,
  UserRound,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { joinRoomSchema, type JoinRoomFormData } from '@/lib/validations'
import { useSocket } from '@/hooks/useSocket'
import { useChatStore } from '@/store/chatStore'

export default function JoinRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const { connect } = useSocket()
  const { isJoining, joinError } = useChatStore()
  // Formulario publico: valida PIN y nickname antes de abrir el WebSocket.
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<JoinRoomFormData>({
    resolver: zodResolver(joinRoomSchema),
    defaultValues: {
      pin: '',
      nickname: '',
    },
  })

  const onSubmit = (data: JoinRoomFormData) => {
    if (!roomId) return
    // connect emite join-room; la navegacion real ocurre cuando llega join-success.
    connect(roomId, data.pin, data.nickname)
  }

  if (!roomId) {
    // Defensa para URLs incompletas, aunque normalmente la ruta exige :roomId.
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-fg">
        <Card className="w-full max-w-md border-white/8 bg-surface text-fg">
          <CardHeader>
            <CardTitle>Falta el ID de la sala</CardTitle>
            <CardDescription className="text-slate-400">
              Usa una URL con el formato /join/:roomId para entrar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              className="w-full bg-brand text-white hover:bg-brand-hover"
            >
              <Link to="/login">Volver</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-fg">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
        <section className="grid w-full gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="hidden max-w-xl lg:block">
            {/* Resumen visible en escritorio con el ID para confirmar la sala destino. */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Acceso publico a sala
            </div>
            <h1 className="text-5xl font-medium leading-none tracking-normal">
              Entra a la conversacion con tu PIN.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-400">
              Elige un nickname unico para esta sala. Si el PIN es correcto, el
              backend abrira la sesion WebSocket y cargara el historial.
            </p>
            <div className="mt-8 rounded-lg border border-white/8 bg-white/[2.5%] p-4">
              <p className="text-xs uppercase text-zinc-500">Room ID</p>
              <p className="mt-2 break-all font-mono text-sm text-slate-300">
                {roomId}
              </p>
            </div>
          </div>

          {/* Formulario de ingreso para usuarios invitados. */}
          <Card className="w-full border-white/8 bg-surface/95 text-fg shadow-2xl shadow-black/40 ring-1 ring-white/[0.06]">
            <CardHeader className="gap-4 px-6 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-brand text-white shadow-lg shadow-brand/20">
                <MessageSquareText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-2xl font-medium text-fg">
                  Unirse a sala
                </CardTitle>
                <CardDescription className="mt-2 text-slate-400">
                  Ingresa el PIN y un nickname para continuar.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-6">
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-300"
                    htmlFor="pin"
                  >
                    PIN
                  </label>
                  <div className="relative">
                    <Hash
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                      aria-hidden="true"
                    />
                    <Input
                      id="pin"
                      className="h-10 border-white/8 bg-white/5 pl-9 text-fg placeholder:text-zinc-500 focus-visible:border-brand-hover focus-visible:ring-brand-hover/30"
                      inputMode="numeric"
                      placeholder="1234"
                      type="password"
                      {...register('pin')}
                    />
                  </div>
                  {errors.pin && (
                    <p className="text-sm text-red-300">{errors.pin.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-300"
                    htmlFor="nickname"
                  >
                    Nickname
                  </label>
                  <div className="relative">
                    <UserRound
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                      aria-hidden="true"
                    />
                    <Input
                      id="nickname"
                      className="h-10 border-white/8 bg-white/5 pl-9 text-fg placeholder:text-zinc-500 focus-visible:border-brand-hover focus-visible:ring-brand-hover/30"
                      placeholder="tu_nombre"
                      {...register('nickname')}
                    />
                  </div>
                  {errors.nickname && (
                    <p className="text-sm text-red-300">
                      {errors.nickname.message}
                    </p>
                  )}
                </div>

                {joinError && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                    {joinError}
                  </div>
                )}

                <Button
                  className="h-10 w-full bg-brand text-white hover:bg-brand-hover"
                  disabled={isJoining}
                  type="submit"
                >
                  <LogIn className="h-4 w-4" />
                  {isJoining ? 'Conectando...' : 'Entrar a la sala'}
                </Button>

                <Button
                  asChild
                  className="h-10 w-full border-white/8 bg-white/5 text-slate-300"
                  type="button"
                  variant="outline"
                >
                  <Link to="/">
                    <ArrowLeft className="h-4 w-4" />
                    Volver al dashboard
                  </Link>
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
