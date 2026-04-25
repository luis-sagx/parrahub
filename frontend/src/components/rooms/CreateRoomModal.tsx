import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { EyeOff, Hash, Type } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { createRoomSchema, type CreateRoomFormData } from '@/lib/validations'
import { useRooms } from '@/hooks/useRooms'

interface CreateRoomModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CreateRoomModal({
  open,
  onOpenChange,
}: CreateRoomModalProps) {
  const { createRoom, isCreating } = useRooms()
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<CreateRoomFormData>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: '',
      type: 'TEXT',
      pin: '',
      maxFileSize: 10,
    },
  })

  const roomType = watch('type')

  useEffect(() => {
    if (!open) {
      reset({
        name: '',
        type: 'TEXT',
        pin: '',
        maxFileSize: 10,
      })
    }
  }, [open, reset])

  const onSubmit = async (data: CreateRoomFormData) => {
    await createRoom({
      name: data.name,
      type: data.type,
      pin: data.pin,
      maxFileSize: data.type === 'MULTIMEDIA' ? data.maxFileSize : undefined,
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/[0.08] bg-[#0f1011] text-[#f7f8f8] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl text-[#f7f8f8]">
            Crear nueva sala
          </DialogTitle>
          <DialogDescription className="text-[#8a8f98]">
            Define el acceso, el tipo de sala y el limite de archivos si aplica.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#d0d6e0]" htmlFor="name">
              Nombre
            </label>
            <div className="relative">
              <Type
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#62666d]"
                aria-hidden="true"
              />
              <Input
                id="name"
                className="h-10 border-white/[0.08] bg-white/[0.03] pl-9 text-[#f7f8f8] placeholder:text-[#62666d] focus-visible:border-[#7170ff] focus-visible:ring-[#7170ff]/30"
                placeholder="Sala de soporte"
                {...register('name')}
              />
            </div>
            {errors.name && (
              <p className="text-sm text-red-300">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <span className="text-sm font-medium text-[#d0d6e0]">Tipo</span>
            <RadioGroup
              className="grid grid-cols-2 gap-3"
              value={roomType}
              onValueChange={(value) =>
                setValue('type', value as CreateRoomFormData['type'], {
                  shouldValidate: true,
                })
              }
            >
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-[#d0d6e0]">
                <RadioGroupItem value="TEXT" />
                Texto
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-[#d0d6e0]">
                <RadioGroupItem value="MULTIMEDIA" />
                Multimedia
              </label>
            </RadioGroup>
            {errors.type && (
              <p className="text-sm text-red-300">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#d0d6e0]" htmlFor="pin">
              PIN
            </label>
            <div className="relative">
              <Hash
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#62666d]"
                aria-hidden="true"
              />
              <Input
                id="pin"
                className="h-10 border-white/[0.08] bg-white/[0.03] pl-9 pr-9 text-[#f7f8f8] placeholder:text-[#62666d] focus-visible:border-[#7170ff] focus-visible:ring-[#7170ff]/30"
                inputMode="numeric"
                placeholder="1234"
                type="password"
                {...register('pin')}
              />
              <EyeOff
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#62666d]"
                aria-hidden="true"
              />
            </div>
            {errors.pin && (
              <p className="text-sm text-red-300">{errors.pin.message}</p>
            )}
          </div>

          {roomType === 'MULTIMEDIA' && (
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-[#d0d6e0]"
                htmlFor="maxFileSize"
              >
                Tamano maximo de archivo (MB)
              </label>
              <Input
                id="maxFileSize"
                className="h-10 border-white/[0.08] bg-white/[0.03] text-[#f7f8f8] focus-visible:border-[#7170ff] focus-visible:ring-[#7170ff]/30"
                max={100}
                min={1}
                type="number"
                {...register('maxFileSize', { valueAsNumber: true })}
              />
              {errors.maxFileSize && (
                <p className="text-sm text-red-300">
                  {errors.maxFileSize.message}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="border-white/[0.08] bg-white/[0.03]">
            <Button
              className="border-white/[0.12] bg-white/[0.06] text-[#f7f8f8] hover:bg-white/[0.1] hover:text-white"
              disabled={isCreating}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              className="bg-[#5e6ad2] text-white hover:bg-[#7170ff]"
              disabled={isCreating}
              type="submit"
            >
              {isCreating ? 'Creando...' : 'Crear sala'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
