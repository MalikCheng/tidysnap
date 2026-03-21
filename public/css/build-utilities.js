#!/usr/bin/env node
/**
 * build-utilities.js
 *
 * Reads /Users/malik/clawd/code/tidysnap/public/index.html, extracts all Tailwind
 * utility classes from class="..." attributes, and generates a minimal CSS file
 * at /Users/malik/clawd/code/tidysnap/public/css/tailwind-utilities.css containing
 * only those utility classes mapped to their standard CSS properties.
 *
 * Also includes custom classes (.hero-bg, .snap-card, .countdown,
 * .gradient-text, .btn-primary, .btn-glow, .success-checkmark,
 * .bounce-subtle) and @keyframes from the HTML <style> block.
 */

const fs = require('fs');

const HTML_PATH = '/Users/malik/clawd/code/tidysnap/public/index.html';
const OUTPUT_PATH = '/Users/malik/clawd/code/tidysnap/public/css/tailwind-utilities.css';

// ─── Tailwind class → CSS property map ───────────────────────────────────────

const MAP = {

  // Dimensions ───────────────────────────────────────────────────────────────
  'h-1':           'height: 0.25rem',
  'h-1.5':         'height: 0.375rem',
  'h-7':           'height: 1.75rem',
  'w-1.5':         'width: 0.375rem',
  'h-8':           'height: 2rem',
  'h-10':          'height: 2.5rem',
  'h-14':          'height: 3.5rem',
  'h-20':          'height: 5rem',
  'h-40':          'height: 10rem',
  'h-48':          'height: 12rem',
  'h-56':          'height: 14rem',
  'h-72':          'height: 18rem',
  'h-96':          'height: 24rem',
  'h-full':        'height: 100%',

  'w-7':           'width: 1.75rem',
  'w-8':           'width: 2rem',
  'w-10':          'width: 2.5rem',
  'w-14':          'width: 3.5rem',
  'w-20':          'width: 5rem',
  'w-40':          'width: 10rem',
  'w-48':          'width: 12rem',
  'w-56':          'width: 14rem',
  'w-72':          'width: 18rem',
  'w-96':          'width: 24rem',
  'w-full':        'width: 100%',

  'min-h-screen':  'min-height: 100vh',
  'min-h-full':    'min-height: 100%',

  'max-w-2xl':     'max-width: 42rem',
  'max-w-4xl':     'max-width: 56rem',
  'max-w-6xl':     'max-width: 72rem',
  'max-w-7xl':     'max-width: 80rem',
  'max-w-lg':      'max-width: 32rem',
  'max-w-md':      'max-width: 28rem',
  'max-w-sm':      'max-width: 24rem',
  'max-w-xl':      'max-width: 36rem',

  // Spacing: Margin ──────────────────────────────────────────────────────────
  'm-0':           'margin: 0',
  'mx-auto':       'margin-left: auto; margin-right: auto',
  'my-auto':       'margin-top: auto; margin-bottom: auto',
  'mx-1':          'margin-left: 0.25rem; margin-right: 0.25rem',
  'mx-2':          'margin-left: 0.5rem; margin-right: 0.5rem',
  'my-1':          'margin-top: 0.25rem; margin-bottom: 0.25rem',
  'my-2':          'margin-top: 0.5rem; margin-bottom: 0.5rem',

  'mt-0':          'margin-top: 0',
  'mt-1':          'margin-top: 0.25rem',
  'mt-2':          'margin-top: 0.5rem',
  'mt-3':          'margin-top: 0.75rem',
  'mt-4':          'margin-top: 1rem',
  'mt-6':          'margin-top: 1.5rem',
  'mt-8':          'margin-top: 2rem',
  'mt-10':         'margin-top: 2.5rem',
  'mt-12':         'margin-top: 3rem',
  'mt-16':         'margin-top: 4rem',
  'mt-20':         'margin-top: 5rem',

  'mb-0':          'margin-bottom: 0',
  'mb-1':          'margin-bottom: 0.25rem',
  'mb-2':          'margin-bottom: 0.5rem',
  'mb-3':          'margin-bottom: 0.75rem',
  'mb-4':          'margin-bottom: 1rem',
  'mb-5':          'margin-bottom: 1.25rem',
  'mb-6':          'margin-bottom: 1.5rem',
  'mb-8':          'margin-bottom: 2rem',
  'mb-10':         'margin-bottom: 2.5rem',
  'mb-12':         'margin-bottom: 3rem',
  'mb-16':         'margin-bottom: 4rem',
  'mb-auto':       'margin-bottom: auto',

  'ml-0':          'margin-left: 0',
  'ml-1':          'margin-left: 0.25rem',
  'ml-2':          'margin-left: 0.5rem',
  'ml-3':          'margin-left: 0.75rem',
  'ml-4':          'margin-left: 1rem',
  'ml-auto':       'margin-left: auto',

  'mr-0':          'margin-right: 0',
  'mr-1':          'margin-right: 0.25rem',
  'mr-2':          'margin-right: 0.5rem',

  // Spacing: Padding ─────────────────────────────────────────────────────────
  'px-2':          'padding-left: 0.5rem; padding-right: 0.5rem',
  'px-4':          'padding-left: 1rem; padding-right: 1rem',
  'px-6':          'padding-left: 1.5rem; padding-right: 1.5rem',
  'px-8':          'padding-left: 2rem; padding-right: 2rem',
  'px-12':         'padding-left: 3rem; padding-right: 3rem',

  'py-1':          'padding-top: 0.25rem; padding-bottom: 0.25rem',
  'py-2':          'padding-top: 0.5rem; padding-bottom: 0.5rem',
  'py-3':          'padding-top: 0.75rem; padding-bottom: 0.75rem',
  'py-4':          'padding-top: 1rem; padding-bottom: 1rem',
  'py-6':          'padding-top: 1.5rem; padding-bottom: 1.5rem',
  'py-8':          'padding-top: 2rem; padding-bottom: 2rem',
  'py-12':         'padding-top: 3rem; padding-bottom: 3rem',
  'py-24':         'padding-top: 6rem; padding-bottom: 6rem',

  'p-1':           'padding: 0.25rem',
  'p-1.5':         'padding: 0.375rem',
  'p-5':           'padding: 1.25rem',
  'p-6':           'padding: 1.5rem',
  'p-8':           'padding: 2rem',

  'pt-12':         'padding-top: 3rem',
  'pt-20':         'padding-top: 5rem',
  'pb-12':         'padding-bottom: 3rem',
  'pb-16':         'padding-bottom: 4rem',

  // Spacing: Gap ─────────────────────────────────────────────────────────────
  'gap-1':         'gap: 0.25rem',
  'gap-2':         'gap: 0.5rem',
  'gap-3':         'gap: 0.75rem',
  'gap-4':         'gap: 1rem',
  'gap-6':         'gap: 1.5rem',
  'gap-8':         'gap: 2rem',
  'gap-12':        'gap: 3rem',
  'gap-16':        'gap: 4rem',

  'gap-x-2':       'column-gap: 0.5rem',
  'gap-x-3':       'column-gap: 0.75rem',

  'space-y-4':     'margin-top: 1rem',
  'space-y-6':     'margin-top: 1.5rem',

  // Spacing: Inset ───────────────────────────────────────────────────────────
  'top-0':         'top: 0',
  'top-10':        'top: 2.5rem',
  'top-20':        'top: 5rem',

  'bottom-5':      'bottom: 1.25rem',
  'bottom-10':     'bottom: 2.5rem',

  'right-0':       'right: 0',
  'right-5':       'right: 1.25rem',
  'right-10':      'right: 2.5rem',
  'right-20':      'right: 5rem',

  'left-0':        'left: 0',
  'left-5':        'left: 1.25rem',
  'left-10':       'left: 2.5rem',

  'inset-0':       'top: 0; right: 0; bottom: 0; left: 0',

  // Display ─────────────────────────────────────────────────────────────────
  'flex':          'display: flex',
  'inline-flex':   'display: inline-flex',
  'grid':          'display: grid',
  'contents':      'display: contents',

  'block':         'display: block',
  'hidden':        'display: none',
  'inline':        'display: inline',
  'inline-block':  'display: inline-block',

  // Flexbox ─────────────────────────────────────────────────────────────────
  'flex-col':        'flex-direction: column',
  'flex-col-reverse':'flex-direction: column-reverse',
  'flex-row':        'flex-direction: row',
  'flex-wrap':       'flex-wrap: wrap',
  'flex-1':          'flex: 1 1 0%',
  'flex-shrink-0':    'flex-shrink: 0',
  'flex-grow':       'flex-grow: 1',
  'flex-grow-0':     'flex-grow: 0',

  'justify-center':   'justify-content: center',
  'justify-between':  'justify-content: space-between',
  'justify-start':    'justify-content: flex-start',
  'justify-end':     'justify-content: flex-end',

  'items-center':     'align-items: center',
  'items-start':      'align-items: flex-start',
  'items-baseline':   'align-items: baseline',
  'items-end':       'align-items: flex-end',

  'justify-items-center': 'justify-items: center',
  'place-items-center':   'place-items: center',

  // Grid ────────────────────────────────────────────────────────────────────
  'grid-cols-1':   'grid-template-columns: repeat(1, minmax(0, 1fr))',
  'grid-cols-2':   'grid-template-columns: repeat(2, minmax(0, 1fr))',

  // Positioning ─────────────────────────────────────────────────────────────
  'absolute':       'position: absolute',
  'relative':      'position: relative',
  'sticky':        'position: sticky',
  'fixed':         'position: fixed',

  'overflow-hidden': 'overflow: hidden',
  'z-10':          'z-index: 10',
  'z-50':          'z-index: 50',

  // Typography ───────────────────────────────────────────────────────────────
  'text-xs':        'font-size: 0.75rem; line-height: 1rem',
  'text-sm':        'font-size: 0.875rem; line-height: 1.25rem',
  'text-base':      'font-size: 1rem; line-height: 1.5rem',
  'text-lg':        'font-size: 1.125rem; line-height: 1.75rem',
  'text-xl':        'font-size: 1.25rem; line-height: 1.75rem',
  'text-2xl':       'font-size: 1.5rem; line-height: 2rem',
  'text-3xl':       'font-size: 1.875rem; line-height: 2.25rem',
  'text-4xl':       'font-size: 2.25rem; line-height: 2.5rem',
  'text-5xl':       'font-size: 3rem; line-height: 1',
  'text-6xl':       'font-size: 3.75rem; line-height: 1',

  'font-sans':      'font-family: ui-sans-serif, system-ui, sans-serif',
  'font-medium':    'font-weight: 500',
  'font-semibold':  'font-weight: 600',
  'font-bold':      'font-weight: 700',

  'leading-tight':   'line-height: 1.25',
  'leading-relaxed': 'line-height: 1.625',
  // Arbitrary value used in HTML: leading-[1.1]
  'leading-[1.1]':   'line-height: 1.1',

  'text-left':     'text-align: left',
  'text-center':   'text-align: center',
  'text-right':    'text-align: right',

  'tracking-tight':  'letter-spacing: -0.025em',
  'uppercase':       'text-transform: uppercase',
  'font-variant-numeric': 'font-variant-numeric: tabular-nums',

  // Text colors ─────────────────────────────────────────────────────────────
  'text-white':      'color: #ffffff',
  'text-stone-50':   'color: #fafaf9',
  'text-stone-300':  'color: #d6d3d1',
  'text-stone-400':  'color: #a8a29e',
  'text-stone-500':  'color: #78716c',
  'text-stone-600':  'color: #57534e',
  'text-stone-700':  'color: #44403c',
  'text-stone-800':  'color: #292524',
  'text-stone-900':  'color: #1c1917',
  'text-emerald-200':'color: #a7f3d0',
  'text-emerald-300':'color: #6ee7b7',
  'text-emerald-500':'color: #10b981',
  'text-emerald-600':'color: #059669',
  'text-emerald-700':'color: #047857',
  'text-yellow-200': 'color: #fde68a',
  'text-yellow-400': 'color: #facc15',
  'text-red-400':    'color: #f87171',
  'text-red-500':    'color: #ef4444',
  'text-red-600':    'color: #dc2626',
  'text-gray-50':    'color: #f9fafb',
  'text-gray-600':   'color: #4b5563',
  'text-gray-700':   'color: #374151',
  'text-zinc-50':    'color: #fafafa',
  'text-zinc-900':   'color: #18181b',
  'text-zinc-950':   'color: #09090b',
  'text-blue-600':   'color: #2563eb',
  'text-purple-600': 'color: #9333ea',

  // Background colors ───────────────────────────────────────────────────────
  'bg-white':       'background-color: #ffffff',
  'bg-stone-50':    'background-color: #fafaf9',
  'bg-stone-100':   'background-color: #f5f5f4',
  'bg-stone-200':   'background-color: #e7e5e4',
  'bg-stone-700':   'background-color: #44403c',
  'bg-stone-800':   'background-color: #292524',
  'bg-stone-900':   'background-color: #1c1917',
  'bg-stone-950':   'background-color: #0c0a09',
  'bg-zinc-50':     'background-color: #fafafa',
  'bg-zinc-900':    'background-color: #18181b',
  'bg-zinc-950':    'background-color: #09090b',
  'bg-emerald-100': 'background-color: #d1fae5',
  'bg-emerald-300': 'background-color: #6ee7b7',
  'bg-emerald-500': 'background-color: #10b981',
  'bg-emerald-600': 'background-color: #059669',
  'bg-emerald-700': 'background-color: #047857',
  'bg-red-500':     'background-color: #ef4444',
  'bg-blue-100':    'background-color: #dbeafe',
  'bg-purple-100':  'background-color: #f3e8ff',

  // Background gradients ────────────────────────────────────────────────────
  'bg-gradient-to-br': 'background-image: linear-gradient(to bottom right, var(--tw-gradient-stops))',
  'bg-gradient-to-r':   'background-image: linear-gradient(to right, var(--tw-gradient-stops))',
  'bg-gradient-to-t':   'background-image: linear-gradient(to top, var(--tw-gradient-stops))',

  // Gradient color stops ─────────────────────────────────────────────────────
  'from-emerald-500':   '--tw-gradient-from: #10b981; --tw-gradient-to: #10b981',
  'from-emerald-600':   '--tw-gradient-from: #059669; --tw-gradient-to: #059669',
  'from-emerald-700':   '--tw-gradient-from: #047857; --tw-gradient-to: #047857',
  'from-teal-600':      '--tw-gradient-from: #0d9488; --tw-gradient-to: #0d9488',
  'from-stone-800':     '--tw-gradient-from: #292524; --tw-gradient-to: #292524',
  'from-stone-900':     '--tw-gradient-from: #1c1917; --tw-gradient-to: #1c1917',

  'via-emerald-100':    '--tw-gradient-to: #d1fae5',
  'via-emerald-300/20': '--tw-gradient-to: rgba(110, 231, 183, 0.2)',
  'via-emerald-500/25': '--tw-gradient-to: rgba(16, 185, 129, 0.25)',
  'via-red-500':        '--tw-gradient-to: #ef4444',

  'to-emerald-300':   '--tw-gradient-to: #a7f3d0',
  'to-emerald-400':   '--tw-gradient-to: #34d399',
  'to-emerald-500':   '--tw-gradient-to: #10b981',
  'to-emerald-600':   '--tw-gradient-to: #059669',
  'to-emerald-700':   '--tw-gradient-to: #047857',
  'to-teal-600':      '--tw-gradient-to: #0d9488',
  'to-stone-800':     '--tw-gradient-to: #292524',
  'to-stone-900':     '--tw-gradient-to: #1c1917',
  'to-stone-950':     '--tw-gradient-to: #0c0a09',

  // Opacity-modified backgrounds (e.g. bg-white/80) ────────────────────────
  'bg-white/10':   'background-color: rgba(255, 255, 255, 0.1)',
  'bg-white/15':   'background-color: rgba(255, 255, 255, 0.15)',
  'bg-white/20':   'background-color: rgba(255, 255, 255, 0.2)',
  'bg-white/40':   'background-color: rgba(255, 255, 255, 0.4)',
  'bg-white/80':   'background-color: rgba(255, 255, 255, 0.8)',
  'bg-white/90':   'background-color: rgba(255, 255, 255, 0.9)',
  'bg-black/10':   'background-color: rgba(0, 0, 0, 0.1)',
  'bg-red-500/90': 'background-color: rgba(239, 68, 68, 0.9)',
  'bg-emerald-300/20': 'background-color: rgba(110, 231, 183, 0.2)',
  'bg-emerald-100/20': 'background-color: rgba(209, 250, 229, 0.2)',

  // Text with opacity ───────────────────────────────────────────────────────
  'text-white/40':  'color: rgba(255, 255, 255, 0.4)',
  'text-white/80':  'color: rgba(255, 255, 255, 0.8)',

  // Borders ─────────────────────────────────────────────────────────────────
  'border':          'border-width: 1px; border-style: solid',
  'border-b':        'border-bottom-width: 1px; border-bottom-style: solid',
  'border-4':        'border-width: 4px',

  'border-stone-100': 'border-color: #f5f5f4',
  'border-stone-200': 'border-color: #e7e5e4',
  'border-stone-700': 'border-color: #44403c',
  'border-emerald-200': 'border-color: #a7f3d0',
  'border-red-300':   'border-color: #fecaca',
  'border-white/20': 'border-color: rgba(255, 255, 255, 0.2)',

  'rounded':          'border-radius: 0.25rem',
  'rounded-lg':       'border-radius: 0.5rem',
  'rounded-xl':       'border-radius: 0.75rem',
  'rounded-2xl':      'border-radius: 1rem',
  'rounded-full':     'border-radius: 9999px',
  'rounded-t-3xl':    'border-top-left-radius: 1.5rem; border-top-right-radius: 1.5rem',

  // Shadows ─────────────────────────────────────────────────────────────────
  'shadow-sm':     'box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  'shadow-lg':     'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  'shadow-xl':     'box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  'shadow-2xl':   'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  'shadow-red-500/50': 'box-shadow: 0 25px 50px -12px rgba(239, 68, 68, 0.5)',
  'shadow-emerald-600/20': 'box-shadow: 0 20px 25px -5px rgba(5, 150, 105, 0.2)',
  'shadow-emerald-500/20': 'box-shadow: 0 20px 25px -5px rgba(16, 185, 129, 0.2)',
  'shadow-emerald-500/40': 'box-shadow: 0 20px 40px -10px rgba(16, 185, 129, 0.4)',
  'shadow-emerald-600/50': 'box-shadow: 0 25px 50px -12px rgba(5, 150, 105, 0.5)',

  // Effects ─────────────────────────────────────────────────────────────────
  'backdrop-blur-md':  'backdrop-filter: blur(12px)',
  'backdrop-blur-lg':  'backdrop-filter: blur(16px)',
  'backdrop-blur-xl':  'backdrop-filter: blur(24px)',
  'backdrop-blur-2xl': 'backdrop-filter: blur(40px)',
  'backdrop-blur-3xl': 'backdrop-filter: blur(64px)',

  'opacity-0':    'opacity: 0',
  'opacity-20':   'opacity: 0.2',
  'opacity-50':   'opacity: 0.5',
  'opacity-75':   'opacity: 0.75',
  'opacity-90':   'opacity: 0.9',
  'opacity-100':  'opacity: 1',

  'mix-blend-multiply': 'mix-blend-mode: multiply',

  // Filters ─────────────────────────────────────────────────────────────────
  'blur-2xl':    'filter: blur(40px)',
  'blur-3xl':    'filter: blur(64px)',
  'grayscale':   'filter: grayscale(100%)',
  'saturate':    'filter: saturate(100%)',

  // Animation ────────────────────────────────────────────────────────────────
  'animate-pulse':  'animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  'animate-bounce': 'animation: bounce 1s infinite',

  'transition':     'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms',
  'transition-all': 'transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms',
  'duration-200':  'transition-duration: 200ms',
  'duration-300':  'transition-duration: 300ms',

  // Hover states ─────────────────────────────────────────────────────────────
  'hover:bg-stone-100':      'background-color: #f5f5f4',
  'hover:bg-stone-200':      'background-color: #e7e5e4',
  'hover:bg-red-500':        'background-color: #ef4444',
  'hover:bg-opacity-90':     '--tw-bg-opacity: 0.9',
  'hover:text-emerald-600':  'color: #059669',
  'hover:text-stone-600':    'color: #57534e',
  'hover:underline':          'text-decoration: underline',
  'hover:opacity-90':        'opacity: 0.9',
  'hover:shadow-lg':          'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  'hover:shadow-2xl':         'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25)',

  // Active states ─────────────────────────────────────────────────────────────
  'active:translate-y-0': 'transform: translateY(0)',
  'active:scale-95':     'transform: scale(0.95)',
  'active:scale-98':     'transform: scale(0.98)',

  // Focus / disabled ─────────────────────────────────────────────────────────
  'focus:outline-none':           'outline: none',
  'disabled:opacity-50':           'opacity: 0.5; cursor: not-allowed',
  'disabled:cursor-not-allowed':   'cursor: not-allowed',

  // Miscellaneous ────────────────────────────────────────────────────────────
  'cursor-pointer':      'cursor: pointer',
  'cursor-not-allowed': 'cursor: not-allowed',
  'pointer-events-none': 'pointer-events: none',
  'pointer-events-auto': 'pointer-events: auto',
  'object-cover':        'object-fit: cover',
  'object-center':       'object-position: center',
  'select-none':        'user-select: none',
  'resize-none':         'resize: none',
  'appearance-none':    'appearance: none',
  'scroll-smooth':      'scroll-behavior: smooth',
  'fill-current':       'fill: currentColor',
  'stroke-current':     'stroke: currentColor',
};

