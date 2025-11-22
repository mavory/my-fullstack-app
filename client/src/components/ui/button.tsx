import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Základní třídy pro všechny varianty
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 ease-in-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  // 1. Změny pro moderní ostrost a neonový fokus
  // rounded-sm pro ostřejší hrany, focus-visible:ring-offset-0 pro čistý neonový kruh
  "rounded-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
  {
    variants: {
      variant: {
        // Hlavní tlačítko (pro Hlasování) - Neonový styl
        default: 
          "bg-primary text-primary-foreground " + 
          "hover:bg-primary/80 " + // Lehké ztmavení (v Dark/Light modu)
          "hover:shadow-primary/50 hover:shadow-lg " + // Přidá neonovou záři při najetí
          "active:scale-[0.98]", // Animace stlačení
        
        // Destruktivní (pro Smazání)
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98]",
        
        // Outline (Ostrý, kontrastní rámeček)
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
        
        // Sekundární (Pro méně důležité akce)
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70 active:scale-[0.98]",
        
        // Ghost a Link zůstávají čisté
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-sm px-3",
        lg: "h-11 rounded-sm px-8 text-base", // Zvětšení textu pro důraz
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
