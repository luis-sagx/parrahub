import { zodResolver } from '@hookform/resolvers/zod'
import { LockKeyhole, MessageSquareText, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
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
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { loginSchema, type LoginFormData } from '@/lib/validations'
import { login } from '@/services/roomsApi'
import { useAuthStore } from '@/store/authStore'

export default function AdminLogin() {
  const navigate = useNavigate()
  const setToken = useAuthStore((state) => state.setToken)
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  const onSubmit = async (credentials: LoginFormData) => {
    try {
      const response = await login(credentials)
      setToken(response.access_token)
      navigate('/dashboard')
    } catch {
      setError('root', {
        message: 'Credenciales invalidas o backend no disponible',
      })
    }
  }

  return (
    <main className="min-h-screen bg-[#08090a] text-[#f7f8f8]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10">
        <section className="grid w-full gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="hidden max-w-xl lg:block">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-sm text-[#d0d6e0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              Sistema de chat en tiempo real
            </div>

            <h1 className="text-5xl font-medium leading-none tracking-normal text-[#f7f8f8]">
              Panel de control para administrar tus salas.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-[#8a8f98]">
              Crea salas, controla el acceso por PIN y prepara conversaciones
              de texto o multimedia desde una interfaz clara y rapida.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {['JWT', 'Rooms', 'Socket.IO'].map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-sm text-[#d0d6e0]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <Card className="w-full border-white/[0.08] bg-[#0f1011]/95 text-[#f7f8f8] shadow-2xl shadow-black/40 ring-white/[0.06]">
            <CardHeader className="gap-4 px-6 pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#5e6ad2] text-white shadow-lg shadow-[#5e6ad2]/20">
                  <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                </div>
                <Badge className="border-white/10 bg-white/[0.04] text-[#d0d6e0]">
                  Admin
                </Badge>
              </div>

              <div>
                <CardTitle className="text-2xl font-medium text-[#f7f8f8]">
                  Iniciar sesion
                </CardTitle>
                <CardDescription className="mt-2 text-[#8a8f98]">
                  Accede para crear y gestionar salas privadas.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-6">
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-[#d0d6e0]"
                    htmlFor="username"
                  >
                    Usuario
                  </label>
                  <div className="relative">
                    <UserRound
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#62666d]"
                      aria-hidden="true"
                    />
                    <Input
                      id="username"
                      className="h-10 border-white/[0.08] bg-white/[0.03] pl-9 text-[#f7f8f8] placeholder:text-[#62666d] focus-visible:border-[#7170ff] focus-visible:ring-[#7170ff]/30"
                      type="text"
                      placeholder="admin"
                      {...register('username')}
                    />
                  </div>
                  {errors.username && (
                    <p className="text-sm text-red-300">
                      {errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-[#d0d6e0]"
                    htmlFor="password"
                  >
                    Contrasena
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#62666d]"
                      aria-hidden="true"
                    />
                    <Input
                      id="password"
                      className="h-10 border-white/[0.08] bg-white/[0.03] pl-9 text-[#f7f8f8] placeholder:text-[#62666d] focus-visible:border-[#7170ff] focus-visible:ring-[#7170ff]/30"
                      type="password"
                      placeholder="Minimo 8 caracteres"
                      {...register('password')}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-300">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {errors.root && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                    {errors.root.message}
                  </div>
                )}

                <Button
                  className="h-10 w-full bg-[#5e6ad2] text-white hover:bg-[#7170ff]"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? 'Entrando...' : 'Entrar al dashboard'}
                </Button>
              </form>

              <Separator className="my-5 bg-white/[0.08]" />

              <p className="text-center text-xs leading-5 text-[#62666d]">
                Las credenciales se validan contra el backend NestJS y el token
                se mantiene solo durante la sesion del navegador.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
