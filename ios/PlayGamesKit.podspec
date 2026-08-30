Pod::Spec.new do |s|
  s.name           = 'PlayGamesKit'
  s.version        = '0.1.0'
  s.summary        = 'Game Center integration for the expo-play-games-kit module'
  s.description    = 'iOS (GameKit / Game Center) half of expo-play-games-kit: authentication, achievements, and the native achievements UI.'
  s.author         = 'Stefano Solinas'
  s.homepage       = 'https://github.com/obsidianart/expo-play-games-kit'
  s.license        = 'MIT'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: 'https://github.com/obsidianart/expo-play-games-kit.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'GameKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
