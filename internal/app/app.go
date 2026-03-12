// internal/app/app.go
// Core business logic của ArchStore — tất cả Wails bindings ở đây
package app

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ─────────────────────────────────────────────
// DOMAIN MODELS
// ─────────────────────────────────────────────

// PkgInfo đại diện cho một gói phần mềm (từ pacman hoặc AUR)
type PkgInfo struct {
	Name        string   `json:"name"`
	Version     string   `json:"version"`
	Description string   `json:"description"`
	Source      string   `json:"source"`     // "pacman" | "aur"
	Installed   bool     `json:"installed"`
	SizeKB      int64    `json:"size_kb"`
	Maintainer  string   `json:"maintainer"`
	URL         string   `json:"url"`
	Depends     []string `json:"depends"`
	Votes       int      `json:"votes"`      // AUR votes
	Popularity  float64  `json:"popularity"` // AUR popularity
	LastUpdated string   `json:"last_updated"`
	// Rating từ Cloudflare D1 (gộp vào sau khi fetch song song)
	Rating *PackageRating `json:"rating,omitempty"`
}

// PackageRating là dữ liệu social từ Cloudflare D1
type PackageRating struct {
	PkgName      string       `json:"pkg_name"`
	Average      float64      `json:"average"`
	TotalVotes   int          `json:"total_votes"`
	Distribution []RatingDist `json:"distribution"`
	Reviews      []Review     `json:"reviews"`
}

type RatingDist struct {
	Stars int `json:"stars"`
	Count int `json:"count"`
}

// Review là một đánh giá từ người dùng.
// JSON tags phải khớp với response của Cloudflare Worker.
type Review struct {
	ID       int     `json:"id"`
	PkgName  string  `json:"pkg_name"`
	Username string  `json:"username"`
	Rating   int     `json:"rating"`
	Comment  string  `json:"comment"`
	Date     string  `json:"created_at"` // ISO string từ Worker, frontend dùng review.date → alias trong types
	Likes    int     `json:"likes"`
	Dislikes int     `json:"dislikes"`
	Replies  []Reply `json:"replies"`
}

// Reply là phản hồi của maintainer cho một review
type Reply struct {
	ID       int    `json:"id"`
	ReviewID int    `json:"review_id"`
	Author   string `json:"author"`
	Content  string `json:"content"`
}

// SystemInfo chứa thông tin hệ thống cho tính năng "Works on my machine"
type SystemInfo struct {
	KernelVersion string `json:"kernel_version"`
	ArchVersion   string `json:"arch_version"`
	CPU           string `json:"cpu"`
	RAM           string `json:"ram"`
	HasYay        bool   `json:"has_yay"`
	HasParu       bool   `json:"has_paru"`
	AURHelper     string `json:"aur_helper"`     // helper ưu tiên sẽ dùng
	HasTimeshift  bool   `json:"has_timeshift"`
	HasSnapper    bool   `json:"has_snapper"`
	SnapshotTool  string `json:"snapshot_tool"`  // "timeshift" | "snapper" | ""
}

// InstallProgress là event gửi về Frontend theo real-time
type InstallProgress struct {
	PkgName  string  `json:"pkg_name"`
	Stage    string  `json:"stage"`    // "resolving"|"downloading"|"installing"|"removing"|"done"|"error"
	Progress float64 `json:"progress"` // 0.0 – 100.0
	Message  string  `json:"message"`
}

// ─────────────────────────────────────────────
// APP STRUCT — Wails Binding Container
// ─────────────────────────────────────────────

type App struct {
	ctx         context.Context
	sysInfo     *SystemInfo
	cfWorkerURL string
	cfAPIKey    string // ARCHSTORE_API_KEY — gửi qua X-Api-Key header
	httpClient  *http.Client
	mu          sync.Mutex
	// Auth state
	currentUser *AuthUser
	authToken   string
}

