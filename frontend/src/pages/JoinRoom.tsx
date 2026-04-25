import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Hash, LogIn, MessageSquareText, UserRound } from 'lucide-react'
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
    connect(roomId, data.pin, data.nickname)
  }

  if (!roomId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08090a] px-6 text-[#f7f8f8]">
        <Card className="w-full max-w-md border-white/[0.08] bg-[#0f1011] text-[#f7f8f8]">
          <CardHeader>
            <CardTitle>Falta el ID de la sala</CardTitle>
            <CardDescription className="text-[#8a8f98]">
              Usa una URL con el formato /join/:roomId para entrar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-[#5e6ad2] text-white">
              <Link to="/login">Volver</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#08090a] text-[#f7f8f8]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
        <section className="grid w-full gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="hidden max-w-xl lg:block">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-sm text-[#d0d6e0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              Acceso publico a sala
            </div>
            <h1 className="text-5xl font-medium leading-none tracking-normal">
              Entra a la conversacion con tu PIN.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#8a8f98]">
              Elige un nickname unico para esta sala. Si el PIN es correcto, el
              backend abrira la sesion WebSocket y cargara el historial.
            </p>
            <div className="mt-8 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
              <p className="text-xs uppercase text-[#62666d]">Room ID</p>
              <p className="mt-2 break-all font-mono text-sm text-[#d0d6e0]">
                {roomId}
              </p>
            </div>
          </div>

          <Card className="w-full border-white/[0.08] bg-[#0f1011]/95 text-[#f7f8f8] shadow-2xl shadow-black/40 ring-white/[0.06]">
            <CardHeader className="gap-4 px-6 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#5e6ad2] text-white shadow-lg shadow-[#5e6ad2]/20">
                <MessageSquareText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-2xl font-medium text-[#f7f8f8]">
                  Unirse a sala
                </CardTitle>
                <CardDescription className="mt-2 text-[#8a8f98]">
                  Ingresa el PIN y un nickname para continuar.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-6">
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-[#d0d6e0]"
                    htmlFor="pin"
                  >
                    PIN
                  </label>
                  <div className="relative">
                    <Hash
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#62666d]"
                      aria-hidden="true"
                    />
                    <Input
                      id="pin"
                      className="h-10 border-white/[0.08] bg-white/[0.03] pl-9 text-[#f7f8f8] placeholder:text-[#62666d] focus-visible:border-[#7170ff] focus-visible:ring-[#7170ff]/30"
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
                    className="text-sm font-medium text-[#d0d6e0]"
                    htmlFor="nickname"
                  >
                    Nickname
                  </label>
                  <div className="relative">
                    <UserRound
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#62666d]"
                      aria-hidden="true"
                    />
                    <Input
                      id="nickname"
                      className="h-10 border-white/[0.08] bg-white/[0.03] pl-9 text-[#f7f8f8] placeholder:text-[#62666d] focus-visible:border-[#7170ff] focus-visible:ring-[#7170ff]/30"
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
                  className="h-10 w-full bg-[#5e6ad2] text-white hover:bg-[#7170ff]"
                  disabled={isJoining}
                  type="submit"
                >
                  <LogIn className="h-4 w-4" />
                  {isJoining ? 'Conectando...' : 'Entrar a la sala'}
                </Button>

                <Button
                  asChild
                  className="h-10 w-full border-white/[0.08] bg-white/[0.03] text-[#d0d6e0] hover:bg-white/[0.06]"
                  type="button"
                  variant="outline"
                >
                  <Link to="/dashboard">
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
