"use client"

import * as React from "react"
// @ts-ignore — @radix-ui/react-select dist contains valid JS; .d.ts resolved via ambient declarations
import * as SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// ─── Type Helpers ─────────────────────────────────────────────────────────────
// React 19 removed implicit children from ComponentProps → add it back explicitly
type AnyProps = { [key: string]: any; children?: React.ReactNode; className?: string }

// ─── Select ─────────────────────────────────────────────────────────────────────
const Select = SelectPrimitive.Root as React.FC<AnyProps>
const SelectGroup = SelectPrimitive.Group as React.FC<AnyProps>
const SelectValue = SelectPrimitive.Value as React.FC<AnyProps>

// ─── SelectTrigger ───────────────────────────────────────────────────────────
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: AnyProps & { size?: "sm" | "default" }) {
  const Trigger = SelectPrimitive.Trigger as React.FC<AnyProps>
  const Icon = SelectPrimitive.Icon as React.FC<AnyProps>
  return (
    <Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </Icon>
    </Trigger>
  )
}

// ─── SelectScrollUpButton ────────────────────────────────────────────────────
function SelectScrollUpButton({ className, ...props }: AnyProps) {
  const ScrollUpButton = SelectPrimitive.ScrollUpButton as React.FC<AnyProps>
  return (
    <ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </ScrollUpButton>
  )
}

// ─── SelectScrollDownButton ──────────────────────────────────────────────────
function SelectScrollDownButton({ className, ...props }: AnyProps) {
  const ScrollDownButton = SelectPrimitive.ScrollDownButton as React.FC<AnyProps>
  return (
    <ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </ScrollDownButton>
  )
}

// ─── SelectContent ───────────────────────────────────────────────────────────
function SelectContent({
  className,
  children,
  position = "popper",
  align = "center",
  ...props
}: AnyProps & { position?: string; align?: string }) {
  const Portal = SelectPrimitive.Portal as React.FC<AnyProps>
  const Content = SelectPrimitive.Content as React.FC<AnyProps>
  const Viewport = SelectPrimitive.Viewport as React.FC<AnyProps>
  return (
    <Portal>
      <Content
        data-slot="select-content"
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-[100] max-h-[300px] min-w-[8rem] overflow-hidden rounded-md border shadow-md",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <Viewport
          className={cn(
            "p-1 max-h-[280px] overflow-y-auto",
            position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </Viewport>
        <SelectScrollDownButton />
      </Content>
    </Portal>
  )
}

// ─── SelectLabel ─────────────────────────────────────────────────────────────
function SelectLabel({ className, ...props }: AnyProps) {
  const Label = SelectPrimitive.Label as React.FC<AnyProps>
  return (
    <Label
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  )
}

// ─── SelectItem ──────────────────────────────────────────────────────────────
function SelectItem({ className, children, ...props }: AnyProps) {
  const Item = SelectPrimitive.Item as unknown as React.FC<AnyProps>
  const ItemIndicator = SelectPrimitive.ItemIndicator as unknown as React.FC<AnyProps>
  const ItemText = SelectPrimitive.ItemText as unknown as React.FC<AnyProps>
  return (
    <Item
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        <ItemIndicator>
          <CheckIcon className="size-4" />
        </ItemIndicator>
      </span>
      <ItemText>{children}</ItemText>
    </Item>
  )
}

// ─── SelectSeparator ─────────────────────────────────────────────────────────
function SelectSeparator({ className, ...props }: AnyProps) {
  const Separator = SelectPrimitive.Separator as React.FC<AnyProps>
  return (
    <Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
