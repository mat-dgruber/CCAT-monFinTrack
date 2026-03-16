import {
  trigger,
  transition,
  style,
  query,
  animate,
  group,
} from '@angular/animations';

// Função auxiliar para o Slide
const slideTo = (direction: 'left' | 'right') => {
  const offset = direction === 'left' ? '100%' : '-100%';
  return [
    style({ position: 'relative' }),
    query(':enter, :leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
      })
    ], { optional: true }),
    query(':enter', [
      style({ left: offset, opacity: 0 })
    ], { optional: true }),
    group([
      query(':leave', [
        animate('300ms ease-out', style({ left: direction === 'left' ? '-100%' : '100%', opacity: 0 }))
      ], { optional: true }),
      query(':enter', [
        animate('300ms ease-out', style({ left: '0%', opacity: 1 }))
      ], { optional: true }),
    ]),
  ];
};

export const routeTransitionAnimations = trigger('triggerName', [
  // Transição baseada em números (Slide Lateral)
  transition(':increment', slideTo('left')),
  transition(':decrement', slideTo('right')),

  // Transição padrão para outras rotas (Fade/Zoom)
  transition('* <=> *', [
    style({ position: 'relative' }),
    query(':enter, :leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        opacity: 0
      })
    ], { optional: true }),
    query(':enter', [
      style({ opacity: 0, transform: 'scale(0.98)' })
    ], { optional: true }),
    group([
      query(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'scale(1.02)' }))
      ], { optional: true }),
      query(':enter', [
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ], { optional: true }),
    ]),
  ]),
]);
