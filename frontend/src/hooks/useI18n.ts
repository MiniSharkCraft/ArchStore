// frontend/src/hooks/useI18n.ts
// Hook quản lý đa ngôn ngữ phía Frontend
// Đồng bộ với backend Go thông qua Wails binding

import { useState, useCallback, useEffect } from 'react'

// ─────────────────────────────────────────────
// TRANSLATION BUNDLES (inline để không cần HTTP request)
// ─────────────────────────────────────────────

const translations: Record<string, Record<string, string>> = {
  en: {
    // Navigation
    'nav.search':    'Search',
    'nav.installed': 'Installed',
    'nav.updates':   'Updates',
    'nav.settings':  'Settings',

    // Search
    'search_placeholder': 'Search packages (pacman + AUR)...',
    'search_empty':       'Type to search packages',
    'search_no_results':  'No packages found for "{{query}}"',
    'search_error':       'Search failed. Check your internet connection.',
    'searching':          'Searching...',

    // Package card
    'pkg.install':      'Install',
    'pkg.uninstall':    'Remove',
    'pkg.installed':    '✓ Installed',
    'pkg.version':      'Version',
    'pkg.size':         'Size',
    'pkg.source':       'Source',
    'pkg.maintainer':   'Maintainer',
    'pkg.depends':      'Dependencies',
    'pkg.votes':        'AUR Votes',
    'pkg.last_updated': 'Last Updated',

    // Install
    'install_error':       'Installation failed',
    'installed_success':   'installed successfully',
    'uninstalled_success': 'removed successfully',
    'uninstall_error':     'Removal failed',

    // Progress stages
    'stage.resolving':   'Resolving dependencies...',
    'stage.downloading': 'Downloading...',
    'stage.installing':  'Installing...',
    'stage.done':        'Done!',
    'stage.error':       'Error',

    // Reviews
    'reviews':          'Reviews',
    'no_reviews':       'Be the first to review this package!',
    'write_review':     'Write a Review',
    'your_rating':      'Your Rating',
    'your_username':    'Username',
    'your_comment':     'Your review (min. 10 characters)',
    'submit_review':    'Submit Review',
    'review_submitted': 'Thank you for your review!',
    'review_error':     'Failed to submit review',
    'like':             'Helpful',
    'dislike':          'Not helpful',
    'reply':            'Reply',
    'maintainer_reply': 'Maintainer Reply',

    // Rating
    'rating.average': 'Overall Rating',
    'rating.based_on': 'Based on {{count}} reviews',

    // System info
    'sys.kernel':     'Kernel',
    'sys.arch':       'Arch Version',
    'sys.aur_helper': 'AUR Helper',
    'sys.no_aur':     'No AUR helper detected',
    'works_on_mine':  '✓ Works on my machine',

    // Errors
    'err.no_network':  'No internet connection',
    'err.no_aur':      'No AUR helper (yay/paru) installed',
    'err.pkg_invalid': 'Invalid package name',

    // Tech specs section
    'tech_specs':     'Technical Specs',
  },

  vi: {
    // Điều hướng
    'nav.search':    'Tìm kiếm',
    'nav.installed': 'Đã cài đặt',
    'nav.updates':   'Cập nhật',
    'nav.settings':  'Cài đặt',

    // Tìm kiếm
    'search_placeholder': 'Tìm kiếm package (pacman + AUR)...',
    'search_empty':       'Nhập từ khóa để tìm package',
    'search_no_results':  'Không tìm thấy package cho "{{query}}"',
    'search_error':       'Tìm kiếm thất bại. Kiểm tra kết nối mạng.',
    'searching':          'Đang tìm kiếm...',

    // Package card
    'pkg.install':      'Cài đặt',
    'pkg.uninstall':    'Gỡ cài đặt',
    'pkg.installed':    '✓ Đã cài',
    'pkg.version':      'Phiên bản',
    'pkg.size':         'Kích thước',
    'pkg.source':       'Nguồn',
    'pkg.maintainer':   'Maintainer',
    'pkg.depends':      'Phụ thuộc',
    'pkg.votes':        'Lượt bình chọn AUR',
    'pkg.last_updated': 'Cập nhật lần cuối',

    // Cài đặt
    'install_error':       'Cài đặt thất bại',
    'installed_success':   'đã cài đặt thành công',
    'uninstalled_success': 'đã gỡ cài đặt thành công',
    'uninstall_error':     'Gỡ cài đặt thất bại',

    // Các giai đoạn
    'stage.resolving':   'Đang phân giải dependencies...',
    'stage.downloading': 'Đang tải xuống...',
    'stage.installing':  'Đang cài đặt...',
    'stage.done':        'Hoàn thành!',
    'stage.error':       'Lỗi',

    // Đánh giá
    'reviews':          'Đánh giá',
    'no_reviews':       'Hãy là người đầu tiên đánh giá package này!',
    'write_review':     'Viết đánh giá',
    'your_rating':      'Đánh giá của bạn',
    'your_username':    'Tên người dùng',
    'your_comment':     'Nhận xét của bạn (tối thiểu 10 ký tự)',
    'submit_review':    'Gửi đánh giá',
    'review_submitted': 'Cảm ơn bạn đã đánh giá!',
    'review_error':     'Gửi đánh giá thất bại',
    'like':             'Hữu ích',
    'dislike':          'Không hữu ích',
    'reply':            'Phản hồi',
    'maintainer_reply': 'Phản hồi từ Maintainer',

    // Rating
    'rating.average':  'Điểm tổng quan',
    'rating.based_on': 'Dựa trên {{count}} đánh giá',

    // Thông tin hệ thống
    'sys.kernel':     'Kernel',
    'sys.arch':       'Arch Version',
    'sys.aur_helper': 'AUR Helper',
    'sys.no_aur':     'Chưa cài AUR helper',
    'works_on_mine':  '✓ Hoạt động trên máy tôi',

    // Lỗi
    'err.no_network':  'Không có kết nối mạng',
    'err.no_aur':      'Chưa cài AUR helper (yay/paru)',
    'err.pkg_invalid': 'Tên package không hợp lệ',

    // Thông số kỹ thuật
    'tech_specs':     'Thông số kỹ thuật',
  },

  ja: {
    'nav.search':         '検索',
    'nav.installed':      'インストール済み',
    'search_placeholder': 'パッケージを検索 (pacman + AUR)...',
    'pkg.install':        'インストール',
    'pkg.uninstall':      'アンインストール',
    'pkg.installed':      '✓ インストール済み',
    'reviews':            'レビュー',
    'write_review':       'レビューを書く',
    'submit_review':      'レビューを送信',
    'like':               '役に立った',
    'dislike':            '役に立たなかった',
    'tech_specs':         '技術仕様',
    'works_on_mine':      '✓ 動作確認済み',
    // ... (các key còn lại fallback về 'en')
  },
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

type TFunction = (key: string, vars?: Record<string, string>) => string

export function useI18n() {
  const [lang, setLangState] = useState<string>(() => {
    // Khôi phục ngôn ngữ từ localStorage (persist across sessions)
    return localStorage.getItem('archstore_lang') || 'en'
  })

  const setLang = useCallback((newLang: string) => {
    if (!translations[newLang]) return
    setLangState(newLang)
    localStorage.setItem('archstore_lang', newLang)
    // Cập nhật html lang attribute cho accessibility
    document.documentElement.lang = newLang
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Hàm dịch với interpolation
  const t: TFunction = useCallback((key: string, vars?: Record<string, string>) => {
    // Tìm trong ngôn ngữ hiện tại
    let value = translations[lang]?.[key]

    // Fallback sang tiếng Anh nếu không có
    if (!value && lang !== 'en') {
      value = translations['en']?.[key]
    }

    // Fallback cuối: trả về key
    if (!value) return key

    // Xử lý interpolation: {{varName}} → giá trị thực
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        value = value!.replaceAll(`{{${k}}}`, v)
      })
    }

    return value
  }, [lang])

  return { t, lang, setLang }
}
