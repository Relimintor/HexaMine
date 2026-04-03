#include <cstdint>

extern "C" {

// Main menu/version logic owned by C++ and compiled to WebAssembly.
std::int32_t getMenuVersion() {
  return 1;
}

}
