export interface PkgInfo {
  name: string; version: string; description: string; source: string
  installed: boolean; size_kb: number; maintainer: string; url: string
  depends: string[]; votes: number; popularity: number; last_updated: string
  rating?: PackageRating
}
export type Package = PkgInfo
export interface PackageRating {
  average: number; total_votes: number
  distribution?: { stars: number; count: number }[]
  reviews: Review[]
  user_review_id?: number | null
}
export interface Review {
  id: number; pkg_name: string; username: string; user_id?: number | null; rating: number
  comment: string; date?: any; created_at?: string; likes: number; dislikes: number
  is_mine?: boolean; user_voted?: boolean
  replies: Reply[]
}
export interface Reply {
  id: number; review_id: number; author: string; content: string; date?: any
}
export interface AuthUser {
  id: number
  username: string
  email: string
  avatar_url: string
  provider: string
  is_verified: number
}
export interface SystemInfo {
  kernel_version: string; arch_version: string; cpu: string; ram: string
  has_yay: boolean; has_paru: boolean; aur_helper: string
}
export interface InstallProgress {
  pkg_name: string
  stage: 'resolving' | 'downloading' | 'installing' | 'done' | 'error'
  progress: number; message: string
}
