#include <array>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

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

struct Vec3 {
  float x;
  float y;
  float z;
};

struct Triangle {
  uint32_t a;
  uint32_t b;
  uint32_t c;
};

struct Tile {
  Vec3 center;
  std::vector<uint32_t> neighbors;
  std::vector<Vec3> corners;
  bool is_pentagon;
};

static constexpr std::array<AxialCoord, 6> kNeighbors = {
    AxialCoord{1, 0}, AxialCoord{1, -1}, AxialCoord{0, -1},
    AxialCoord{-1, 0}, AxialCoord{-1, 1}, AxialCoord{0, 1},
};

static Vec3 Normalize(const Vec3& value, float radius = 1.0f) {
  const float len = std::sqrt(value.x * value.x + value.y * value.y + value.z * value.z);
  if (len <= 1e-7f) return Vec3{0, 1.0f * radius, 0};
  return Vec3{(value.x / len) * radius, (value.y / len) * radius, (value.z / len) * radius};
}

static float Dot(const Vec3& lhs, const Vec3& rhs) {
  return lhs.x * rhs.x + lhs.y * rhs.y + lhs.z * rhs.z;
}

static Vec3 Cross(const Vec3& lhs, const Vec3& rhs) {
  return Vec3{
      lhs.y * rhs.z - lhs.z * rhs.y,
      lhs.z * rhs.x - lhs.x * rhs.z,
      lhs.x * rhs.y - lhs.y * rhs.x,
  };
}

static std::pair<std::vector<Vec3>, std::vector<Triangle>> CreateIcosahedron() {
  const float phi = (1.0f + std::sqrt(5.0f)) * 0.5f;
  std::vector<Vec3> vertices = {
      {-1, phi, 0}, {1, phi, 0}, {-1, -phi, 0}, {1, -phi, 0},
      {0, -1, phi}, {0, 1, phi}, {0, -1, -phi}, {0, 1, -phi},
      {phi, 0, -1}, {phi, 0, 1}, {-phi, 0, -1}, {-phi, 0, 1},
  };
  for (auto& v : vertices) v = Normalize(v, 1.0f);

  std::vector<Triangle> faces = {
      {0, 11, 5}, {0, 5, 1}, {0, 1, 7}, {0, 7, 10}, {0, 10, 11},
      {1, 5, 9}, {5, 11, 4}, {11, 10, 2}, {10, 7, 6}, {7, 1, 8},
      {3, 9, 4}, {3, 4, 2}, {3, 2, 6}, {3, 6, 8}, {3, 8, 9},
      {4, 9, 5}, {2, 4, 11}, {6, 2, 10}, {8, 6, 7}, {9, 8, 1},
  };
  return {vertices, faces};
}

static std::pair<std::vector<Vec3>, std::vector<Triangle>> SubdivideIcosphere(uint32_t levels) {
  auto [vertices, faces] = CreateIcosahedron();

  for (uint32_t step = 0; step < levels; ++step) {
    std::vector<Triangle> next_faces;
    std::unordered_map<std::string, uint32_t> midpoint_cache;

    auto midpoint = [&](uint32_t a, uint32_t b) -> uint32_t {
      const uint32_t lo = std::min(a, b);
      const uint32_t hi = std::max(a, b);
      const std::string key = std::to_string(lo) + ":" + std::to_string(hi);
      const auto it = midpoint_cache.find(key);
      if (it != midpoint_cache.end()) return it->second;

      const Vec3 pa = vertices[a];
      const Vec3 pb = vertices[b];
      const uint32_t idx = static_cast<uint32_t>(vertices.size());
      vertices.push_back(Normalize(Vec3{(pa.x + pb.x) * 0.5f, (pa.y + pb.y) * 0.5f, (pa.z + pb.z) * 0.5f}, 1.0f));
      midpoint_cache[key] = idx;
      return idx;
    };

    for (const auto& face : faces) {
      const uint32_t ab = midpoint(face.a, face.b);
      const uint32_t bc = midpoint(face.b, face.c);
      const uint32_t ca = midpoint(face.c, face.a);
      next_faces.push_back({face.a, ab, ca});
      next_faces.push_back({face.b, bc, ab});
      next_faces.push_back({face.c, ca, bc});
      next_faces.push_back({ab, bc, ca});
    }
    faces = std::move(next_faces);
  }

  return {vertices, faces};
}

