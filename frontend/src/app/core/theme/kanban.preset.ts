import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/**
 * Aura, adjusted to match the app's own styles (src/styles.scss):
 * - the accent is blue instead of Aura's emerald;
 * - filled buttons, tags and toast headings use darker shades. Aura's defaults put white text on
 *   green-500 or emerald-500 (about 2.3:1 and 2.5:1), below the 4.5:1 WCAG minimum for normal text.
 * Every pairing set here reaches at least 4.5:1 (3:1 for icons).
 */
export const KanbanPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{blue.50}',
      100: '{blue.100}',
      200: '{blue.200}',
      300: '{blue.300}',
      400: '{blue.400}',
      500: '{blue.500}',
      600: '{blue.600}',
      700: '{blue.700}',
      800: '{blue.800}',
      900: '{blue.900}',
      950: '{blue.950}'
    },
    colorScheme: {
      light: {
        // White on blue-600 is 5.2:1; on Aura's default shade (500) it is 3.7:1
        primary: {
          color: '{primary.600}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.700}',
          activeColor: '{primary.800}'
        },
        // Dropdown arrows and clear icons: slate-500 is 4.8:1 on white, Aura's slate-400 only 2.6:1
        formField: {
          iconColor: '{surface.500}'
        }
      }
    }
  },
  components: {
    button: {
      colorScheme: {
        light: {
          root: {
            success: {
              background: '{green.700}',
              hoverBackground: '{green.800}',
              activeBackground: '{green.900}',
              borderColor: '{green.700}',
              hoverBorderColor: '{green.800}',
              activeBorderColor: '{green.900}',
              focusRing: { color: '{green.700}' }
            },
            danger: {
              background: '{red.600}',
              hoverBackground: '{red.700}',
              activeBackground: '{red.800}',
              borderColor: '{red.600}',
              hoverBorderColor: '{red.700}',
              activeBorderColor: '{red.800}',
              focusRing: { color: '{red.600}' }
            }
          },
          outlined: {
            success: { color: '{green.700}' },
            danger: { color: '{red.600}' }
          },
          text: {
            success: { color: '{green.700}' },
            danger: { color: '{red.600}' }
          }
        }
      }
    },
    tag: {
      colorScheme: {
        light: {
          success: { color: '{green.800}' },
          warn: { color: '{orange.800}' }
        }
      }
    },
    toast: {
      colorScheme: {
        light: {
          info: { color: '{blue.700}' },
          success: { color: '{green.800}' },
          warn: { color: '{yellow.800}' },
          error: { color: '{red.700}' }
        }
      }
    }
  }
});
