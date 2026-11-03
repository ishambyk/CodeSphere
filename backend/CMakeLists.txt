cmake_minimum_required(VERSION 3.24)
project(CodeSphereBackend VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(httplib CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
find_package(unofficial-sqlite3 CONFIG REQUIRED)

add_executable(codesphere-server src/main.cpp)
target_link_libraries(codesphere-server PRIVATE
  httplib::httplib
  nlohmann_json::nlohmann_json
  unofficial::sqlite3::sqlite3
)

set(CODESPHERE_RUNTIME_DIR "${CMAKE_BINARY_DIR}/bin")
set_target_properties(codesphere-server PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${CODESPHERE_RUNTIME_DIR}"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CODESPHERE_RUNTIME_DIR}"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CODESPHERE_RUNTIME_DIR}"
  RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${CODESPHERE_RUNTIME_DIR}"
  RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL "${CODESPHERE_RUNTIME_DIR}"
)
