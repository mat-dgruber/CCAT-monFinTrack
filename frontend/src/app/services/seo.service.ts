import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map, mergeMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private meta = inject(Meta);
  private title = inject(Title);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  constructor() {}

  /**
   * Inicia o monitoramento de rotas para atualizar meta tags automaticamente
   */
  initDynamicSeo() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.activatedRoute),
        map((route) => {
          while (route.firstChild) route = route.firstChild;
          return route;
        }),
        mergeMap((route) => route.data),
      )
      .subscribe((data) => {
        if (data) {
          this.updateSeoTags(data);
        }
      });
  }

  updateSeoTags(data: any) {
    const description =
      data['description'] ||
      'monFinTrack: Gerencie suas finanças pessoais de forma inteligente.';
    const title = data['title']
      ? `monFinTrack | ${data['title']}`
      : 'monFinTrack';

    // Standard Meta Tags
    this.meta.updateTag({ name: 'description', content: description });

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({
      property: 'og:url',
      content: `https://monfintrack.web.app${this.router.url}`,
    });
  }
}