// defaultCFWorkerURL được inject lúc build bằng Go ldflags — KHÔNG hardcode ở đây.
// Cách build cho distribution:
//   wails build -ldflags="-X 'github.com/your-repo/archstore/internal/app.defaultCFWorkerURL=https://your-worker.workers.dev'"
// Hoặc set env var ARCHSTORE_CF_WORKER_URL lúc chạy.
var defaultCFWorkerURL = "" //nolint:gochecknoglobals

func NewApp() *App {
	return &App{
		cfWorkerURL: getEnvOrDefault("ARCHSTORE_CF_WORKER_URL", defaultCFWorkerURL),
		cfAPIKey:    os.Getenv("ARCHSTORE_API_KEY"),
		httpClient:  &http.Client{Timeout: 15 * time.Second},
	}
}

func (a *App) OnStartup(ctx context.Context) {
	a.ctx = ctx
	log.Println("[ArchStore] Đang khởi động...")

	// Khôi phục session đăng nhập từ lần trước
	a.tryRestoreSession()

	info, err := a.fetchSystemInfo()
	if err != nil {
		log.Printf("[ArchStore] Cảnh báo: Không lấy được system info: %v", err)
		// Khởi tạo sysInfo rỗng để tránh nil pointer ở các binding khác
		a.sysInfo = &SystemInfo{}
	} else {
		a.sysInfo = info
		log.Printf("[ArchStore] AUR helper: %q, yay=%v paru=%v",
			info.AURHelper, info.HasYay, info.HasParu)
	}
}

func (a *App) OnShutdown(_ context.Context) {
	log.Println("[ArchStore] Đang tắt...")
}

// ─────────────────────────────────────────────
// BINDING 1: SearchPackages
// ─────────────────────────────────────────────

// SearchPackages tìm kiếm song song trong pacman repo + AUR RPC v5.
func (a *App) SearchPackages(query string) ([]PkgInfo, error) {
	if strings.TrimSpace(query) == "" {
		return []PkgInfo{}, nil
	}
	if len(query) > 200 {
		return nil, fmt.Errorf("từ khóa tìm kiếm quá dài")
	}

	var (
		wg         sync.WaitGroup
		pacmanPkgs []PkgInfo
		aurPkgs    []PkgInfo
		pacmanErr  error
		aurErr     error
	)

	wg.Add(2)

	go func() {
		defer wg.Done()
		pacmanPkgs, pacmanErr = a.searchPacman(query)
	}()

	go func() {
		defer wg.Done()
		aurPkgs, aurErr = a.searchAUR(query)
	}()

	wg.Wait()

	if pacmanErr != nil {
		log.Printf("[SearchPackages] pacman: %v", pacmanErr)
	}
	if aurErr != nil {
		log.Printf("[SearchPackages] AUR: %v", aurErr)
	}

	return deduplicatePackages(pacmanPkgs, aurPkgs), nil
}

func (a *App) searchPacman(query string) ([]PkgInfo, error) {
	out, err := exec.Command("pacman", "-Ss", "--", query).Output()
	if err != nil {
		// exit 1 khi không có kết quả — không phải lỗi thật
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			return []PkgInfo{}, nil
		}
		return nil, fmt.Errorf("pacman -Ss: %w", err)
	}
	return parsePacmanSearchOutput(string(out)), nil
}

func (a *App) searchAUR(query string) ([]PkgInfo, error) {
	apiURL := "https://aur.archlinux.org/rpc/v5/search/" + url.PathEscape(query) + "?by=name-desc"

	resp, err := a.httpClient.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("AUR API: %w", err)
	}
	defer resp.Body.Close()

	var aurResp AURResponse
	if err := json.NewDecoder(resp.Body).Decode(&aurResp); err != nil {
		return nil, err
	}
	if aurResp.Error != "" {
		return nil, fmt.Errorf("AUR API: %s", aurResp.Error)
	}

	return convertAURResults(aurResp.Results), nil
}