// ─── Responsive breakpoint overrides (stored separately) ──────────────────────

const RESPONSIVE_MAP = {
  // sm: breakpoint (640px+)
  'sm:px-4':      { bp: 640, css: 'padding-left: 1rem; padding-right: 1rem' },
  'sm:px-6':      { bp: 640, css: 'padding-left: 1.5rem; padding-right: 1.5rem' },
  'sm:px-8':      { bp: 640, css: 'padding-left: 2rem; padding-right: 2rem' },
  'sm:px-0':      { bp: 640, css: 'padding-left: 0; padding-right: 0' },
  'sm:py-2':      { bp: 640, css: 'padding-top: 0.5rem; padding-bottom: 0.5rem' },
  'sm:py-3':      { bp: 640, css: 'padding-top: 0.75rem; padding-bottom: 0.75rem' },
  'sm:py-4':      { bp: 640, css: 'padding-top: 1rem; padding-bottom: 1rem' },
  'sm:py-12':     { bp: 640, css: 'padding-top: 3rem; padding-bottom: 3rem' },
  'sm:py-24':     { bp: 640, css: 'padding-top: 6rem; padding-bottom: 6rem' },
  'sm:p-6':       { bp: 640, css: 'padding: 1.5rem' },
  'sm:p-8':       { bp: 640, css: 'padding: 2rem' },
  'sm:pt-12':     { bp: 640, css: 'padding-top: 3rem' },
  'sm:pt-20':     { bp: 640, css: 'padding-top: 5rem' },
  'sm:pb-12':     { bp: 640, css: 'padding-bottom: 3rem' },
  'sm:pb-16':     { bp: 640, css: 'padding-bottom: 4rem' },
  'sm:mb-4':      { bp: 640, css: 'margin-bottom: 1rem' },
  'sm:mb-6':      { bp: 640, css: 'margin-bottom: 1.5rem' },
  'sm:mb-8':      { bp: 640, css: 'margin-bottom: 2rem' },
  'sm:mb-12':     { bp: 640, css: 'margin-bottom: 3rem' },
  'sm:mb-16':     { bp: 640, css: 'margin-bottom: 4rem' },
  'sm:mt-0':      { bp: 640, css: 'margin-top: 0' },
  'sm:mt-8':      { bp: 640, css: 'margin-top: 2rem' },
  'sm:gap-4':     { bp: 640, css: 'gap: 1rem' },
  'sm:gap-6':     { bp: 640, css: 'gap: 1.5rem' },
  'sm:gap-8':     { bp: 640, css: 'gap: 2rem' },
  'sm:gap-x-3':   { bp: 640, css: 'column-gap: 0.75rem' },
  'sm:w-10':      { bp: 640, css: 'width: 2.5rem' },
  'sm:h-10':      { bp: 640, css: 'height: 2.5rem' },
  'sm:w-72':      { bp: 640, css: 'width: 18rem' },
  'sm:h-72':      { bp: 640, css: 'height: 18rem' },
  'sm:w-96':      { bp: 640, css: 'width: 24rem' },
  'sm:h-96':      { bp: 640, css: 'height: 24rem' },
  'sm:w-auto':    { bp: 640, css: 'width: auto' },
  'sm:top-20':    { bp: 640, css: 'top: 5rem' },
  'sm:left-10':   { bp: 640, css: 'left: 2.5rem' },
  'sm:bottom-10': { bp: 640, css: 'bottom: 2.5rem' },
  'sm:right-20':  { bp: 640, css: 'right: 5rem' },
  'sm:blur-3xl':  { bp: 640, css: 'filter: blur(64px)' },
  'sm:rounded-xl':  { bp: 640, css: 'border-radius: 0.75rem' },
  'sm:rounded-2xl': { bp: 640, css: 'border-radius: 1rem' },
  'sm:grid-cols-2': { bp: 640, css: 'grid-template-columns: repeat(2, minmax(0, 1fr))' },
  'sm:inline':    { bp: 640, css: 'display: inline' },
  'sm:hidden':    { bp: 640, css: 'display: none' },
  'sm:text-xs':   { bp: 640, css: 'font-size: 0.75rem; line-height: 1rem' },
  'sm:text-sm':   { bp: 640, css: 'font-size: 0.875rem; line-height: 1.25rem' },
  'sm:text-base': { bp: 640, css: 'font-size: 1rem; line-height: 1.5rem' },
  'sm:text-lg':   { bp: 640, css: 'font-size: 1.125rem; line-height: 1.75rem' },
  'sm:text-xl':   { bp: 640, css: 'font-size: 1.25rem; line-height: 1.75rem' },
  'sm:text-2xl':  { bp: 640, css: 'font-size: 1.5rem; line-height: 2rem' },
  'sm:text-3xl':  { bp: 640, css: 'font-size: 1.875rem; line-height: 2.25rem' },
  'sm:text-4xl':  { bp: 640, css: 'font-size: 2.25rem; line-height: 2.5rem' },
  // md: breakpoint (768px+)
  'md:grid-cols-2': { bp: 768, css: 'grid-template-columns: repeat(2, minmax(0, 1fr))' },
  'md:grid-cols-3': { bp: 768, css: 'grid-template-columns: repeat(3, minmax(0, 1fr))' },
  'md:grid-cols-4': { bp: 768, css: 'grid-template-columns: repeat(4, minmax(0, 1fr))' },
  'md:text-left':  { bp: 768, css: 'text-align: left' },
  'md:text-xl':    { bp: 768, css: 'font-size: 1.25rem; line-height: 1.75rem' },
  'md:text-2xl':   { bp: 768, css: 'font-size: 1.5rem; line-height: 2rem' },
  'md:text-3xl':   { bp: 768, css: 'font-size: 1.875rem; line-height: 2.25rem' },
  'md:text-4xl':   { bp: 768, css: 'font-size: 2.25rem; line-height: 2.5rem' },
  'md:text-5xl':   { bp: 768, css: 'font-size: 3rem; line-height: 1' },
  'md:text-lg':    { bp: 768, css: 'font-size: 1.125rem; line-height: 1.75rem' },
  'md:mt-0':       { bp: 768, css: 'margin-top: 0' },
  'md:gap-12':     { bp: 768, css: 'gap: 3rem' },
  'md:gap-16':     { bp: 768, css: 'gap: 4rem' },
  // lg: breakpoint (1024px+)
  'lg:text-3xl':   { bp: 1024, css: 'font-size: 1.875rem; line-height: 2.25rem' },
  'lg:text-4xl':   { bp: 1024, css: 'font-size: 2.25rem; line-height: 2.5rem' },
  'lg:text-5xl':   { bp: 1024, css: 'font-size: 3rem; line-height: 1' },
  'lg:text-6xl':   { bp: 1024, css: 'font-size: 3.75rem; line-height: 1' },
  'lg:text-xl':    { bp: 1024, css: 'font-size: 1.25rem; line-height: 1.75rem' },
  'lg:w-64':       { bp: 1024, css: 'width: 16rem' },
};

