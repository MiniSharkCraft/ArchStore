// internal/i18n/i18n.go
// Module đa ngôn ngữ cho ArchStore Backend
// Hỗ trợ hot-reload ngôn ngữ mà không cần restart app
package i18n

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// ─────────────────────────────────────────────
// CORE TYPES
// ─────────────────────────────────────────────

// Manager quản lý toàn bộ hệ thống dịch thuật
type Manager struct {
	mu          sync.RWMutex
	currentLang string
	translations map[string]map[string]string // lang -> key -> value
	langDir     string
}

// SupportedLanguages là danh sách ngôn ngữ được hỗ trợ
var SupportedLanguages = []Language{
	{Code: "en", Name: "English", Flag: "🇬🇧"},
	{Code: "vi", Name: "Tiếng Việt", Flag: "🇻🇳"},
	{Code: "ja", Name: "日本語", Flag: "🇯🇵"},
	{Code: "zh", Name: "中文", Flag: "🇨🇳"},
}

type Language struct {
	Code string `json:"code"`
	Name string `json:"name"`
	Flag string `json:"flag"`
}

// ─────────────────────────────────────────────
// CONSTRUCTOR
// ─────────────────────────────────────────────

// NewManager tạo Manager mới, load ngôn ngữ mặc định
func NewManager(langDir string, defaultLang string) (*Manager, error) {
	m := &Manager{
		currentLang:  defaultLang,
		translations: make(map[string]map[string]string),
		langDir:     langDir,
	}

	// Load ngôn ngữ mặc định (bắt buộc phải có)
	if err := m.loadLanguage(defaultLang); err != nil {
		return nil, fmt.Errorf("không thể load ngôn ngữ mặc định '%s': %w", defaultLang, err)
	}

	// Load fallback English nếu default không phải English
	if defaultLang != "en" {
		_ = m.loadLanguage("en") // Bỏ qua lỗi nếu không có en.json
	}

	return m, nil
}

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────

// T dịch một key sang ngôn ngữ hiện tại
// Hỗ trợ interpolation: T("greeting", map[string]string{"name": "Arch"})
// → "Xin chào, Arch!"
func (m *Manager) T(key string, args ...map[string]string) string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	val := m.getTranslation(m.currentLang, key)
	if val == "" {
		// Fallback sang English
		val = m.getTranslation("en", key)
	}
	if val == "" {
		// Fallback sang chính key (để debug dễ hơn)
		return key
	}

	// Xử lý interpolation nếu có args
	if len(args) > 0 {
		val = interpolate(val, args[0])
	}

	return val
}

// SetLanguage chuyển đổi ngôn ngữ (hot-swap, không cần restart)
func (m *Manager) SetLanguage(langCode string) error {
	// Validate ngôn ngữ
	if !isSupportedLanguage(langCode) {
		return fmt.Errorf("ngôn ngữ '%s' không được hỗ trợ", langCode)
	}

	// Load nếu chưa có trong cache
	m.mu.RLock()
	_, loaded := m.translations[langCode]
	m.mu.RUnlock()

	if !loaded {
		if err := m.loadLanguage(langCode); err != nil {
			return err
		}
	}

	m.mu.Lock()
	m.currentLang = langCode
	m.mu.Unlock()

	return nil
}

// GetCurrentLanguage trả về ngôn ngữ hiện tại
func (m *Manager) GetCurrentLanguage() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.currentLang
}

// GetAvailableLanguages trả về danh sách ngôn ngữ hỗ trợ
func (m *Manager) GetAvailableLanguages() []Language {
	return SupportedLanguages
}

// ReloadLanguage reload lại file ngôn ngữ từ disk (útile cho development)
func (m *Manager) ReloadLanguage(langCode string) error {
	return m.loadLanguage(langCode)
}

// ─────────────────────────────────────────────
// PRIVATE METHODS
// ─────────────────────────────────────────────

func (m *Manager) loadLanguage(langCode string) error {
	filePath := filepath.Join(m.langDir, langCode+".json")

	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("không đọc được file ngôn ngữ %s: %w", filePath, err)
	}

	var translations map[string]string
	if err := json.Unmarshal(data, &translations); err != nil {
		return fmt.Errorf("file ngôn ngữ %s không hợp lệ: %w", filePath, err)
	}

	m.mu.Lock()
	m.translations[langCode] = translations
	m.mu.Unlock()

	return nil
}

func (m *Manager) getTranslation(langCode, key string) string {
	if trans, ok := m.translations[langCode]; ok {
		if val, ok := trans[key]; ok {
			return val
		}
	}
	return ""
}

// interpolate thay thế {{key}} bằng giá trị thực
func interpolate(template string, vars map[string]string) string {
	result := template
	for k, v := range vars {
		result = strings.ReplaceAll(result, "{{"+k+"}}", v)
	}
	return result
}

func isSupportedLanguage(code string) bool {
	for _, l := range SupportedLanguages {
		if l.Code == code {
			return true
		}
	}
	return false
}
