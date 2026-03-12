// internal/app/auth.go
// Auth bindings — Register, Login, OAuth (Discord/GitHub), Forgot/Reset Password
package app

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

// AuthUser là thông tin user trả về frontend sau khi đăng nhập
type AuthUser struct {
	ID         int    `json:"id"`
	Username   string `json:"username"`
	Email      string `json:"email"`
	AvatarURL  string `json:"avatar_url"`
	Provider   string `json:"provider"`
	IsVerified int    `json:"is_verified"`
}

// session lưu trên disk tại ~/.config/archstore/session.json
type session struct {
	JWT          string   `json:"jwt"`
	RefreshToken string   `json:"refresh_token"`
	User         AuthUser `json:"user"`
	ExpiresAt    int64    `json:"expires_at"` // Unix timestamp
}

type authResponse struct {
	JWT          string   `json:"jwt"`
	RefreshToken string   `json:"refresh_token"`
	User         AuthUser `json:"user"`
	Error        string   `json:"error"`
}

// ─────────────────────────────────────────────
// SESSION FILE
// ─────────────────────────────────────────────

func sessionPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = os.TempDir()
	}
	return filepath.Join(dir, "archstore", "session.json")
}

func (a *App) saveSession(jwt, refreshToken string, user *AuthUser) {
	s := session{
		JWT:          jwt,
		RefreshToken: refreshToken,
		User:         *user,
		ExpiresAt:    time.Now().Add(time.Hour).Unix(),
	}

	path := sessionPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err == nil {
		if data, err := json.Marshal(s); err == nil {
			os.WriteFile(path, data, 0o600) //nolint:errcheck
		}
	}

	a.mu.Lock()
	a.authToken = jwt
	a.currentUser = user
	a.mu.Unlock()
}

func (a *App) tryRestoreSession() {
	data, err := os.ReadFile(sessionPath())
	if err != nil {
		return
	}

	var s session
	if err := json.Unmarshal(data, &s); err != nil {
		return
	}

	// Nếu JWT còn trong hạn (với buffer 5 phút), dùng luôn
	if s.ExpiresAt-300 > time.Now().Unix() {
		a.mu.Lock()
		a.authToken = s.JWT
		a.currentUser = &s.User
		a.mu.Unlock()
		log.Printf("[Auth] Khôi phục session: %s (%s)", s.User.Username, s.User.Provider)
		return
	}

	// JWT hết hạn nhưng còn refresh token → tự động refresh
	if s.RefreshToken != "" && a.cfWorkerURL != "" {
		log.Printf("[Auth] JWT hết hạn, đang refresh...")
		var result authResponse
		err := a.postJSONResult(a.cfWorkerURL+"/auth/refresh", map[string]any{
			"refresh_token": s.RefreshToken,
		}, &result)
		if err == nil && result.JWT != "" {
			a.saveSession(result.JWT, result.RefreshToken, &result.User)
			log.Printf("[Auth] Refresh token thành công: %s", result.User.Username)
		} else {
			log.Printf("[Auth] Refresh token thất bại: %v", err)
			os.Remove(sessionPath())
		}
	}
}

func (a *App) clearSession() {
	os.Remove(sessionPath()) //nolint:errcheck
	a.mu.Lock()
	a.authToken = ""
	a.currentUser = nil
	a.mu.Unlock()
}

// ─────────────────────────────────────────────
// BINDINGS
// ─────────────────────────────────────────────

// GetCurrentUser trả về user đang đăng nhập, hoặc nil nếu chưa đăng nhập
func (a *App) GetCurrentUser() *AuthUser {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.currentUser
}

// RegisterUser đăng ký tài khoản local mới
func (a *App) RegisterUser(username, email, password string) (*AuthUser, error) {
	if a.cfWorkerURL == "" {
		return nil, fmt.Errorf("ARCHSTORE_CF_WORKER_URL chưa được cấu hình")
	}

	var result authResponse
	if err := a.postJSONResult(a.cfWorkerURL+"/auth/register", map[string]any{
		"username": username,
		"email":    email,
		"password": password,
	}, &result); err != nil {
		return nil, err
	}

	a.saveSession(result.JWT, result.RefreshToken, &result.User)
	return &result.User, nil
}

// LoginUser đăng nhập bằng username/email + password
func (a *App) LoginUser(login, password string) (*AuthUser, error) {
	if a.cfWorkerURL == "" {
		return nil, fmt.Errorf("ARCHSTORE_CF_WORKER_URL chưa được cấu hình")
	}

	var result authResponse
	if err := a.postJSONResult(a.cfWorkerURL+"/auth/login", map[string]any{
		"login":    login,
		"password": password,
	}, &result); err != nil {
		return nil, err
	}

	a.saveSession(result.JWT, result.RefreshToken, &result.User)
	return &result.User, nil
}

