// Compile against the pinned, unmodified DanceRudiments C++ core.
// Export its complete finite integer-pip domain, not a JS approximation.
#include "dancerudiments/dance_rudiments.hpp"
#include <cmath>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string_view>

static void text(std::string_view value) {
  std::cout << '"';
  for (char c : value) {
    if (c == '"' || c == '\\') std::cout << '\\';
    std::cout << c;
  }
  std::cout << '"';
}
int main() {
  using namespace dancerudiments;
  std::cout << std::setprecision(17) << '[';
  bool first = true;
  for (const auto& info : catalogue()) {
    if (!first) std::cout << ',';
    first = false;
    std::cout << "{\"name\":"; text(info.name);
    std::cout << ",\"description\":"; text(info.description);
    std::cout << ",\"periodPips\":" << info.period_pips
              << ",\"dimensions\":" << static_cast<int>(info.dimensions)
              << ",\"samples\":[";
    for (int p = 0; p < info.period_pips; ++p) {
      const auto a = sample(info.name, p);
      const auto b = sample(info.name, p - info.period_pips);
      const auto c = sample(info.name, p + info.period_pips);
      if (!std::isfinite(a.x) || !std::isfinite(a.y) || !std::isfinite(a.z) ||
          a.x != b.x || a.y != b.y || a.z != b.z ||
          a.x != c.x || a.y != c.y || a.z != c.z) {
        throw std::runtime_error("Rudiment is not a finite periodic integer sampler");
      }
      if (p) std::cout << ',';
      std::cout << '[' << a.x << ',' << a.y << ',' << a.z << ']';
    }
    std::cout << "]}";
  }
  std::cout << "]\n";
}
