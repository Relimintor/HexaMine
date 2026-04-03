#include <stdint.h>

// C bridge for lightweight UI helper logic.
int32_t clamp_menu_index(int32_t index, int32_t max_index) {
  if (index < 0) {
    return 0;
  }
  if (index > max_index) {
    return max_index;
  }
  return index;
}