// ─────────────────────────────────────────────
// BINDING 2: GetPackageDetail
// ─────────────────────────────────────────────

// GetPackageDetail lấy thông tin đầy đủ + rating từ Cloudflare D1, chạy song song.
func (a *App) GetPackageDetail(pkgName string) (*PkgInfo, error) {
	if err := validatePackageName(pkgName); err != nil {
		return nil, err
	}

	var (
		pkg    *PkgInfo
		rating *PackageRating
		wg     sync.WaitGroup
	)

	wg.Add(2)

	go func() {
		defer wg.Done()
		pkg = a.getPackageInfo(pkgName)
	}()

	go func() {
		defer wg.Done()
		if a.cfWorkerURL == "" {
			return
		}
		r, err := a.fetchRatingFromCloudflare(pkgName)
		if err != nil {
			log.Printf("[GetPackageDetail] rating: %v", err)
		} else {
			rating = r
		}
	}()

	wg.Wait()

	if pkg == nil {
		return nil, fmt.Errorf("không tìm thấy package: %s", pkgName)
	}

	pkg.Rating = rating
	return pkg, nil
}

// ─────────────────────────────────────────────
// BINDING 3: InstallPackage
// ─────────────────────────────────────────────

// InstallPackage cài đặt package. Progress được emit qua Wails event "install:progress".
func (a *App) InstallPackage(pkgName string) error {
	if err := validatePackageName(pkgName); err != nil {
		return err
	}

	a.emitProgress(pkgName, "resolving", 2, "Đang kiểm tra dependencies...")

	// Tạo snapshot backup trước khi thay đổi hệ thống
	if a.sysInfo != nil && a.sysInfo.SnapshotTool != "" {
		a.emitProgress(pkgName, "resolving", 3, "🔒 Đang tạo snapshot backup...")
		if snapOut, err := a.CreateSnapshot(fmt.Sprintf("Before installing %s", pkgName)); err != nil {
			log.Printf("[InstallPackage] Snapshot warning: %v", err)
			a.emitProgress(pkgName, "resolving", 4, "⚠ Không tạo được snapshot, tiếp tục cài đặt...")
		} else {
			log.Printf("[InstallPackage] Snapshot: %s", snapOut)
			a.emitProgress(pkgName, "resolving", 5, "✓ Snapshot đã tạo thành công")
		}
	}

	isAUR := a.isAURPackage(pkgName)
	aurHelper := a.sysInfo.AURHelper // sysInfo luôn non-nil sau OnStartup

	var cmd *exec.Cmd
	if isAUR {
		if aurHelper == "" {
			return fmt.Errorf("không tìm thấy AUR helper (yay/paru). Vui lòng cài một trong hai")
		}
		// AUR helper (yay/paru) tự xử lý sudo bên trong — không cần pkexec
		cmd = exec.Command(aurHelper, "--noconfirm", "-S", "--", pkgName)
	} else {
		// pkexec hiện dialog GUI xác thực, không cần mở terminal
		cmd = exec.Command("pkexec", "pacman", "--noconfirm", "-S", "--", pkgName)
	}

	if err := a.runWithProgress(cmd, pkgName, "installing"); err != nil {
		a.emitProgress(pkgName, "error", 0, fmt.Sprintf("Cài đặt thất bại: %v", err))
		return err
	}

	a.emitProgress(pkgName, "done", 100, "Cài đặt thành công!")
	return nil
}

// ─────────────────────────────────────────────
// BINDING 4: UninstallPackage
// ─────────────────────────────────────────────

