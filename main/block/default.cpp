#include <array>
#include <cmath>
#include <cstdint>

namespace hexamine::block {

struct AxialCoord {
  int q;
  int r;
};

static constexpr std::array<AxialCoord, 6> kNeighbors = {
    AxialCoord{1, 0}, AxialCoord{1, -1}, AxialCoord{0, -1},
    AxialCoord{-1, 0}, AxialCoord{-1, 1}, AxialCoord{0, 1},
};

int HexDistance(const AxialCoord& a, const AxialCoord& b) {
  const int dq = a.q - b.q;
  const int dr = a.r - b.r;
  const int ds = (-a.q - a.r) - (-b.q - b.r);
  return (std::abs(dq) + std::abs(dr) + std::abs(ds)) / 2;
}

bool IsNeighbor(const AxialCoord& center, const AxialCoord& other) {
  for (const auto& offset : kNeighbors) {
    if (center.q + offset.q == other.q && center.r + offset.r == other.r) {
      return true;
    }
  }
  return false;
}

}  // namespace hexamine::block