std::vector<Tile> BuildDualTiles(uint32_t subdivision_level) {
  const auto [vertices, faces] = SubdivideIcosphere(subdivision_level);

  std::vector<Vec3> triangle_nodes;
  triangle_nodes.reserve(faces.size());
  for (const auto& t : faces) {
    triangle_nodes.push_back(Normalize(Vec3{
        (vertices[t.a].x + vertices[t.b].x + vertices[t.c].x) / 3.0f,
        (vertices[t.a].y + vertices[t.b].y + vertices[t.c].y) / 3.0f,
        (vertices[t.a].z + vertices[t.b].z + vertices[t.c].z) / 3.0f,
    }, 1.0f));
  }

  std::unordered_map<std::string, std::vector<uint32_t>> edge_to_triangles;
  std::vector<std::vector<uint32_t>> vertex_to_triangles(vertices.size());
  std::vector<std::vector<uint32_t>> vertex_neighbors(vertices.size());
  std::vector<std::unordered_map<uint32_t, bool>> vertex_neighbor_seen(vertices.size());
  for (uint32_t i = 0; i < faces.size(); ++i) {
    const auto& t = faces[i];
    vertex_to_triangles[t.a].push_back(i);
    vertex_to_triangles[t.b].push_back(i);
    vertex_to_triangles[t.c].push_back(i);
    const std::array<std::pair<uint32_t, uint32_t>, 3> neighbor_edges = {{{t.a, t.b}, {t.b, t.c}, {t.c, t.a}}};
    for (const auto& edge : neighbor_edges) {
      if (!vertex_neighbor_seen[edge.first][edge.second]) {
        vertex_neighbors[edge.first].push_back(edge.second);
        vertex_neighbor_seen[edge.first][edge.second] = true;
      }
      if (!vertex_neighbor_seen[edge.second][edge.first]) {
        vertex_neighbors[edge.second].push_back(edge.first);
        vertex_neighbor_seen[edge.second][edge.first] = true;
      }
    }
    const std::array<std::pair<uint32_t, uint32_t>, 3> edges = {{{t.a, t.b}, {t.b, t.c}, {t.c, t.a}}};
    for (const auto& edge : edges) {
      const uint32_t lo = std::min(edge.first, edge.second);
      const uint32_t hi = std::max(edge.first, edge.second);
      edge_to_triangles[std::to_string(lo) + ":" + std::to_string(hi)].push_back(i);
    }
  }

  std::vector<Tile> tiles;
  tiles.reserve(vertices.size());
  for (uint32_t vertex_index = 0; vertex_index < vertices.size(); ++vertex_index) {
    const Vec3 center = vertices[vertex_index];
    const auto& around = vertex_to_triangles[vertex_index];

    Vec3 tangent_x = Normalize(std::fabs(center.y) > 0.9f ? Cross(Vec3{1, 0, 0}, center) : Cross(Vec3{0, 1, 0}, center), 1.0f);
    Vec3 tangent_y = Normalize(Cross(center, tangent_x), 1.0f);

    std::vector<std::pair<float, uint32_t>> ordering;
    ordering.reserve(around.size());
    for (uint32_t tri_idx : around) {
      const Vec3 node = triangle_nodes[tri_idx];
      const Vec3 planar = Normalize(Vec3{
          node.x - center.x * Dot(node, center),
          node.y - center.y * Dot(node, center),
          node.z - center.z * Dot(node, center),
      }, 1.0f);
      const float angle = std::atan2(Dot(planar, tangent_y), Dot(planar, tangent_x));
      ordering.push_back({angle, tri_idx});
    }
    std::sort(ordering.begin(), ordering.end(), [](auto lhs, auto rhs) { return lhs.first < rhs.first; });

    Tile tile;
    tile.center = center;
    tile.is_pentagon = ordering.size() == 5;
    tile.corners.reserve(ordering.size());
    for (const auto& [_, tri_idx] : ordering) {
      tile.corners.push_back(triangle_nodes[tri_idx]);
    }
    tile.neighbors = vertex_neighbors[vertex_index];
    tiles.push_back(std::move(tile));
  }

  return tiles;
}

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