// UninstallPackage gỡ cài đặt package, emit progress events.
func (a *App) UninstallPackage(pkgName string) error {
	if err := validatePackageName(pkgName); err != nil {
		return err
	}

	a.emitProgress(pkgName, "removing", 2, "Đang chuẩn bị gỡ cài đặt...")

	if a.sysInfo != nil && a.sysInfo.SnapshotTool != "" {
		a.emitProgress(pkgName, "removing", 4, "🔒 Đang tạo snapshot backup...")
		if _, err := a.CreateSnapshot(fmt.Sprintf("Before removing %s", pkgName)); err != nil {
			log.Printf("[UninstallPackage] Snapshot warning: %v", err)
			a.emitProgress(pkgName, "removing", 6, "⚠ Không tạo được snapshot, tiếp tục gỡ cài đặt...")
		} else {
			a.emitProgress(pkgName, "removing", 8, "✓ Snapshot đã tạo thành công")
		}
	}

	a.emitProgress(pkgName, "removing", 10, "Đang gỡ cài đặt...")

	cmd := exec.Command("pkexec", "pacman", "--noconfirm", "-R", "--", pkgName)
	if err := a.runWithProgress(cmd, pkgName, "removing"); err != nil {
		a.emitProgress(pkgName, "error", 0, fmt.Sprintf("Gỡ cài đặt thất bại: %v", err))
		return err
	}

	a.emitProgress(pkgName, "done", 100, "Gỡ cài đặt thành công!")
	return nil
}

// runWithProgress chạy command, đọc stdout+stderr theo từng dòng và emit progress.
// Dùng goroutine riêng cho mỗi pipe để tránh deadlock khi buffer đầy.
func (a *App) runWithProgress(cmd *exec.Cmd, pkgName, stage string) error {
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	lineCh := make(chan string, 64)
	var readerWg sync.WaitGroup

	scanPipe := func(r io.Reader) {
		defer readerWg.Done()
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
			lineCh <- scanner.Text()
		}
	}

	readerWg.Add(2)
	go scanPipe(stdout)
	go scanPipe(stderr)

	go func() {
		readerWg.Wait()
		close(lineCh)
	}()

	progress := 15.0
	for line := range lineCh {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		progress = mapOutputToProgress(line, progress)
		a.emitProgress(pkgName, stage, progress, line)
	}

	return cmd.Wait()
}

// mapOutputToProgress ánh xạ keyword trong output → % tiến trình
func mapOutputToProgress(output string, current float64) float64 {
	lower := strings.ToLower(output)
	switch {
	case strings.Contains(lower, "resolving"):
		return 10
	case strings.Contains(lower, "downloading"):
		return 30
	case strings.Contains(lower, "checking"):
		return 55
	case strings.Contains(lower, "installing") || strings.Contains(lower, "upgrading"):
		return 75
	case strings.Contains(lower, "hooks") || strings.Contains(lower, "running"):
		return 90
	default:
		if current < 88 {
			return current + 2
		}
		return current
	}
}

// ─────────────────────────────────────────────
// BINDING 5: GetSystemInfo
// ─────────────────────────────────────────────

// GetSystemInfo trả về thông tin hệ thống đã được cache lúc khởi động.
func (a *App) GetSystemInfo() (*SystemInfo, error) {
	if a.sysInfo != nil {
		return a.sysInfo, nil
	}
	return a.fetchSystemInfo()
}

