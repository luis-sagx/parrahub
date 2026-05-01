import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  LockKeyhole,
  MessageSquareText,
  UserRound,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
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
  // react-hook-form maneja el formulario y Zod valida usuario/contrasena.
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
      // Si el backend acepta las credenciales, guardamos el JWT para las rutas privadas.
      const response = await login(credentials)
      setToken(response.access_token)
      navigate('/dashboard')
    } catch {
      // El error root se muestra arriba del boton cuando falla el login completo.
      setError('root', {
        message: 'Credenciales invalidas o backend no disponible',
      })
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-fg">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10">
        <section className="grid w-full gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
          {/* Panel informativo visible en escritorio; en movil queda solo el formulario. */}
          <div className="hidden max-w-xl lg:block">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Sistema de chat en tiempo real
            </div>

            <h1 className="text-5xl font-medium leading-none tracking-normal text-fg">
              Panel de control para administrar tus salas.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-slate-400">
              Crea salas, controla el acceso por PIN y prepara conversaciones de
              texto o multimedia desde una interfaz clara y rapida.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {['JWT', 'Rooms', 'Socket.IO'].map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-white/8 bg-white/[2.5%] px-4 py-3 text-sm text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Tarjeta principal con el formulario de acceso del administrador. */}
          <Card className="w-full border-white/8 bg-surface/95 text-fg shadow-2xl shadow-black/40 ring-1 ring-white/[0.06]">
            <CardHeader className="gap-4 px-6 pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-brand text-white shadow-lg shadow-brand/20">
                  <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                </div>
                <Badge className="border-white/10 bg-white/[0.04] text-slate-300">
                  Admin
                </Badge>
              </div>

              <div>
                <CardTitle className="text-2xl font-medium text-fg">
                  Iniciar sesion
                </CardTitle>
                <CardDescription className="mt-2 text-slate-400">
                  Accede para crear y gestionar salas privadas.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-6">
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-300"
                    htmlFor="username"
                  >
                    Usuario
                  </label>
                  <div className="relative">
                    <UserRound
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                      aria-hidden="true"
                    />
                    <Input
                      id="username"
                      className="h-10 border-white/8 bg-white/5 pl-9 text-fg placeholder:text-zinc-500 focus-visible:border-brand-hover focus-visible:ring-brand-hover/30"
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
                    className="text-sm font-medium text-slate-300"
                    htmlFor="password"
                  >
                    Contrasena
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                      aria-hidden="true"
                    />
                    <Input
                      id="password"
                      className="h-10 border-white/8 bg-white/5 pl-9 text-fg placeholder:text-zinc-500 focus-visible:border-brand-hover focus-visible:ring-brand-hover/30"
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
                  className="h-10 w-full bg-brand text-white hover:bg-brand-hover"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? 'Entrando...' : 'Entrar al dashboard'}
                </Button>
              </form>

              <Separator className="my-5 bg-white/8" />

              <p className="text-center text-xs leading-5 text-zinc-500">
                Las credenciales se validan contra el backend NestJS y el token
                se mantiene solo durante la sesion del navegador.
              </p>
              <Button
                asChild
                className="mt-4 h-10 w-full border-white/8 bg-white/5 text-slate-300"
                type="button"
                variant="outline"
              >
                <Link to="/">
                  <ArrowLeft className="h-4 w-4" />
                  Volver al dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
