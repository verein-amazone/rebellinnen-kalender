// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.0"),
        .package(name: "CapacitorCommunitySqlite", path: "../../../node_modules/.pnpm/@capacitor-community+sqlite@8.1.1_@capacitor+core@8.5.0/node_modules/@capacitor-community/sqlite"),
        .package(name: "CapacitorApp", path: "../../../node_modules/.pnpm/@capacitor+app@8.1.1_@capacitor+core@8.5.0/node_modules/@capacitor/app"),
        .package(name: "CapacitorKeyboard", path: "../../../node_modules/.pnpm/@capacitor+keyboard@8.0.5_@capacitor+core@8.5.0/node_modules/@capacitor/keyboard"),
        .package(name: "CapacitorTextZoom", path: "../../../node_modules/.pnpm/@capacitor+text-zoom@8.0.1_@capacitor+core@8.5.0/node_modules/@capacitor/text-zoom"),
        .package(name: "CapawesomeCapacitorAccessibilityPreferences", path: "../../../node_modules/.pnpm/@capawesome+capacitor-accessibility-preferences@0.1.1_@capacitor+core@8.5.0/node_modules/@capawesome/capacitor-accessibility-preferences"),
        .package(name: "CapawesomeCapacitorAppIcon", path: "../../../node_modules/.pnpm/@capawesome+capacitor-app-icon@0.1.1_@capacitor+core@8.5.0/node_modules/@capawesome/capacitor-app-icon"),
        .package(name: "EbarooniCapacitorCalendar", path: "../../../node_modules/.pnpm/@ebarooni+capacitor-calendar@8.3.0_@capacitor+core@8.5.0/node_modules/@ebarooni/capacitor-calendar"),
        .package(name: "IndependoCapacitorEmojiPicker", path: "../../../node_modules/.pnpm/@independo+capacitor-emoji-picker@1.2.0_@capacitor+core@8.5.0/node_modules/@independo/capacitor-emoji-picker"),
        .package(name: "CapacitorNativeSettings", path: "../../../node_modules/.pnpm/capacitor-native-settings@8.2.0_@capacitor+core@8.5.0/node_modules/capacitor-native-settings")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunitySqlite", package: "CapacitorCommunitySqlite"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorKeyboard", package: "CapacitorKeyboard"),
                .product(name: "CapacitorTextZoom", package: "CapacitorTextZoom"),
                .product(name: "CapawesomeCapacitorAccessibilityPreferences", package: "CapawesomeCapacitorAccessibilityPreferences"),
                .product(name: "CapawesomeCapacitorAppIcon", package: "CapawesomeCapacitorAppIcon"),
                .product(name: "EbarooniCapacitorCalendar", package: "EbarooniCapacitorCalendar"),
                .product(name: "IndependoCapacitorEmojiPicker", package: "IndependoCapacitorEmojiPicker"),
                .product(name: "CapacitorNativeSettings", package: "CapacitorNativeSettings")
            ]
        )
    ]
)