// ─── Extract class names from HTML ───────────────────────────────────────────

function extractClasses(html) {
  const classSet = new Set();
  const attrRegex = /class=["']([^"']+)["']/g;
  let match;
  while ((match = attrRegex.exec(html)) !== null) {
    match[1].split(/\s+/).filter(Boolean).forEach(c => classSet.add(c));
  }
  return classSet;
}

// ─── Extract the <style> block content ───────────────────────────────────────

function extractStyleBlock(html) {
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
}

// ─── Build the CSS output ─────────────────────────────────────────────────────

function buildCSS(classes) {
  const lines = [];
  const seen = new Set(); // deduplicate

  lines.push('/* ============================================================');
  lines.push('   tailwind-utilities.css');
  lines.push('   Auto-generated by build-utilities.js');
  lines.push('   Contains ONLY the Tailwind utility classes used in index.html');
  lines.push('   Plus custom classes extracted from the HTML <style> block.');
  lines.push('   ============================================================ */');
  lines.push('');

  // 1. Separate base vs responsive classes
  const baseClasses = [];
  const responsiveClasses = [];

  classes.forEach(cls => {
    if (cls.startsWith('sm:') || cls.startsWith('md:') || cls.startsWith('lg:')) {
      responsiveClasses.push(cls);
    } else {
      baseClasses.push(cls);
    }
  });

  // 2. Output base (non-responsive) rules — skip FontAwesome and other non-TW classes
  lines.push('/* ── Base utility classes ── */');
  baseClasses.forEach(cls => {
    const skip = cls.startsWith('fa-') || cls === 'heading' ||
                 cls === 'btn-primary' || cls === 'btn-glow' ||
                 cls === 'hero-bg' || cls === 'snap-card' ||
                 cls === 'countdown' || cls === 'gradient-text' ||
                 cls === 'success-checkmark' || cls === 'bounce-subtle';
    if (skip) return;

    // Handle opacity-modified colors (e.g. bg-white/80)
    if (cls.includes('/')) {
      const css = MAP[cls];
      if (css) {
        lines.push(`.${cls} { ${css} }`);
        seen.add(cls);
      }
      return;
    }

    const css = MAP[cls];
    if (css) {
      lines.push(`.${cls} { ${css} }`);
      seen.add(cls);
    } else {
      lines.push(`/* WARN: unmapped: ${cls} */`);
    }
  });

  lines.push('');

  // 3. Responsive rules — grouped by breakpoint
  const sm = responsiveClasses.filter(c => c.startsWith('sm:'));
  const md = responsiveClasses.filter(c => c.startsWith('md:'));
  const lg = responsiveClasses.filter(c => c.startsWith('lg:'));

  const emitResponsive = (cls, bp, css) => {
    lines.push(`@media (min-width: ${bp}px) {`);
    lines.push(`  .${cls} { ${css} }`);
    lines.push('}');
  };

  if (sm.length > 0) {
    lines.push('/* ── sm: breakpoint (640px+) ── */');
    sm.forEach(cls => {
      const entry = RESPONSIVE_MAP[cls];
      if (entry) emitResponsive(cls, entry.bp, entry.css);
    });
    lines.push('');
  }

  if (md.length > 0) {
    lines.push('/* ── md: breakpoint (768px+) ── */');
    md.forEach(cls => {
      const entry = RESPONSIVE_MAP[cls];
      if (entry) emitResponsive(cls, entry.bp, entry.css);
    });
    lines.push('');
  }

  if (lg.length > 0) {
    lines.push('/* ── lg: breakpoint (1024px+) ── */');
    lg.forEach(cls => {
      const entry = RESPONSIVE_MAP[cls];
      if (entry) emitResponsive(cls, entry.bp, entry.css);
    });
    lines.push('');
  }

  // 4. Tailwind keyframe animations
  lines.push('/* ── Tailwind keyframe animations ── */');
  lines.push('@keyframes pulse {');
  lines.push('  0%, 100% { opacity: 1; }');
  lines.push('  50% { opacity: 0.5; }');
  lines.push('}');
  lines.push('');
  lines.push('@keyframes bounce {');
  lines.push('  0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }');
  lines.push('  50% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`Reading: ${HTML_PATH}`);
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  const classes = extractClasses(html);
  console.log(`Found ${classes.size} unique class names`);

  // Show unmapped classes for inspection
  const unmapped = [];
  classes.forEach(cls => {
    const skip = cls.startsWith('fa-') || cls === 'heading' ||
                 cls === 'btn-primary' || cls === 'btn-glow' ||
                 cls === 'hero-bg' || cls === 'snap-card' ||
                 cls === 'countdown' || cls === 'gradient-text' ||
                 cls === 'success-checkmark' || cls === 'bounce-subtle' ||
                 cls.startsWith('sm:') || cls.startsWith('md:') || cls.startsWith('lg:') ||
                 cls.includes('/');
    if (!skip && !MAP[cls]) {
      unmapped.push(cls);
    }
  });
  if (unmapped.length > 0) {
    console.log(`Unmapped classes (no TW CSS equivalent needed): ${unmapped.join(', ')}`);
  }

  const baseCSS = buildCSS(classes);
  const customCSS = extractStyleBlock(html);

  const output = baseCSS +
    '/* ── Custom classes from HTML <style> block ── */\n' +
    customCSS.trim() + '\n';

  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
  console.log(`Written: ${OUTPUT_PATH}  (${output.length} bytes)`);
}

main();