func (a *App) fetchSystemInfo() (*SystemInfo, error) {
	info := &SystemInfo{}

	if out, err := exec.Command("uname", "-r").Output(); err == nil {
		info.KernelVersion = strings.TrimSpace(string(out))
	}

	if data, err := os.ReadFile("/etc/os-release"); err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(line, "VERSION_ID=") {
				info.ArchVersion = strings.Trim(strings.TrimPrefix(line, "VERSION_ID="), `"`)
				break
			}
		}
	}

	if data, err := os.ReadFile("/proc/cpuinfo"); err == nil {
		scanner := bufio.NewScanner(strings.NewReader(string(data)))
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "model name") {
				_, val, _ := strings.Cut(line, ":")
				info.CPU = strings.TrimSpace(val)
				break
			}
		}
	}

	if out, err := exec.Command("free", "-h", "--si").Output(); err == nil {
		scanner := bufio.NewScanner(strings.NewReader(string(out)))
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "Mem:") {
				fields := strings.Fields(line)
				if len(fields) >= 2 {
					info.RAM = fields[1]
				}
				break
			}
		}
	}

	_, yayErr := exec.LookPath("yay")
	_, paruErr := exec.LookPath("paru")
	info.HasYay = yayErr == nil
	info.HasParu = paruErr == nil

	switch {
	case info.HasParu:
		info.AURHelper = "paru"
	case info.HasYay:
		info.AURHelper = "yay"
	}

	_, timeshiftErr := exec.LookPath("timeshift")
	_, snapperErr := exec.LookPath("snapper")
	info.HasTimeshift = timeshiftErr == nil
	info.HasSnapper = snapperErr == nil

	switch {
	case info.HasTimeshift:
		info.SnapshotTool = "timeshift"
	case info.HasSnapper:
		info.SnapshotTool = "snapper"
	}

	return info, nil
}

