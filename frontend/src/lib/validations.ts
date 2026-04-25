import { z } from 'zod'

const pinSchema = z
  .string()
  .regex(/^\d{4,10}$/, 'El PIN debe tener entre 4 y 10 digitos')

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'El usuario es requerido')
    .max(50, 'El usuario no puede tener mas de 50 caracteres'),
  password: z
    .string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres'),
})

export const createRoomSchema = z.object({
  name: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(50, 'El nombre no puede tener mas de 50 caracteres'),
  type: z.enum(['TEXT', 'MULTIMEDIA'], {
    error: 'El tipo debe ser TEXT o MULTIMEDIA',
  }),
  pin: pinSchema,
  maxFileSize: z
    .number()
    .min(1, 'El tamano minimo es 1 MB')
    .max(100, 'El tamano maximo es 100 MB')
    .optional(),
})

export const joinRoomSchema = z.object({
  pin: pinSchema,
  nickname: z
    .string()
    .min(2, 'El nickname debe tener al menos 2 caracteres')
    .max(20, 'El nickname no puede tener mas de 20 caracteres')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Usa solo letras, numeros, guion o guion bajo',
    ),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type CreateRoomFormData = z.infer<typeof createRoomSchema>
export type JoinRoomFormData = z.infer<typeof joinRoomSchema>
