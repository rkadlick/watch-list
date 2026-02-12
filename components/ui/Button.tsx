import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-sm border border-primary/20 dark:border-primary/30 dark:hover:bg-primary/80 dark:hover:border-primary/40",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 hover:shadow-sm focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 border border-destructive/20 dark:border-destructive/30 dark:hover:border-destructive/40",
        outline:
          "border border-border/60 bg-background shadow-xs hover:bg-accent/30 hover:text-accent-foreground hover:border-accent/40 hover:shadow dark:bg-neutral-700/50 dark:border-border/50 dark:hover:bg-accent/25 dark:hover:border-accent/60 dark:hover:shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70 hover:shadow-sm border border-border/50 dark:bg-neutral-600/60 dark:text-neutral-100 dark:border-border/50 dark:hover:bg-neutral-600/80 dark:hover:border-border/60 dark:hover:shadow-sm",
        ghost:
          "hover:bg-accent/30 hover:text-accent-foreground dark:hover:bg-accent/25 dark:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80 dark:hover:text-primary/90",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