// CreateSnapshot tạo snapshot hệ thống trước khi cài/gỡ/cập nhật package.
// Dùng timeshift hoặc snapper nếu có.
func (a *App) CreateSnapshot(description string) (string, error) {
	if a.sysInfo == nil || a.sysInfo.SnapshotTool == "" {
		return "", fmt.Errorf("không tìm thấy công cụ snapshot (hãy cài timeshift hoặc snapper)")
	}

	description = sanitizeInput(description, 200)

	var cmd *exec.Cmd
	switch a.sysInfo.SnapshotTool {
	case "timeshift":
		cmd = exec.Command("pkexec", "timeshift", "--create",
			"--comments", description, "--scripted")
	case "snapper":
		cmd = exec.Command("pkexec", "snapper", "create",
			"--description", description)
	default:
		return "", fmt.Errorf("snapshot tool không được hỗ trợ")
	}

	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("tạo snapshot thất bại: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

// ─────────────────────────────────────────────
// BINDING 6: SubmitReview
// ─────────────────────────────────────────────

func (a *App) SubmitReview(pkgName string, rating int, comment string) error {
	if a.cfWorkerURL == "" {
		return fmt.Errorf("ARCHSTORE_CF_WORKER_URL chưa được cấu hình")
	}
	a.mu.Lock()
	if a.authToken == "" {
		a.mu.Unlock()
		return fmt.Errorf("cần đăng nhập để gửi đánh giá")
	}
	a.mu.Unlock()

	if err := validatePackageName(pkgName); err != nil {
		return err
	}
	if rating < 1 || rating > 5 {
		return fmt.Errorf("rating phải từ 1 đến 5")
	}
	if len(strings.TrimSpace(comment)) < 10 {
		return fmt.Errorf("bình luận phải có ít nhất 10 ký tự")
	}

	payload := map[string]interface{}{
		"pkg_name": pkgName,
		"rating":   rating,
		"comment":  sanitizeInput(comment, 2000),
	}

	return a.postToCloudflare("/reviews", payload)
}

// ─────────────────────────────────────────────
// BINDING 7: VoteReview
// ─────────────────────────────────────────────

func (a *App) VoteReview(reviewID int, voteType string) error {
	if a.cfWorkerURL == "" {
		return fmt.Errorf("ARCHSTORE_CF_WORKER_URL chưa được cấu hình")
	}
	if voteType != "like" && voteType != "dislike" {
		return fmt.Errorf("vote type không hợp lệ")
	}

	payload := map[string]interface{}{
		"review_id": reviewID,
		"vote_type": voteType,
	}

	return a.postToCloudflare("/votes", payload)
}

// ─────────────────────────────────────────────
// BINDING 8: GetFeaturedRatings
// ─────────────────────────────────────────────

// GetFeaturedRatings lấy rating trung bình cho nhiều package cùng lúc (dùng cho HomeView).
// Chạy các requests song song, bỏ qua lỗi để không block UI.
func (a *App) GetFeaturedRatings(pkgNames []string) (map[string]float64, error) {
	if a.cfWorkerURL == "" || len(pkgNames) == 0 {
		return map[string]float64{}, nil
	}

	type result struct {
		name   string
		rating float64
	}

	resultCh := make(chan result, len(pkgNames))
	var wg sync.WaitGroup

	for _, name := range pkgNames {
		if err := validatePackageName(name); err != nil {
			continue
		}
		wg.Add(1)
		go func(pkgName string) {
			defer wg.Done()
			r, err := a.fetchRatingFromCloudflare(pkgName)
			if err != nil || r == nil {
				return
			}
			if r.Average > 0 {
				resultCh <- result{name: pkgName, rating: r.Average}
			}
		}(name)
	}

	go func() {
		wg.Wait()
		close(resultCh)
	}()

	ratings := make(map[string]float64, len(pkgNames))
	for res := range resultCh {
		ratings[res.name] = res.rating
	}

	return ratings, nil
}

// ─────────────────────────────────────────────
// BINDING 9: GetInstalledPackages
// ─────────────────────────────────────────────

// GetInstalledPackages trả về toàn bộ package đã cài kèm description và size.
func (a *App) GetInstalledPackages() ([]PkgInfo, error) {
	// pacman -Qi trả về thông tin đầy đủ của tất cả installed packages
	out, err := exec.Command("pacman", "-Qi").Output()
	if err != nil {
		return nil, fmt.Errorf("pacman -Qi: %w", err)
	}

	return parsePacmanQiOutput(string(out)), nil
}

// parsePacmanQiOutput parse output của `pacman -Qi` (nhiều package, ngăn cách bởi dòng trống)
func parsePacmanQiOutput(output string) []PkgInfo {
	var pkgs []PkgInfo
	var cur *PkgInfo

	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()

		// Dòng trống = kết thúc block một package
		if strings.TrimSpace(line) == "" {
			if cur != nil && cur.Name != "" {
				pkgs = append(pkgs, *cur)
				cur = nil
			}
			continue
		}

		key, val, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)

		if key == "Name" {
			if cur != nil && cur.Name != "" {
				pkgs = append(pkgs, *cur)
			}
			cur = &PkgInfo{Source: "local", Installed: true}
			cur.Name = val
			continue
		}

		if cur == nil {
			continue
		}

		switch key {
		case "Version":
			cur.Version = val
		case "Description":
			cur.Description = val
		case "URL":
			cur.URL = val
		case "Installed Size":
			cur.SizeKB = parseSizeToKB(val)
		case "Packager":
			cur.Maintainer = val
		}
	}

	// Flush package cuối cùng nếu file không kết thúc bằng dòng trống
	if cur != nil && cur.Name != "" {
		pkgs = append(pkgs, *cur)
	}

	return pkgs
}

// ─────────────────────────────────────────────
// CLOUDFLARE INTEGRATION
// ─────────────────────────────────────────────

func (a *App) fetchRatingFromCloudflare(pkgName string) (*PackageRating, error) {
	req, err := http.NewRequest("GET", a.cfWorkerURL+"/ratings/"+url.PathEscape(pkgName), nil)
	if err != nil {
		return nil, err
	}
	a.mu.Lock()
	if a.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+a.authToken)
	}
	if a.cfAPIKey != "" {
		req.Header.Set("X-Api-Key", a.cfAPIKey)
	}
	a.mu.Unlock()

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Cloudflare Worker: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return &PackageRating{PkgName: pkgName}, nil
	}

	var rating PackageRating
	if err := json.NewDecoder(resp.Body).Decode(&rating); err != nil {
		return nil, err
	}

	return &rating, nil
}

