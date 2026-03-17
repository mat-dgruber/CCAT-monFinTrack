import { Injectable, ApplicationRef, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { concat, interval } from 'rxjs';
import { first } from 'rxjs/operators';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root',
})
export class PwaService {
  private updates = inject(SwUpdate);
  private appRef = inject(ApplicationRef);
  private messageService = inject(MessageService);

  private deferredPrompt = signal<any>(null);
  private wakeLock: any = null;
  public isSafari = signal<boolean>(false);

  constructor() {
    this.checkForUpdates();
    this.initInstallPrompt();
  }

  // --- Update Flow ---
  private checkForUpdates() {
    if (!this.updates.isEnabled) return;

    // Allow the app to stabilize first, before starting polling for updates with `interval()`.
    const appIsStable$ = this.appRef.isStable.pipe(
      first((isStable) => isStable === true),
    );
    const everySixHours$ = interval(6 * 60 * 60 * 1000);
    const everySixHoursOnceAppIsStable$ = concat(appIsStable$, everySixHours$);

    everySixHoursOnceAppIsStable$.subscribe(async () => {
      try {
        const updateFound = await this.updates.checkForUpdate();
        if (updateFound) {
          this.showUpdateNotification();
        }
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    });

    this.updates.versionUpdates.subscribe((evt) => {
      if (evt.type === 'VERSION_READY') {
        this.showUpdateNotification();
      }
    });
  }

  private showUpdateNotification() {
    this.messageService.add({
      severity: 'info',
      summary: 'Nova versão disponível',
      detail: 'Atualize para ver as novidades!',
      key: 'pwa-update',
      sticky: true,
      data: {
        action: () => {
          this.updates.activateUpdate().then(() => document.location.reload());
        },
      },
    });
  }

  // --- Badging API ---
  async setAppBadge(count: number) {
    if ('setAppBadge' in navigator) {
      try {
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
        } else {
          await (navigator as any).clearAppBadge();
        }
      } catch (e) {
        console.error('Error setting app badge:', e);
      }
    }
  }

  // --- Screen Wake Lock API ---
  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock is active');
        this.wakeLock.addEventListener('release', () => {
          console.log('Wake Lock was released');
          this.wakeLock = null;
        });
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    }
  }

  async releaseWakeLock() {
    if (this.wakeLock !== null) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }

  // --- Install Flow ---
  private initInstallPrompt() {
    // Safari detection
    const isSafari =
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
      ((navigator as any).standalone !== undefined &&
        /iPad|iPhone|iPod/.test(navigator.userAgent));

    this.isSafari.set(isSafari);

    if (isSafari) {
      console.info(
        'PWA: Safari detected. Automatic install prompt not supported. Use "Share > Add to Home Screen".',
      );
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt.set(e);
      console.log('PWA: App install prompt intercepted', e);
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA: App was installed');
      this.deferredPrompt.set(null);
    });
  }

  async installApp() {
    const prompt = this.deferredPrompt();
    if (prompt) {
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        console.log(`PWA: User response to the install prompt: ${outcome}`);
        this.deferredPrompt.set(null);
      } catch (err) {
        console.error('PWA: Error during installation:', err);
      }
    } else {
      console.warn(
        'PWA: Install prompt not available. Check if browser supports beforeinstallprompt or if app is already installed.',
      );
    }
  }

  get isInstallable(): boolean {
    return !!this.deferredPrompt();
  }
}
