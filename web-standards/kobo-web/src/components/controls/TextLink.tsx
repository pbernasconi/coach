import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'
import { focusRing } from './Button'

export const textLinkVariants = cva(
  [
    'rounded-inner text-body font-semibold underline-offset-4 hover:underline',
    'transition-colors duration-(--motion-state) ease-standard',
    focusRing,
  ],
  {
    variants: {
      /** `brand` for a link in a sentence or a form; `muted` for a quiet link, such as in a footer. */
      variant: {
        brand: 'text-brand-ink hover:text-brand-ink/80',
        muted: 'text-ink-muted hover:text-ink',
      },
    },
    defaultVariants: { variant: 'brand' },
  },
)

export interface TextLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement>, VariantProps<typeof textLinkVariants> {
  /** Render the child (for example a router link) with the link styles. */
  asChild?: boolean
  ref?: React.Ref<HTMLAnchorElement>
}

/**
 * An inline text link. It is a plain `<a href>`; use `asChild` for a router link.
 *
 *     <TextLink href="/help">Read the guide</TextLink>
 *     <TextLink asChild variant="muted"><RouterLink to="/terms">Terms</RouterLink></TextLink>
 */
export function TextLink({ className, variant, asChild = false, ...props }: TextLinkProps) {
  const Comp = asChild ? Slot : 'a'
  return <Comp className={cn(textLinkVariants({ variant }), className)} {...props} />
}
