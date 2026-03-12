package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"

	"archstore/internal/app"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Khởi tạo Application Core - nơi chứa tất cả business logic
	archApp := app.NewApp()

	err := wails.Run(&options.App{
		Title:     "ArchStore",
		Width:     1280,
		Height:    800,
		MinWidth:  900,
		MinHeight: 600,

		// Nhúng toàn bộ frontend đã build vào binary
		AssetServer: &assetserver.Options{
			Assets: assets,
		},

		// Cho phép background trong suốt để hiệu ứng Glassmorphism hoạt động
		BackgroundColour: &options.RGBA{R: 10, G: 10, B: 20, A: 255},

		// Các hàm Binding: Frontend gọi được trực tiếp như JS function
		Bind: []interface{}{
			archApp,
		},

		// Cấu hình Linux-specific
		Linux: &linux.Options{
			// Icon ứng dụng
			WindowIsTranslucent: false,
		},

		// Lifecycle hooks
		OnStartup:  archApp.OnStartup,
		OnShutdown: archApp.OnShutdown,
	})

	if err != nil {
		log.Fatalf("Lỗi khởi động ArchStore: %v", err)
	}
}
