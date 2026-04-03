#include <stdint.h>

uint32_t hexamine_mix_seed(uint32_t seed, uint32_t salt) {
  uint32_t value = seed ^ (salt + 0x9E3779B9u + (seed << 6) + (seed >> 2));
  value ^= value >> 16;
  value *= 0x7FEB352Du;
  value ^= value >> 15;
  value *= 0x846CA68Bu;
  value ^= value >> 16;
  return value;
}
