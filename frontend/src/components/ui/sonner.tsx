import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': '#0f1011',
          '--normal-text': '#f7f8f8',
          '--normal-border': 'rgba(255,255,255,0.1)',
          '--border-radius': 'calc(var(--radius) + 2px)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'cn-toast border border-white/10 bg-surface text-fg shadow-2xl shadow-black/40 ring-1 ring-white/[0.06]',
          title: 'text-sm font-medium text-fg',
          description: 'text-sm text-slate-300',
          closeButton:
            'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white',
          actionButton:
            'bg-brand text-white hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand-hover/40',
          cancelButton:
            'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]',
          success:
            'border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,16,17,0.96))] text-fg',
          info:
            'border-brand/30 bg-[linear-gradient(135deg,rgba(94,106,210,0.22),rgba(15,16,17,0.96))] text-fg',
          warning:
            'border-amber-400/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(15,16,17,0.96))] text-fg',
          error:
            'border-rose-400/25 bg-[linear-gradient(135deg,rgba(244,63,94,0.18),rgba(15,16,17,0.96))] text-fg',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
