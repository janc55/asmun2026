'use client';

import React, { useState } from 'react';
import { cn } from '../../lib/cn';

/**
 * Logo del colegio con respaldo.
 *
 * La imagen se lee de `/logo-asmun.png`, es decir
 * `apps/web/public/logo-asmun.png`. Mientras el archivo no exista —o si falla
 * la carga— se muestra el monograma institucional, así la interfaz nunca queda
 * sin marca ni con una imagen rota.
 *
 * En fondos oscuros (barra superior, pantalla de acceso) conviene envolverlo en
 * una placa blanca: así funciona tanto un logo oscuro como uno claro.
 * Se usa `<img>` y no `next/image` porque el archivo es opcional y necesitamos
 * el evento de error para el respaldo.
 */
export interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  /** Lado del monograma de respaldo. */
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { box: 'w-8 h-8 text-sm rounded-lg', image: 'h-8' },
  md: { box: 'w-11 h-11 text-lg rounded-xl', image: 'h-11' },
  lg: { box: 'w-16 h-16 text-2xl rounded-2xl', image: 'h-16' },
} as const;

export function BrandLogo({ className, imageClassName, size = 'md' }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const dimension = SIZES[size];

  if (!failed) {
    return (
      <img
        src="/logo-asmun.png"
        alt="Colegio Americano de Oruro"
        onError={() => setFailed(true)}
        className={cn('w-auto object-contain', dimension.image, imageClassName, className)}
      />
    );
  }

  return (
    <div
      aria-label="Colegio Americano de Oruro"
      className={cn(
        'flex items-center justify-center font-bold bg-primary-600 text-white shadow-sm',
        dimension.box,
        className,
      )}
    >
      A
    </div>
  );
}