func (a *App) postToCloudflare(endpoint string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", a.cfWorkerURL+endpoint, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	a.mu.Lock()
	if a.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+a.authToken)
	}
	if a.cfAPIKey != "" {
		req.Header.Set("X-Api-Key", a.cfAPIKey)
	}
	a.mu.Unlock()

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("lỗi kết nối mạng: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var errResp struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errResp)
		if errResp.Error != "" {
			return fmt.Errorf("%s", errResp.Error)
		}
		return fmt.Errorf("lỗi server: HTTP %d", resp.StatusCode)
	}

	return nil
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

func (a *App) emitProgress(pkgName, stage string, progress float64, message string) {
	if a.ctx == nil {
		return
	}
	runtime.EventsEmit(a.ctx, "install:progress", InstallProgress{
		PkgName:  pkgName,
		Stage:    stage,
		Progress: progress,
		Message:  message,
	})
}

func (a *App) isAURPackage(name string) bool {
	return exec.Command("pacman", "-Si", "--", name).Run() != nil
}

func (a *App) getPackageInfo(pkgName string) *PkgInfo {
	// Thử pacman sync db trước (nhanh)
	if out, err := exec.Command("pacman", "-Si", "--", pkgName).Output(); err == nil {
		return parsePacmanDetailOutput(string(out))
	}
	// Fallback AUR
	pkg, err := a.fetchAURInfo(pkgName)
	if err != nil {
		return nil
	}
	return pkg
}

func (a *App) fetchAURInfo(pkgName string) (*PkgInfo, error) {
	apiURL := "https://aur.archlinux.org/rpc/v5/info?arg[]=" + url.QueryEscape(pkgName)

	resp, err := a.httpClient.Get(apiURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var aurResp AURResponse
	if err := json.NewDecoder(resp.Body).Decode(&aurResp); err != nil {
		return nil, err
	}
	if len(aurResp.Results) == 0 {
		return nil, fmt.Errorf("không tìm thấy")
	}

	pkgs := convertAURResults(aurResp.Results)
	return &pkgs[0], nil
}

// ─────────────────────────────────────────────
// PARSERS
// ─────────────────────────────────────────────

// parsePacmanSearchOutput parse output của `pacman -Ss`.
// Mỗi package gồm 2 dòng: "repo/name version [installed]" rồi "    Description"
func parsePacmanSearchOutput(raw string) []PkgInfo {
	var pkgs []PkgInfo
	lines := strings.Split(raw, "\n")

	for i := 0; i < len(lines); i++ {
		line := lines[i]
		// Dòng header không có leading space và chứa "/"
		if strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t") || !strings.Contains(line, "/") {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}

		repoAndName := strings.SplitN(parts[0], "/", 2)
		if len(repoAndName) != 2 {
			continue
		}

		desc := ""
		if i+1 < len(lines) {
			desc = strings.TrimSpace(lines[i+1])
			i++ // bỏ qua dòng description
		}

		pkgs = append(pkgs, PkgInfo{
			Name:        repoAndName[1],
			Version:     parts[1],
			Description: desc,
			Source:      "pacman",
			Installed:   strings.Contains(line, "[installed]"),
		})
	}

	return pkgs
}

func parsePacmanDetailOutput(raw string) *PkgInfo {
	pkg := &PkgInfo{Source: "pacman"}

	for _, line := range strings.Split(raw, "\n") {
		key, val, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)

		switch key {
		case "Name":
			pkg.Name = val
		case "Version":
			pkg.Version = val
		case "Description":
			pkg.Description = val
		case "URL":
			pkg.URL = val
		case "Installed Size":
			pkg.SizeKB = parseSizeToKB(val)
		case "Depends On":
			if val != "None" {
				pkg.Depends = strings.Fields(val)
			}
		case "Packager":
			pkg.Maintainer = val
		case "Build Date":
			pkg.LastUpdated = val
		}
	}

	if pkg.Name == "" {
		return nil
	}

	installed := getInstalledSet()
	pkg.Installed = installed[pkg.Name]

	return pkg
}

