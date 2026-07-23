import SwiftUI
import UIKit

// ─── هوية «الخطّ الساري» — الرموز اللونية (نهاري/حبر الليل) ───
enum MTheme {
    static func dyn(_ light: String, _ dark: String) -> Color {
        Color(UIColor { tc in
            tc.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
        })
    }

    static let ink = dyn("#1E2735", "#F0EBE0")
    static let ink2 = dyn("#46536B", "#C4BDAE")
    static let muted = dyn("#77705F", "#8F897B")
    static let paper = dyn("#F7F3EB", "#15181E")
    static let surface = dyn("#FFFDF8", "#1E222A")
    static let line = dyn("#E4DDCE", "#2C3038")
    static let lineSoft = dyn("#EEE9DD", "#262A32")
    static let saffron = dyn("#C2701E", "#E09640")
    static let success = dyn("#2E7D5B", "#4A9877")
    static let wait = dyn("#A87A0E", "#C99A2E")
    static let review = dyn("#33658A", "#5D8FB5")
    static let danger = dyn("#B0413E", "#D06B67")

    static let saffronSoft = saffron.opacity(0.12)

    // زوايا الدليل
    static let rField: CGFloat = 9
    static let rCard: CGFloat = 16
    static let rSheet: CGFloat = 20
}

extension UIColor {
    convenience init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        self.init(
            red: CGFloat((v >> 16) & 0xFF) / 255,
            green: CGFloat((v >> 8) & 0xFF) / 255,
            blue: CGFloat(v & 0xFF) / 255,
            alpha: 1
        )
    }
}

extension Color {
    init(hex: String) { self.init(UIColor(hex: hex)) }
}

// ─── الخطوط: Alexandria (عناوين) + IBM Plex Sans Arabic (نص) + Space Grotesk (لاتيني) ───
enum MFont {
    /// خط متغيّر: يُنشئ نسخة بوزن محدد عبر محور wght
    private static func variable(_ family: String, size: CGFloat, wght: CGFloat) -> Font {
        guard let base = UIFont(name: family, size: size) else {
            return .system(size: size, weight: wght >= 700 ? .bold : .semibold)
        }
        let wghtAxis = 2003265652 // 'wght'
        let desc = base.fontDescriptor.addingAttributes([
            UIFontDescriptor.AttributeName(rawValue: "NSCTFontVariationAttribute"): [wghtAxis: wght]
        ])
        return Font(UIFont(descriptor: desc, size: size))
    }

    static func display(_ size: CGFloat, _ wght: CGFloat = 700) -> Font {
        variable("Alexandria-Regular", size: size, wght: wght)
    }

    static func text(_ size: CGFloat, _ weight: PlexWeight = .regular) -> Font {
        Font.custom(weight.name, size: size)
    }

    static func latin(_ size: CGFloat, _ wght: CGFloat = 500) -> Font {
        variable("SpaceGrotesk-Regular", size: size, wght: wght)
    }

    enum PlexWeight {
        case regular, medium, semibold, bold
        var name: String {
            switch self {
            case .regular: "IBMPlexSansArabic"
            case .medium: "IBMPlexSansArabic-Medium"
            case .semibold: "IBMPlexSansArabic-SemiBold"
            case .bold: "IBMPlexSansArabic-Bold"
            }
        }
    }
}

// حركة الدليل: 200ms ease-out بلا ارتداد
extension Animation {
    static var masar: Animation { .timingCurve(0, 0, 0.2, 1, duration: 0.2) }
}