// LogoutUser đăng xuất: revoke refresh token + xóa session local
func (a *App) LogoutUser() error {
	data, _ := os.ReadFile(sessionPath())
	var s session
	json.Unmarshal(data, &s) //nolint:errcheck

	if s.RefreshToken != "" && a.cfWorkerURL != "" {
		go func() {
			a.postToCloudflare("/auth/logout", map[string]any{ //nolint:errcheck
				"refresh_token": s.RefreshToken,
			})
		}()
	}

	a.clearSession()
	return nil
}

// ForgotPassword gửi mã reset về email
func (a *App) ForgotPassword(email string) error {
	if a.cfWorkerURL == "" {
		return fmt.Errorf("ARCHSTORE_CF_WORKER_URL chưa được cấu hình")
	}
	return a.postToCloudflare("/auth/forgot-password", map[string]any{"email": email})
}

// ResetPassword đặt lại mật khẩu bằng mã OTP từ email
func (a *App) ResetPassword(email, code, newPassword string) error {
	if a.cfWorkerURL == "" {
		return fmt.Errorf("ARCHSTORE_CF_WORKER_URL chưa được cấu hình")
	}
	return a.postToCloudflare("/auth/reset-password", map[string]any{
		"email":        email,
		"code":         code,
		"new_password": newPassword,
	})
}

// RefreshToken làm mới JWT dùng refresh token
func (a *App) RefreshToken() error {
	data, err := os.ReadFile(sessionPath())
	if err != nil {
		return fmt.Errorf("chưa đăng nhập")
	}
	var s session
	if err := json.Unmarshal(data, &s); err != nil || s.RefreshToken == "" {
		return fmt.Errorf("session không hợp lệ")
	}

	var result authResponse
	if err := a.postJSONResult(a.cfWorkerURL+"/auth/refresh", map[string]any{
		"refresh_token": s.RefreshToken,
	}, &result); err != nil {
		a.clearSession()
		return err
	}

	a.saveSession(result.JWT, result.RefreshToken, &result.User)
	return nil
}

// InitOAuth mở browser để đăng nhập qua Discord hoặc GitHub.
// Sau đó polling ngầm và emit event "auth:login" khi hoàn tất.
func (a *App) InitOAuth(provider string) error {
	if provider != "discord" && provider != "github" {
		return fmt.Errorf("provider không được hỗ trợ: %s", provider)
	}
	if a.cfWorkerURL == "" {
		return fmt.Errorf("ARCHSTORE_CF_WORKER_URL chưa được cấu hình")
	}

	state, err := secureHex(16)
	if err != nil {
		return fmt.Errorf("không thể tạo state: %w", err)
	}

	authURL := fmt.Sprintf("%s/auth/%s?state=%s", a.cfWorkerURL, provider, state)
	runtime.BrowserOpenURL(a.ctx, authURL)

	go a.pollOAuthState(state)
	return nil
}

func (a *App) pollOAuthState(state string) {
	timeout := time.After(5 * time.Minute)
	ticker  := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-timeout:
			runtime.EventsEmit(a.ctx, "auth:error", "Đăng nhập OAuth timeout. Vui lòng thử lại.")
			return

		case <-ticker.C:
			resp, err := a.httpClient.Get(a.cfWorkerURL + "/auth/poll/" + state)
			if err != nil {
				continue
			}

			if resp.StatusCode == http.StatusOK {
				var result authResponse
				body, _ := io.ReadAll(resp.Body)
				resp.Body.Close()

				if err := json.Unmarshal(body, &result); err != nil || result.JWT == "" {
					continue
				}

				a.saveSession(result.JWT, result.RefreshToken, &result.User)
				runtime.EventsEmit(a.ctx, "auth:login", result.User)
				return
			}
			resp.Body.Close()
		}
	}
}

// ─────────────────────────────────────────────
// HTTP HELPERS
// ─────────────────────────────────────────────

// postJSONResult POST và unmarshal response vào result. Trả lỗi từ field "error" nếu HTTP ≥ 400.
func (a *App) postJSONResult(url string, body any, result any) error {
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	// Đính kèm JWT nếu đã đăng nhập
	a.mu.Lock()
	if a.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+a.authToken)
	}
	a.mu.Unlock()

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("lỗi kết nối: %w", err)
	}
	defer resp.Body.Close()

	rawBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		var errBody struct {
			Error string `json:"error"`
		}
		json.Unmarshal(rawBody, &errBody) //nolint:errcheck
		if errBody.Error != "" {
			return fmt.Errorf("%s", errBody.Error)
		}
		return fmt.Errorf("lỗi server: HTTP %d", resp.StatusCode)
	}

	if result != nil {
		return json.Unmarshal(rawBody, result)
	}
	return nil
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

func secureHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