// ─────────────────────────────────────────────
// AUR RPC TYPES
// ─────────────────────────────────────────────

type AURResponse struct {
	Version     int         `json:"version"`
	Type        string      `json:"type"`
	ResultCount int         `json:"resultcount"`
	Results     []AURResult `json:"results"`
	Error       string      `json:"error"`
}

type AURResult struct {
	Name         string   `json:"Name"`
	Version      string   `json:"Version"`
	Description  string   `json:"Description"`
	URL          string   `json:"URL"`
	Maintainer   string   `json:"Maintainer"`
	NumVotes     int      `json:"NumVotes"`
	Popularity   float64  `json:"Popularity"`
	LastModified int64    `json:"LastModified"`
	Depends      []string `json:"Depends"`
}

func convertAURResults(results []AURResult) []PkgInfo {
	pkgs := make([]PkgInfo, 0, len(results))
	installed := getInstalledSet()

	for _, r := range results {
		lastUpdated := ""
		if r.LastModified > 0 {
			lastUpdated = time.Unix(r.LastModified, 0).Format("2006-01-02")
		}
		pkgs = append(pkgs, PkgInfo{
			Name:        r.Name,
			Version:     r.Version,
			Description: r.Description,
			URL:         r.URL,
			Maintainer:  r.Maintainer,
			Votes:       r.NumVotes,
			Popularity:  r.Popularity,
			Source:      "aur",
			Installed:   installed[r.Name],
			Depends:     r.Depends,
			LastUpdated: lastUpdated,
		})
	}

	return pkgs
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

// deduplicatePackages gộp hai slice, pacman ưu tiên hơn AUR
func deduplicatePackages(pacman, aur []PkgInfo) []PkgInfo {
	seen := make(map[string]bool, len(pacman))
	result := make([]PkgInfo, 0, len(pacman)+len(aur))

	for _, p := range pacman {
		seen[p.Name] = true
		result = append(result, p)
	}
	for _, p := range aur {
		if !seen[p.Name] {
			result = append(result, p)
		}
	}

	return result
}

// getInstalledSet trả về set tên package đang cài để check nhanh
func getInstalledSet() map[string]bool {
	installed := make(map[string]bool)
	out, err := exec.Command("pacman", "-Qq").Output()
	if err != nil {
		return installed
	}
	for _, name := range strings.Split(string(out), "\n") {
		name = strings.TrimSpace(name)
		if name != "" {
			installed[name] = true
		}
	}
	return installed
}

// parseSizeToKB convert "123.45 MiB" → KB
func parseSizeToKB(s string) int64 {
	var value float64
	var unit string
	fmt.Sscanf(s, "%f %s", &value, &unit)

	switch strings.ToLower(unit) {
	case "kib", "kb":
		return int64(value)
	case "mib", "mb":
		return int64(value * 1024)
	case "gib", "gb":
		return int64(value * 1024 * 1024)
	default:
		return int64(value)
	}
}

// validatePackageName ngăn shell injection — whitelist Arch package naming convention
func validatePackageName(name string) error {
	if name == "" {
		return fmt.Errorf("tên package không được trống")
	}
	if len(name) > 255 {
		return fmt.Errorf("tên package quá dài")
	}
	for _, c := range name {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
			(c >= '0' && c <= '9') || c == '-' || c == '_' ||
			c == '.' || c == '+' || c == '@') {
			return fmt.Errorf("ký tự không hợp lệ trong tên package: %q", c)
		}
	}
	return nil
}

// sanitizeInput trim + giới hạn độ dài + loại null bytes
func sanitizeInput(input string, maxLen int) string {
	input = strings.TrimSpace(input)
	input = strings.ReplaceAll(input, "\x00", "")
	if len(input) > maxLen {
		input = input[:maxLen]
	}
	return input
}

func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
