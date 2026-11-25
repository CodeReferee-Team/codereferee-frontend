import { Tooltip } from '@base-ui/react/tooltip'
import { CircleHelp } from 'lucide-react'
import { useState } from 'react'

export function HelpTip({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger
        aria-label={`${label} 설명`}
        delay={200}
        closeOnClick={false}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CircleHelp className="size-3.5" aria-hidden="true" />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={8} className="z-50">
          <Tooltip.Popup className="max-w-72 rounded-md bg-foreground px-3 py-2 text-xs leading-relaxed text-background shadow-md">
            {children}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
