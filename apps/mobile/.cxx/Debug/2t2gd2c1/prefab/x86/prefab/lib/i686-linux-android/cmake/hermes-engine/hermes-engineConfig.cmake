if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "C:/gr/caches/8.14.3/transforms/63f351f81a09ee3da45beb0f9a4d1b42/transformed/hermes-android-0.14.1-debug/prefab/modules/hermesvm/libs/android.x86/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/gr/caches/8.14.3/transforms/63f351f81a09ee3da45beb0f9a4d1b42/transformed/hermes-android-0.14.1-debug/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

