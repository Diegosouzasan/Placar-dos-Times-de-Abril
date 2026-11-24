import type { ReactNode } from 'react'

export function ScoreboardTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-[clamp(1.5rem,6vh,4rem)] tracking-tighter uppercase font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200 drop-shadow-[0_2px_10px_rgba(16,185,129,0.3)] leading-none text-center">{children}</h1>
}

export function ScoreboardLogo() {
  return <img src="/img/Logo Nosso Consignado.png" alt="Nosso Consignado" className="h-5 lg:h-8 object-contain opacity-70 drop-shadow-sm mix-blend-screen" />
}

export function TeamCrest({ name, className }: { name: string; className: string }) {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const knownName = ['Patroas', 'Aguias', 'Tropa de Elite'].find(crest => normalized.includes(crest.toLowerCase()))
  const path = '/img/Logos/Logo ' + (knownName ?? name) + '.png'
  return <img key={path} src={path} alt={'Escudo ' + name} className={className}
    onError={event => {
      const image = event.currentTarget
      if (image.getAttribute('src') === path) image.src = '/img/LOGO ' + name + '.png'
      else image.hidden = true
    }} />
}
