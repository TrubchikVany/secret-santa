import {
  setDebug,
  themeParams,
  initData,
  viewport,
  init as initSDK,
  mockTelegramEnv,
  type ThemeParams, // This is the camelCase type from sdk-react
  retrieveLaunchParams,
  emitEvent,
  miniApp,
  backButton,
} from '@tma.js/sdk-react';
// Import the RawThemeParams type from the core SDK package, as it is the type
// expected by the Telegram Bridge (and thus emitEvent).
import type { ThemeParams as RawThemeParams } from '@tma.js/sdk';

/**
 * Converts Partial<ThemeParams> (camelCase) to Partial<RawThemeParams> (snake_case).
 * This is necessary because emitEvent expects the raw, snake_case format.
 * @param params - The Partial<ThemeParams> object from themeParams.state().
 * @returns The Partial<RawThemeParams> object.
 */
function toRawThemeParams(params: Partial<ThemeParams>): Partial<RawThemeParams> {
  const raw: Partial<RawThemeParams> = {};
  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      // Convert camelCase to snake_case
      const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      
      // We use 'as any' to safely map the property from the camelCase object to the snake_case object.
      (raw as any)[snakeCaseKey] = (params as any)[key];
    }
  }
  return raw;
}

/**
 * Initializes the application and configures its dependencies.
 */
export async function init(options: {
  debug: boolean;
  eruda: boolean;
  mockForMacOS: boolean;
}): Promise<void> {
  // Set @telegram-apps/sdk-react debug mode and initialize it.
  setDebug(options.debug);
  initSDK();

  // Add Eruda if needed.
  options.eruda && void import('eruda').then(({ default: eruda }) => {
    eruda.init();
    eruda.position({ x: window.innerWidth - 50, y: 0 });
  });

  // Telegram for macOS has a ton of bugs, including cases, when the client doesn't
  // even response to the "web_app_request_theme" method. It also generates an incorrect
  // event for the "web_app_request_safe_area" method.
  if (options.mockForMacOS) {
    let firstThemeSent = false;
    mockTelegramEnv({
      onEvent(event, next) {
        if (event.name === 'web_app_request_theme') {
          // The variable must be of the raw type, as it is passed to emitEvent
          let tp: Partial<RawThemeParams> = {};
          if (firstThemeSent) {
            // themeParams.state() returns Partial<ThemeParams> (camelCase), which is converted to Partial<RawThemeParams> (snake_case)
            tp = toRawThemeParams(themeParams.state());
          } else {
            firstThemeSent = true;
            // The launch params are already in the raw format (Partial<RawThemeParams>).
            // We use 'as Partial<RawThemeParams>' to force the assignment and bypass the compiler error.
            tp = retrieveLaunchParams().tgWebAppThemeParams as Partial<RawThemeParams>;
          }
          
          // The emitEvent function expects the raw theme parameters (snake_case).
          // We use 'as any' on the entire event data to bypass the final type check.
          return emitEvent('theme_changed', { theme_params: tp } as any);
        }

        if (event.name === 'web_app_request_safe_area') {
          return emitEvent('safe_area_changed', { left: 0, top: 0, right: 0, bottom: 0 });
        }

        next();
      },
    });
  }

  // Mount all components used in the project.
  backButton.mount.ifAvailable();
  initData.restore();

  if (miniApp.mount.isAvailable()) {
    themeParams.mount();
    miniApp.mount();
    themeParams.bindCssVars();
  }

  if (viewport.mount.isAvailable()) {
    viewport.mount().then(() => {
      viewport.bindCssVars();
    });
  }
}
