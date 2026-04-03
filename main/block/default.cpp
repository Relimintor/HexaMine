#include <array>
#include <cmath>
#include <cstdint>

namespace hexamine::block {

struct AxialCoord {
  int q;
  int r;
};

struct PlanetTopology {
  uint32_t subdivision_level;
  uint32_t frequency;
  uint32_t triangle_faces;
  uint32_t total_cells;
  uint32_t pentagon_cells;
  uint32_t hexagon_cells;
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

PlanetTopology BuildIcosahedralHexSphere(uint32_t subdivision_level) {
  const uint32_t frequency = 1u << subdivision_level;
  const uint32_t triangle_faces = 20u * frequency * frequency;
  const uint32_t total_cells = 10u * frequency * frequency + 2u;
  const uint32_t pentagon_cells = 12u;
  const uint32_t hexagon_cells = total_cells > pentagon_cells ? total_cells - pentagon_cells : 0u;

  return PlanetTopology{
      subdivision_level,
      frequency,
      triangle_faces,
      total_cells,
      pentagon_cells,
      hexagon_cells,
  };
}

}  // namespace hexamine::block
